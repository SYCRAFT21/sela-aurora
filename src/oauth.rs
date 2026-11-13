use std::time::{Duration, Instant};
use axum::{extract::{Path, Query, State}, http::{HeaderMap, StatusCode}, response::Redirect};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use url::Url;
use crate::{persistence, app::{Account, AppResult, AppState, check_local_origin}, accounts::saved_account, gmail::bounded_gmail_json, network_error};

pub(super) struct Pending {
    pub(super) provider: String,
    pub(super) verifier: String,
    pub(super) created: Instant,
}


pub(super) const SCOPES_GOOGLE: &str = "openid email https://www.googleapis.com/auth/gmail.modify";
pub(super) const SCOPES_MICROSOFT: &str = "openid email User.Read Mail.ReadWrite offline_access";

#[derive(Deserialize)]
pub(super) struct AuthQuery {
    pub(super) login_hint: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct Callback {
    pub(super) code: Option<String>,
    pub(super) state: Option<String>,
    pub(super) error: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct Token {
    pub(super) access_token: String,
    pub(super) refresh_token: Option<String>,
    pub(super) expires_in: Option<u64>,
    #[serde(default)]
    pub(super) scope: Option<String>,
}

pub(super) fn granted_gmail_modify(scope: Option<&str>) -> Option<bool> {
    scope.map(|value| value.split_ascii_whitespace().any(|part| part == "https://www.googleapis.com/auth/gmail.modify"))
}

pub(super) fn refreshed_gmail_grant(previous: Option<bool>, scope: Option<&str>) -> Option<bool> {
    granted_gmail_modify(scope).or(previous)
}

pub(super) async fn request_token(client: &reqwest::Client, url: &str, form: &[(&str, &str)]) -> Result<Token, String> {
    let response = client.post(url).form(form).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?;
    serde_json::from_value(bounded_gmail_json(response, 65_536).await?).map_err(|e| e.to_string())
}

pub(super) fn config<'a>(state: &'a AppState, provider: &str) -> AppResult<(&'a str, Option<&'a str>, &'static str, &'static str, &'static str)> {
    match provider {
        "google" if !state.google_id.is_empty() && !state.google_secret.is_empty() => Ok((
            &state.google_id,
            Some(&state.google_secret),
            "https://accounts.google.com/o/oauth2/v2/auth",
            "https://oauth2.googleapis.com/token",
            SCOPES_GOOGLE,
        )),
        "microsoft" if !state.microsoft_id.is_empty() => Ok((
            &state.microsoft_id,
            None,
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            SCOPES_MICROSOFT,
        )),
        "google" | "microsoft" => Err((StatusCode::BAD_REQUEST, format!("Konfigurasi {provider} belum diisi"))),
        _ => Err((StatusCode::NOT_FOUND, "Provider tidak dikenal".into())),
    }
}

pub(super) fn redirect_uri(provider: &str) -> String {
    // Microsoft menerima HTTP localhost di portal; HTTP 127.0.0.1 perlu edit manifest.
    let host = if provider == "microsoft" { "localhost" } else { "127.0.0.1" };
    format!("http://{host}:3000/callback/{provider}")
}

pub(super) fn random_key() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub(super) async fn auth(Path(provider): Path<String>, Query(query): Query<AuthQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<Redirect> {
    check_local_origin(&headers)?;
    let (client_id, _, authorize, _, scope) = config(&state, &provider)?;
    let verifier = random_key();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let nonce = random_key();
    let mut url = Url::parse(authorize).unwrap();
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", &redirect_uri(&provider))
        .append_pair("scope", scope)
        .append_pair("state", &nonce)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    if provider == "google" {
        url.query_pairs_mut().append_pair("access_type", "offline").append_pair("prompt", "consent select_account");
    } else {
        url.query_pairs_mut().append_pair("prompt", "select_account");
    }
    if let Some(email) = query.login_hint.filter(|hint| hint.len() <= 254 && hint.contains('@')) {
        if state.accounts.read().await.values().any(|account| account.provider == provider && account.email.eq_ignore_ascii_case(&email)) {
            url.query_pairs_mut().append_pair("login_hint", &email);
        }
    }
    let mut pending = state.pending.lock().await;
    pending.retain(|_, value| value.created.elapsed() < Duration::from_secs(600));
    pending.insert(nonce, Pending { provider, verifier, created: Instant::now() });
    Ok(Redirect::to(url.as_str()))
}

pub(super) async fn callback(Path(provider): Path<String>, Query(query): Query<Callback>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<Redirect> {
    check_local_origin(&headers)?;
    if let Some(error) = query.error {
        return Err((StatusCode::BAD_REQUEST, format!("Login ditolak: {error}")));
    }
    let nonce = query.state.ok_or((StatusCode::BAD_REQUEST, "State OAuth hilang".into()))?;
    let pending = state.pending.lock().await.remove(&nonce)
        .ok_or((StatusCode::BAD_REQUEST, "State OAuth tidak valid atau sudah dipakai".into()))?;
    if pending.provider != provider || pending.created.elapsed() >= Duration::from_secs(600) {
        return Err((StatusCode::BAD_REQUEST, "State OAuth kedaluwarsa".into()));
    }
    let code = query.code.ok_or((StatusCode::BAD_REQUEST, "Kode OAuth hilang".into()))?;
    let (client_id, client_secret, _, token_url, _) = config(&state, &provider)?;
    let mut form = vec![
        ("client_id", client_id),
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", ""),
        ("code_verifier", pending.verifier.as_str()),
    ];
    let redirect = redirect_uri(&provider);
    form[3].1 = &redirect;
    if let Some(secret) = client_secret { form.push(("client_secret", secret)); }
    let token = request_token(&state.http, token_url, &form).await.map_err(|_| (StatusCode::BAD_GATEWAY, "Pertukaran token gagal atau melewati batas waktu".into()))?;
    let email = if provider == "google" {
        let info: serde_json::Value = state.http.get("https://www.googleapis.com/oauth2/v3/userinfo")
            .bearer_auth(&token.access_token).send().await.map_err(network_error)?
            .error_for_status().map_err(network_error)?.json().await.map_err(network_error)?;
        info["email"].as_str().map(str::to_owned)
    } else {
        let info: serde_json::Value = state.http.get("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName")
            .bearer_auth(&token.access_token).send().await.map_err(network_error)?
            .error_for_status().map_err(network_error)?.json().await.map_err(network_error)?;
        info["mail"].as_str().or_else(|| info["userPrincipalName"].as_str()).map(str::to_owned)
    }.ok_or((StatusCode::BAD_GATEWAY, "Alamat email tidak tersedia".into()))?;
    let _guard = state.refresh_lock.lock().await;
    let mut accounts = state.accounts.write().await;
    let existing = accounts.values().find(|account| account.provider == provider && account.email.eq_ignore_ascii_case(&email));
    let id = existing.map(|account| account.id.clone()).unwrap_or_else(random_key);
    let new_refresh = token.refresh_token;
    let refresh_token = new_refresh.clone().or_else(|| existing.and_then(|account| account.refresh_token.clone()))
        .ok_or((StatusCode::BAD_GATEWAY, "Provider tidak memberikan refresh token; akun tidak disimpan".to_string()))?;
    if let Some(ref refresh) = new_refresh {
        persistence::store(&id, refresh).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token tidak dapat disimpan di keyring: {e}")))?;
    }
    let mut saved: Vec<_> = accounts.values().filter(|account| account.id != id).map(saved_account).collect();
    saved.push(persistence::SavedAccount { id: id.clone(), email: email.clone(), provider: provider.clone() });
    persistence::save(&state.account_file, &saved)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Daftar akun tidak tersimpan: {e}")))?;
    accounts.insert(id.clone(), Account {
        id, email, gmail_modify: if provider == "google" { granted_gmail_modify(token.scope.as_deref()) } else { None }, provider, access_token: token.access_token,
        refresh_token: Some(refresh_token),
        expires: Instant::now() + Duration::from_secs(token.expires_in.unwrap_or(3600).saturating_sub(60)),
    });
    Ok(Redirect::to("/"))
}

pub(super) async fn refresh_account(state: &AppState, account: Account) -> Result<Account, String> {
    let _guard = state.refresh_lock.lock().await;
    let mut account = state.accounts.read().await.get(&account.id).cloned()
        .ok_or("Akun sudah diputus".to_string())?;
    if account.expires <= Instant::now() {
        let refresh = account.refresh_token.clone().ok_or("Sesi kedaluwarsa; sambung ulang akun".to_string())?;
        let (client_id, client_secret, _, token_url, _) = config(state, &account.provider).map_err(|e| e.1)?;
        let mut form = vec![("client_id", client_id), ("grant_type", "refresh_token"), ("refresh_token", refresh.as_str())];
        if let Some(secret) = client_secret { form.push(("client_secret", secret)); }
        let token = request_token(&state.http, token_url, &form).await
            .map_err(|_| "Pembaruan sesi gagal atau melewati batas waktu".to_string())?;
        account.access_token = token.access_token;
        account.gmail_modify = if account.provider == "google" { refreshed_gmail_grant(account.gmail_modify, token.scope.as_deref()) } else { None };
        if let Some(new_refresh) = token.refresh_token {
            persistence::store(&account.id, &new_refresh).map_err(|e| format!("Keyring gagal menyimpan token baru: {e}"))?;
            account.refresh_token = Some(new_refresh);
        }
        account.expires = Instant::now() + Duration::from_secs(token.expires_in.unwrap_or(3600).saturating_sub(60));
        state.accounts.write().await.insert(account.id.clone(), account.clone());
    }
    Ok(account)
}
