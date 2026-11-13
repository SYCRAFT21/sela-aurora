use std::collections::HashMap;
use axum::{extract::{Path, Query, State}, http::{header, HeaderMap, StatusCode}, Json};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use futures::future::join_all;
use serde::Deserialize;
use crate::{app::{Account, ActionQuery, AppResult, AppState, Inbox, Message, MessageQuery, check_local_origin}, gmail::{gmail_action, google_detail, google_messages, valid_gmail_message_id}, graph::{microsoft_detail, microsoft_messages}, oauth::refresh_account};

#[derive(Deserialize)]
pub(super) struct InboxQuery {
    #[serde(default)]
    pub(super) category: Option<String>,
    #[serde(default)]
    pub(super) mailbox: Option<String>,
    #[serde(default)]
    pub(super) search: Option<String>,
    #[serde(default)]
    pub(super) cursors: Option<String>,
}

pub(super) fn valid_mailbox(mailbox: &str) -> bool {
    matches!(mailbox, "inbox" | "starred" | "important" | "sent" | "drafts" | "archive" | "spam" | "trash" | "allmail")
}

pub(super) fn validate_mail_query<'a>(mailbox: &str, search: &'a str) -> AppResult<&'a str> {
    if !valid_mailbox(mailbox) { return Err((StatusCode::BAD_REQUEST, "Folder tidak dikenal".into())); }
    let search = search.trim();
    if search.len() > 200 || search.contains(['\n', '\r']) { return Err((StatusCode::BAD_REQUEST, "Pencarian terlalu panjang".into())); }
    Ok(search)
}

pub(super) fn encode_cursor(account: &str, mailbox: &str, category: &str, search: &str, page: &str) -> String {
    URL_SAFE_NO_PAD.encode(serde_json::to_vec(&[account, mailbox, category, search, page]).unwrap())
}

pub(super) fn decode_cursor(cursor: &str, account: &str, mailbox: &str, category: &str, search: &str) -> AppResult<String> {
    if cursor.len() > 4096 { return Err((StatusCode::BAD_REQUEST, "Kursor terlalu panjang".into())); }
    let bytes = URL_SAFE_NO_PAD.decode(cursor).map_err(|_| (StatusCode::BAD_REQUEST, "Kursor tidak valid".into()))?;
    let parts: Vec<String> = serde_json::from_slice(&bytes).map_err(|_| (StatusCode::BAD_REQUEST, "Kursor tidak valid".into()))?;
    if parts.len() != 5 || parts[0] != account || parts[1] != mailbox || parts[2] != category || parts[3] != search || parts[4].is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Kursor tidak cocok dengan daftar ini".into()));
    }
    Ok(parts[4].clone())
}

pub(super) fn inbox_pages(account_ids: &[String], cursors: &HashMap<String, String>, mailbox: &str, category: &str, search: &str) -> AppResult<Vec<(String, Option<String>)>> {
    if cursors.keys().any(|key| !account_ids.contains(key)) {
        return Err((StatusCode::BAD_REQUEST, "Kursor untuk akun tidak dikenal".into()));
    }
    account_ids.iter().filter(|id| cursors.is_empty() || cursors.contains_key(*id))
        .map(|id| cursors.get(id).map(|cursor| decode_cursor(cursor, id, mailbox, category, search)).transpose().map(|page| (id.clone(), page)))
        .collect()
}


pub(super) fn retain_failed_cursor(next: &mut HashMap<String, String>, previous: &HashMap<String, String>, account_id: &str) {
    if let Some(cursor) = previous.get(account_id) { next.insert(account_id.to_owned(), cursor.clone()); }
}


pub(super) fn inbox_category(category: Option<&str>) -> AppResult<&str> {
    match category.unwrap_or("all") {
        "all" => Ok("all"),
        "primary" => Ok("primary"),
        "promotions" => Ok("promotions"),
        "social" => Ok("social"),
        "updates" => Ok("updates"),
        _ => Err((StatusCode::BAD_REQUEST, "Kategori tidak dikenal".into())),
    }
}

