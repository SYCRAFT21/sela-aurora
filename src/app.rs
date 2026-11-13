use std::{collections::HashMap, sync::Arc, time::Instant};
use axum::{extract::{Path, State}, http::{header, HeaderMap, StatusCode}, response::Html, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock, Semaphore};
use crate::{accounts, ai, attachments, compose, downloads, mailbox, oauth, settings};
use crate::oauth::Pending;

pub(super) type AppResult<T> = Result<T, (StatusCode, String)>;
include!(concat!(env!("OUT_DIR"), "/assets.rs"));

pub(super) async fn embedded_asset(Path(path): Path<String>) -> AppResult<impl axum::response::IntoResponse> {
    let key = format!("assets/{path}");
    let (_, bytes) = EMBEDDED_ASSETS.iter().find(|(name, _)| *name == key)
        .ok_or((StatusCode::NOT_FOUND, "Aset tidak ditemukan".into()))?;
    let mime = match path.rsplit('.').next() {
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    };
    Ok(([(header::CONTENT_TYPE, mime), (header::X_CONTENT_TYPE_OPTIONS, "nosniff"), (header::CACHE_CONTROL, "no-cache")], *bytes))
}

pub(super) fn application_document() -> impl axum::response::IntoResponse {
    ([(header::CACHE_CONTROL, "no-store"), (header::X_FRAME_OPTIONS, "DENY"),
      (header::CONTENT_SECURITY_POLICY, "frame-ancestors 'none'")], Html(include_str!("aurora-dist/index.html")))
}

pub(super) fn check_local_origin(headers: &HeaderMap) -> AppResult<()> {
    let host = headers.get(header::HOST).and_then(|value| value.to_str().ok()).unwrap_or("");
    if host != "127.0.0.1:3000" && host != "localhost:3000" {
        return Err((StatusCode::FORBIDDEN, "Host tidak diizinkan".into()));
    }
    if let Some(origin) = headers.get(header::ORIGIN) {
        if origin.to_str().ok() != Some(&format!("http://{host}")) {
            return Err((StatusCode::FORBIDDEN, "Origin tidak diizinkan".into()));
        }
    }
    Ok(())
}

pub(super) fn check_settings_origin(headers: &HeaderMap) -> AppResult<()> {
    check_local_origin(headers)?;
    if !headers.contains_key(header::ORIGIN) {
        return Err((StatusCode::FORBIDDEN, "Origin wajib disertakan".into()));
    }
    Ok(())
}

pub(super) async fn get_settings(State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(&headers)?;
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(state.settings.lock().await.view())))
}

pub(super) async fn update_settings(State(state): State<AppState>, headers: HeaderMap, Json(patch): Json<settings::Patch>) -> AppResult<impl axum::response::IntoResponse> {
    check_settings_origin(&headers)?;
    let mut current = state.settings.lock().await;
    let next = current.patched(patch).map_err(|_| (StatusCode::BAD_REQUEST, "Pengaturan tidak valid".into()))?;
    settings::save(&state.settings_file, &next).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Pengaturan gagal disimpan; konfigurasi lama tetap dipakai".into()))?;
    *current = next;
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(current.view())))
}

pub(super) async fn ai_compose(State(state): State<AppState>, headers: HeaderMap, Json(input): Json<ai::Instruction>) -> AppResult<impl axum::response::IntoResponse> {
    check_settings_origin(&headers)?;
    ai::validate(&input)?;
    let _permit = state.ai_requests.try_acquire().map_err(|_| (StatusCode::TOO_MANY_REQUESTS, "AI sedang membuat teks; tunggu hasilnya".into()))?;
    let config = state.settings.lock().await.ai.clone();
    let draft = ai::generate(&state.ai_http, &config, &input).await?;
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(draft)))
}

#[derive(Clone)]
pub(super) struct AppState {
    pub(super) http: reqwest::Client,
    pub(super) gmail_base: String,
    pub(super) attachment_transfers: Arc<Semaphore>,
    pub(super) accounts: Arc<RwLock<HashMap<String, Account>>>,
    pub(super) pending: Arc<Mutex<HashMap<String, Pending>>>,
    pub(super) refresh_lock: Arc<Mutex<()>>,
    pub(super) submissions: Arc<Mutex<HashMap<String, Instant>>>,
    pub(super) google_id: String,
    pub(super) google_secret: String,
    pub(super) microsoft_id: String,
    pub(super) account_file: std::path::PathBuf,
    pub(super) settings: Arc<Mutex<settings::Settings>>,
    pub(super) settings_file: std::path::PathBuf,
    pub(super) ai_http: reqwest::Client,
    pub(super) ai_requests: Arc<Semaphore>,
    pub(super) proposals: Arc<Mutex<Option<crate::schedule_store::Store>>>,
    pub(super) agent_sessions: Arc<Mutex<crate::agent::Sessions>>,
}