pub(super) async fn inbox(Path(id): Path<String>, Query(query): Query<InboxQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(&headers)?;
    let category = inbox_category(query.category.as_deref())?;
    let mailbox = query.mailbox.as_deref().unwrap_or("inbox");
    let search = validate_mail_query(mailbox, query.search.as_deref().unwrap_or(""))?;
    let accounts: Vec<_> = {
        let accounts = state.accounts.read().await;
        if id == "all" { accounts.values().cloned().collect() }
        else { vec![accounts.get(&id).ok_or((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into()))?.clone()] }
    };
    let cursors: HashMap<String, String> = match query.cursors {
        Some(ref encoded) if encoded.len() <= 16_384 => serde_json::from_str(encoded)
            .map_err(|_| (StatusCode::BAD_REQUEST, "Daftar kursor tidak valid".to_string()))?,
        Some(_) => return Err((StatusCode::BAD_REQUEST, "Daftar kursor terlalu panjang".into())),
        None => HashMap::new(),
    };
    let account_ids: Vec<_> = accounts.iter().map(|account| account.id.clone()).collect();
    let pages = inbox_pages(&account_ids, &cursors, mailbox, category, search)?;
    let pages = pages.into_iter().filter_map(|(id, page)| accounts.iter().find(|account| account.id == id).cloned().map(|account| (account, page))).collect::<Vec<_>>();
    let results = join_all(pages.into_iter().map(|(account, page)| {
        let state = state.clone();
        async move {
            let name = account.email.clone();
            let id = account.id.clone();
            let provider = account.provider.clone();
            (name, id, provider, fetch_messages(&state, account, mailbox, category, search, page.as_deref()).await)
        }
    })).await;
    let mut messages = Vec::new();
    let mut errors = Vec::new();
    let mut next_cursors = HashMap::new();
    let mut limited_accounts = Vec::new();
    for (email, account_id, provider, result) in results {
        match result {
            Ok((mut batch, next)) => {
                messages.append(&mut batch);
                if let Some(cursor) = next { next_cursors.insert(account_id.clone(), encode_cursor(&account_id, mailbox, category, search, &cursor)); }
                if provider == "microsoft" { limited_accounts.push(account_id); }
            }
            Err(error) => {
                retain_failed_cursor(&mut next_cursors, &cursors, &account_id);
                errors.push(format!("{email}: {error}"));
            },
        }
    }
    messages.sort_by(|a, b| b.received.cmp(&a.received).then_with(|| a.account_id.cmp(&b.account_id)).then_with(|| a.id.cmp(&b.id)));
    messages.dedup_by(|a, b| a.account_id == b.account_id && a.id == b.id);
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(Inbox { messages, errors, next_cursors, limited_accounts })))
}

pub(super) async fn fetch_messages(state: &AppState, account: Account, mailbox: &str, category: &str, search: &str, page: Option<&str>) -> Result<(Vec<Message>, Option<String>), String> {
    // shortcut: Outlook categories/starred/all-mail and pagination lack Gmail equivalents; add Graph-specific APIs when needed.
    if account.provider == "microsoft" && (mailbox == "starred" || mailbox == "important" || mailbox == "allmail" || (mailbox == "inbox" && !matches!(category, "all" | "primary"))) { return Ok((vec![], None)); }
    let account = refresh_account(state, account).await?;
    if account.provider == "google" { google_messages(state, &account, mailbox, category, search, page).await }
    else if page.is_some() { Err("Paginasi Outlook belum didukung".into()) }
    else { microsoft_messages(state, &account, mailbox, search).await.map(|messages| (messages, None)) }
}

pub(super) async fn mark_read(Path(account_id): Path<String>, State(state): State<AppState>, headers: HeaderMap, Json(message): Json<MessageQuery>) -> AppResult<StatusCode> {
    check_local_origin(&headers)?;
    if message.id.is_empty() || message.id.len() > 512 {
        return Err((StatusCode::BAD_REQUEST, "ID pesan tidak valid".into()));
    }
    let account = state.accounts.read().await.get(&account_id).cloned()
        .ok_or((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into()))?;
    let account = refresh_account(&state, account).await.map_err(|error| (StatusCode::BAD_GATEWAY, error))?;
    if account.provider == "google" {
        crate::gmail::mark_read(&state, &account, &message.id).await?;
    } else {
        crate::graph::mark_read(&state, &account, &message.id).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn message_action(Path(account_id): Path<String>, State(state): State<AppState>, headers: HeaderMap, Json(message): Json<ActionQuery>) -> AppResult<StatusCode> {
    check_local_origin(&headers)?;
    if !valid_gmail_message_id(&message.id) {
        return Err((StatusCode::BAD_REQUEST, "ID pesan tidak valid".into()));
    }
    let (endpoint, add, remove) = gmail_action(&message.action)
        .ok_or((StatusCode::BAD_REQUEST, "Tindakan belum didukung".to_string()))?;
    let account = state.accounts.read().await.get(&account_id).cloned()
        .ok_or((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into()))?;
    if account.provider != "google" { return Err((StatusCode::NOT_IMPLEMENTED, "Tindakan Outlook belum tersedia".into())); }
    let account = refresh_account(&state, account).await.map_err(|_| (StatusCode::BAD_GATEWAY, "Izin akun belum dapat diperiksa; sambung ulang bila perlu".into()))?;
    if account.gmail_modify != Some(true) { return Err((StatusCode::FORBIDDEN, "Izin Gmail belum terverifikasi; perbarui izin akun".into())); }
    crate::gmail::apply_action(&state, &account, &message.id, endpoint, add, remove).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn message_detail(Path(account_id): Path<String>, Query(message): Query<MessageQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    let message_id = message.id;
    check_local_origin(&headers)?;
    if message_id.is_empty() || message_id.len() > 512 {
        return Err((StatusCode::BAD_REQUEST, "ID pesan tidak valid".into()));
    }
    let account = state.accounts.read().await.get(&account_id).cloned()
        .ok_or((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into()))?;
    if account.provider == "google" && !valid_gmail_message_id(&message_id) { return Err((StatusCode::BAD_REQUEST,"ID pesan tidak valid".into())); }
    let account = refresh_account(&state, account).await.map_err(|error| (StatusCode::BAD_GATEWAY, error))?;
    let detail = if account.provider == "google" {
        google_detail(&state, &account, &message_id).await
    } else {
        microsoft_detail(&state, &account, &message_id).await
    }.map_err(|error| (StatusCode::BAD_GATEWAY, error))?;
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(detail)))
}