#[derive(Clone)]
pub(super) struct Account {
    pub(super) id: String,
    pub(super) email: String,
    pub(super) provider: String,
    pub(super) access_token: String,
    pub(super) refresh_token: Option<String>,
    pub(super) expires: Instant,
    pub(super) gmail_modify: Option<bool>,
}

#[derive(Serialize)]
pub(super) struct AccountView {
    pub(super) id: String,
    pub(super) email: String,
    pub(super) provider: String,
    pub(super) reconnect: bool,
    pub(super) gmail_modify: Option<bool>,
}

#[derive(Serialize)]
pub(super) struct Message {
    pub(super) id: String,
    pub(super) account_id: String,
    pub(super) recipient: String,
    pub(super) sender: String,
    pub(super) subject: String,
    pub(super) snippet: String,
    pub(super) received: String,
    pub(super) unread: bool,
    pub(super) starred: bool,
    pub(super) url: String,
}

#[derive(Serialize)]
pub(super) struct Inbox {
    pub(super) messages: Vec<Message>,
    pub(super) errors: Vec<String>,
    pub(super) next_cursors: HashMap<String, String>,
    pub(super) limited_accounts: Vec<String>,
}

#[derive(Serialize)]
pub(super) struct MessageDetail {
    pub(super) account_id: String,
    pub(super) message_id: String,
    pub(super) attachments: Vec<attachments::Attachment>,
    pub(super) sender: String,
    pub(super) recipient: String,
    pub(super) cc: String,
    pub(super) subject: String,
    pub(super) received: String,
    pub(super) body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) html: Option<String>,
    pub(super) url: String,
}

#[derive(Deserialize)]
pub(super) struct AttachmentQuery {
    pub(super) message_id: String,
    #[serde(default)]
    pub(super) part: String,
}

#[derive(Deserialize)]
pub(super) struct MessageQuery {
    pub(super) id: String,
}

#[derive(Deserialize)]
pub(super) struct ActionQuery {
    pub(super) id: String,
    pub(super) action: String,
}


async fn private_assistant_response(mut response: axum::response::Response) -> axum::response::Response {
    response.headers_mut().insert(header::CACHE_CONTROL, axum::http::HeaderValue::from_static("no-store"));
    response
}

pub(super) fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(|| async { application_document() }))
        .route("/assets/{*path}", get(embedded_asset))
        .route("/icon/sela_aurora_app_icon.svg", get(|| async { ([(header::CONTENT_TYPE, "image/svg+xml")], include_str!("../frontend/public/icon/sela_aurora_app_icon.svg")) }))
        .route("/auth/{provider}", get(oauth::auth))
        .route("/callback/{provider}", get(oauth::callback))
        .route("/api/settings", get(get_settings).patch(update_settings).layer(axum::extract::DefaultBodyLimit::max(16_384)))
        .route("/api/ai/compose", post(ai_compose).layer(axum::extract::DefaultBodyLimit::max(16_384)))
        .route("/api/assistant/sessions", post(crate::agent::create).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/assistant/sessions/{id}", get(crate::agent::get).patch(crate::agent::patch).delete(crate::agent::remove).layer(axum::extract::DefaultBodyLimit::max(32_768)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/assistant/sessions/{id}/turns", post(crate::agent::turn).layer(axum::extract::DefaultBodyLimit::max(16_384)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/assistant/sessions/{id}/actions", post(crate::agent::propose).layer(axum::extract::DefaultBodyLimit::max(32_768)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/assistant/sessions/{id}/actions/{action}/confirm", post(crate::agent::confirm).layer(axum::extract::DefaultBodyLimit::max(1024)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/ai/chat", post(crate::assistant::chat).layer(axum::extract::DefaultBodyLimit::max(65_536)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/scheduling/capabilities", get(crate::assistant::capabilities))
        .route("/api/schedules", post(crate::assistant::activate))
        .route("/api/schedule-proposals", get(crate::schedule_store::list).post(crate::schedule_store::create).layer(axum::extract::DefaultBodyLimit::max(65_536)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/schedule-proposals/{id}", axum::routing::patch(crate::schedule_store::update).delete(crate::schedule_store::remove).layer(axum::extract::DefaultBodyLimit::max(65_536)).layer(axum::middleware::map_response(private_assistant_response)))
        .route("/api/accounts", get(accounts::accounts))
        .route("/api/accounts/{id}", axum::routing::delete(accounts::disconnect))
        .route("/api/inbox/{id}", get(mailbox::inbox))
        .route("/api/message/{account_id}", get(mailbox::message_detail))
        .route("/api/message/{account_id}/attachment", get(downloads::message_attachment))
        .route("/api/draft/{account_id}", get(compose::draft_detail))
        .route("/api/message/{account_id}/read", post(mailbox::mark_read))
        .route("/api/message/{account_id}/action", post(mailbox::message_action))
        .route("/api/compose/{account_id}", post(compose::compose_message).layer(axum::extract::DefaultBodyLimit::max(27_000_000)))
        .with_state(state)
}
