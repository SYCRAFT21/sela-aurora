mod persistence;
mod attachments;

use std::{collections::HashMap, fs, net::SocketAddr, sync::Arc, time::{Duration, Instant}};

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{Html, Redirect},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD}, Engine};
use futures::{future::join_all, StreamExt};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::{Mutex, RwLock, Semaphore};
use url::Url;

const SCOPES_GOOGLE: &str = "openid email https://www.googleapis.com/auth/gmail.modify";
const SCOPES_MICROSOFT: &str = "openid email User.Read Mail.ReadWrite offline_access";

type AppResult<T> = Result<T, (StatusCode, String)>;
include!(concat!(env!("OUT_DIR"), "/assets.rs"));

async fn embedded_asset(Path(path): Path<String>) -> AppResult<impl axum::response::IntoResponse> {
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

#[derive(Deserialize)]
struct ClientConfig {
    client_id: String,
    #[serde(default)]
    client_secret: Option<String>,
}

fn load_config(path: &str) -> ClientConfig {
    let text = fs::read_to_string(path).unwrap_or_else(|error| panic!("Gagal membaca {path}: {error}"));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("Format {path} salah: {error}"))
}

#[derive(Clone)]
struct AppState {
    http: reqwest::Client,
    gmail_base: String,
    attachment_transfers: Arc<Semaphore>,
    accounts: Arc<RwLock<HashMap<String, Account>>>,
    pending: Arc<Mutex<HashMap<String, Pending>>>,
    refresh_lock: Arc<Mutex<()>>,
    submissions: Arc<Mutex<HashMap<String, Instant>>>,
    google_id: String,
    google_secret: String,
    microsoft_id: String,
    account_file: std::path::PathBuf,
}

struct Pending {
    provider: String,
    verifier: String,
    created: Instant,
}

#[derive(Clone)]
struct Account {
    id: String,
    email: String,
    provider: String,
    access_token: String,
    refresh_token: Option<String>,
    expires: Instant,
    gmail_modify: Option<bool>,
}

#[derive(Serialize)]
struct AccountView {
    id: String,
    email: String,
    provider: String,
    reconnect: bool,
    gmail_modify: Option<bool>,
}

#[derive(Serialize)]
struct Message {
    id: String,
    account_id: String,
    recipient: String,
    sender: String,
    subject: String,
    snippet: String,
    received: String,
    unread: bool,
    starred: bool,
    url: String,
}

#[derive(Serialize)]
struct Inbox {
    messages: Vec<Message>,
    errors: Vec<String>,
    next_cursors: HashMap<String, String>,
    limited_accounts: Vec<String>,
}

#[derive(Serialize)]
struct MessageDetail {
    account_id: String,
    message_id: String,
    attachments: Vec<attachments::Attachment>,
    sender: String,
    recipient: String,
    cc: String,
    subject: String,
    received: String,
    body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    html: Option<String>,
    url: String,
}

#[derive(Deserialize)]
struct AttachmentQuery {
    message_id: String,
    #[serde(default)]
    part: String,
}

#[derive(Deserialize)]
struct MessageQuery {
    id: String,
}

#[derive(Deserialize)]
struct ActionQuery {
    id: String,
    action: String,
}

#[derive(Deserialize)]
struct ComposeQuery {
    to: String,
    subject: String,
    body: String,
    #[serde(default)]
    message_id: Option<String>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    cc: Option<String>,
    #[serde(default)]
    bcc: Option<String>,
    #[serde(default)]
    submission_id: Option<String>,
    #[serde(default)]
    draft_reply: bool,
    #[serde(default)]
    draft_id: Option<String>,
    #[serde(default)]
    expected_message_id: Option<String>,
    #[serde(default)]
    convert_html: bool,
    #[serde(default)]
    files: Vec<UploadMeta>,
    #[serde(default)]
    retained: Vec<RetainedFile>,
}
#[derive(Deserialize)]
struct UploadMeta { id: String, filename: String, mime_type: String, size: usize }
#[derive(Deserialize)]
struct RetainedFile { message_id: String, part: String }

async fn read_compose(request: axum::extract::Request) -> AppResult<(ComposeQuery,Vec<attachments::Upload>)> {
    use axum::extract::FromRequest;
    let invalid = || (StatusCode::BAD_REQUEST,"Data lampiran tidak valid".to_owned());
    if request.headers().get(header::CONTENT_TYPE).and_then(|h| h.to_str().ok()).is_some_and(|h| h.starts_with("application/json")) {
        let bytes = axum::body::to_bytes(request.into_body(),1_100_000).await.map_err(|_| invalid())?;
        let message: ComposeQuery = serde_json::from_slice(&bytes).map_err(|_| invalid())?;
        if !message.files.is_empty() { return Err(invalid()); }
        return Ok((message,vec![]));
    }
    let mut multipart = axum::extract::Multipart::from_request(request,&()).await.map_err(|_| invalid())?;
    let mut manifest = None; let mut data = HashMap::new(); let mut total = 0usize;
    while let Some(mut field) = multipart.next_field().await.map_err(|_| invalid())? {
        let name = field.name().unwrap_or("").to_owned();
        if name != "manifest" && !(name.starts_with("file") && name.len()<=10 && name[4..].bytes().all(|b| b.is_ascii_digit())) { return Err(invalid()); }
        if name == "manifest" && manifest.is_some() || data.contains_key(&name) || data.len() >= attachments::MAX_FILES { return Err(invalid()); }
        let limit = if name == "manifest" {1_100_000} else {attachments::MAX_FILE_BYTES};
        let mut bytes = Vec::new();
        while let Some(chunk) = field.chunk().await.map_err(|_| invalid())? {
            if chunk.len() > limit.saturating_sub(bytes.len()) { return Err((StatusCode::PAYLOAD_TOO_LARGE,"Lampiran terlalu besar".into())); }
            bytes.extend_from_slice(&chunk);
        }
        if name == "manifest" { manifest = Some(serde_json::from_slice::<ComposeQuery>(&bytes).map_err(|_| invalid())?); }
        else { total += bytes.len(); if total > attachments::MAX_FILE_BYTES { return Err((StatusCode::PAYLOAD_TOO_LARGE,"Total lampiran maksimal 25 MB".into())); } data.insert(name,bytes); }
    }
    let message = manifest.ok_or_else(invalid)?;
    if message.files.len() != data.len() || message.files.len()+message.retained.len() > attachments::MAX_FILES { return Err(invalid()); }
    let mut files = Vec::new();
    for meta in &message.files {
        let bytes = data.remove(&meta.id).ok_or_else(invalid)?;
        if bytes.len()!=meta.size || meta.filename != attachments::safe_filename(&meta.filename) || !attachments::valid_mime(&meta.mime_type) { return Err(invalid()); }
        files.push(attachments::Upload {filename:meta.filename.clone(),mime_type:meta.mime_type.clone(),bytes,content_id:None});
    }
    Ok((message,files))
}

#[derive(Deserialize)]
struct InboxQuery {
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    mailbox: Option<String>,
    #[serde(default)]
    search: Option<String>,
    #[serde(default)]
    cursors: Option<String>,
}

#[derive(Deserialize)]
struct AuthQuery {
    login_hint: Option<String>,
}

fn valid_mailbox(mailbox: &str) -> bool {
    matches!(mailbox, "inbox" | "starred" | "important" | "sent" | "drafts" | "archive" | "spam" | "trash" | "allmail")
}

fn validate_mail_query<'a>(mailbox: &str, search: &'a str) -> AppResult<&'a str> {
    if !valid_mailbox(mailbox) { return Err((StatusCode::BAD_REQUEST, "Folder tidak dikenal".into())); }
    let search = search.trim();
    if search.len() > 200 || search.contains(['\n', '\r']) { return Err((StatusCode::BAD_REQUEST, "Pencarian terlalu panjang".into())); }
    Ok(search)
}

fn encode_cursor(account: &str, mailbox: &str, category: &str, search: &str, page: &str) -> String {
    URL_SAFE_NO_PAD.encode(serde_json::to_vec(&[account, mailbox, category, search, page]).unwrap())
}

fn decode_cursor(cursor: &str, account: &str, mailbox: &str, category: &str, search: &str) -> AppResult<String> {
    if cursor.len() > 4096 { return Err((StatusCode::BAD_REQUEST, "Kursor terlalu panjang".into())); }
    let bytes = URL_SAFE_NO_PAD.decode(cursor).map_err(|_| (StatusCode::BAD_REQUEST, "Kursor tidak valid".into()))?;
    let parts: Vec<String> = serde_json::from_slice(&bytes).map_err(|_| (StatusCode::BAD_REQUEST, "Kursor tidak valid".into()))?;
    if parts.len() != 5 || parts[0] != account || parts[1] != mailbox || parts[2] != category || parts[3] != search || parts[4].is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Kursor tidak cocok dengan daftar ini".into()));
    }
    Ok(parts[4].clone())
}

fn inbox_pages(account_ids: &[String], cursors: &HashMap<String, String>, mailbox: &str, category: &str, search: &str) -> AppResult<Vec<(String, Option<String>)>> {
    if cursors.keys().any(|key| !account_ids.contains(key)) {
        return Err((StatusCode::BAD_REQUEST, "Kursor untuk akun tidak dikenal".into()));
    }
    account_ids.iter().filter(|id| cursors.is_empty() || cursors.contains_key(*id))
        .map(|id| cursors.get(id).map(|cursor| decode_cursor(cursor, id, mailbox, category, search)).transpose().map(|page| (id.clone(), page)))
        .collect()
}

fn compose_request_valid(mode: &str, source: Option<&str>, submission: Option<&str>, draft_reply: bool) -> AppResult<()> {
    if !matches!(mode, "new" | "reply" | "replyAll" | "forward" | "draft") ||
        source.is_some_and(|id| !valid_gmail_message_id(id)) ||
        (matches!(mode, "reply" | "replyAll" | "forward") || draft_reply) && source.is_none() ||
        draft_reply && mode != "draft" ||
        mode != "draft" && !submission.is_some_and(|id| !id.is_empty() && id.len() <= 100 && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')) {
        return Err((StatusCode::BAD_REQUEST, "Mode, sumber, atau konfirmasi pesan tidak valid".into()));
    }
    Ok(())
}

fn reserve_submission(submissions: &mut HashMap<String, Instant>, key: &str) -> AppResult<()> {
    // shortcut: reservations last only until restart; persistent deduplication needs durable storage.
    if submissions.contains_key(key) {
        return Err((StatusCode::CONFLICT, "Pengiriman ini sudah diproses; periksa folder Terkirim sebelum mencoba lagi".into()));
    }
    submissions.insert(key.to_owned(), Instant::now());
    Ok(())
}

fn compose_raw(from: &str, to: &str, subject: &str, body: &str, thread_header: Option<&str>, cc: Option<&str>, bcc: Option<&str>) -> AppResult<String> {
    let email = |address: &str| {
        !address.is_empty() && address.len() <= 254 && address.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'@' | b'.' | b'_' | b'+' | b'-'))
            && address.matches('@').count() == 1 && address.split_once('@').is_some_and(|(local, domain)| {
                !local.is_empty() && !local.starts_with('.') && !local.ends_with('.') && !local.contains("..")
                    && domain.split('.').all(|part| !part.is_empty() && !part.starts_with('-') && !part.ends_with('-')) && domain.contains('.')
            })
    };
    if !email(from) || to.len() > 1024 || to.split(',').count() > 20 || !to.split(',').all(|address| email(address.trim())) || to.bytes().any(|byte| byte < 0x20 || byte == 0x7f) || subject.trim().is_empty() || subject.len() > 512 || subject.bytes().any(|byte| byte < 0x20 || byte == 0x7f)
        || body.len() > 1_000_000 || thread_header.is_some_and(|value| value.len() > 512 || value.bytes().any(|byte| byte < 0x20 || byte == 0x7f)) {
        return Err((StatusCode::BAD_REQUEST, "Alamat, subjek, atau isi pesan tidak valid".into()));
    }
    if [cc, bcc].into_iter().flatten().any(|addresses| addresses.len() > 1024 || addresses.split(',').count() > 20 || !addresses.split(',').all(|address| email(address.trim())) || addresses.bytes().any(|byte| byte < 0x20 || byte == 0x7f)) {
        return Err((StatusCode::BAD_REQUEST, "Alamat CC tidak valid".into()));
    }
    let subject = format!("=?UTF-8?B?{}?=", STANDARD.encode(subject.as_bytes()));
    let mut headers = format!("From: {from}\r\nTo: {to}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n");
    if let Some(cc) = cc { headers.push_str(&format!("Cc: {cc}\r\n")); }
    if let Some(bcc) = bcc { headers.push_str(&format!("Bcc: {bcc}\r\n")); }
    if let Some(id) = thread_header { headers.push_str(&format!("In-Reply-To: {id}\r\nReferences: {id}\r\n")); }
    headers.push_str("\r\n");
    headers.push_str(&STANDARD.encode(body.replace("\r\n", "\n").replace('\n', "\r\n").as_bytes()));
    Ok(URL_SAFE_NO_PAD.encode(headers.as_bytes()))
}

fn compose_result_id(response: &serde_json::Value) -> AppResult<&str> {
    response["id"].as_str().filter(|id| !id.is_empty())
        .ok_or((StatusCode::BAD_GATEWAY, "Gmail tidak mengonfirmasi ID pesan".into()))
}

fn compose_thread<'a>(mode: &str, draft_reply: bool, thread: Option<&'a str>) -> Option<&'a str> {
    if matches!(mode, "reply" | "replyAll") || mode == "draft" && draft_reply { thread } else { None }
}

fn reply_metadata(source: &serde_json::Value) -> AppResult<(String, String)> {
    let thread = source["threadId"].as_str().filter(|value| valid_gmail_message_id(value))
        .ok_or((StatusCode::BAD_GATEWAY, "Thread sumber tidak valid".to_owned()))?;
    let message_id = gmail_header(source, "Message-ID");
    if message_id.is_empty() || message_id.len() > 512 || !message_id.starts_with('<') || !message_id.ends_with('>')
        || message_id.bytes().any(|byte| byte < 0x21 || byte > 0x7e)
        || message_id[1..message_id.len()-1].contains(['<', '>']) {
        return Err((StatusCode::BAD_GATEWAY, "Header pesan sumber tidak valid".into()));
    }
    Ok((thread.to_owned(), message_id))
}

fn valid_gmail_message_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 512 && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

fn gmail_action(action: &str) -> Option<(&'static str, Vec<&'static str>, Vec<&'static str>)> {
    let (endpoint, add, remove) = match action {
        "star" => ("modify", vec!["STARRED"], vec![]),
        "unstar" => ("modify", vec![], vec!["STARRED"]),
        "archive" => ("modify", vec![], vec!["INBOX"]),
        "read" => ("modify", vec![], vec!["UNREAD"]),
        "unread" => ("modify", vec!["UNREAD"], vec![]),
        "spam" => ("modify", vec!["SPAM"], vec!["INBOX"]),
        "notSpam" => ("modify", vec!["INBOX"], vec!["SPAM"]),
        "trash" => ("trash", vec![], vec![]),
        "restore" => ("untrash", vec![], vec![]),
        _ => return None,
    };
    Some((endpoint, add, remove))
}

fn retain_failed_cursor(next: &mut HashMap<String, String>, previous: &HashMap<String, String>, account_id: &str) {
    if let Some(cursor) = previous.get(account_id) { next.insert(account_id.to_owned(), cursor.clone()); }
}

fn gmail_header(value: &serde_json::Value, name: &str) -> String {
    value["payload"]["headers"].as_array().into_iter().flatten()
        .find(|header| header["name"].as_str().is_some_and(|key| key.eq_ignore_ascii_case(name)))
        .and_then(|header| header["value"].as_str()).unwrap_or("").to_owned()
}

fn gmail_message_matches(value: &serde_json::Value, mailbox: &str, category: &str) -> bool {
    let labels = value["labelIds"].as_array();
    let has = |label: &str| labels.is_some_and(|items| items.iter().any(|item| item.as_str() == Some(label)));
    let folder = match mailbox {
        "inbox" => has("INBOX"), "sent" => has("SENT"), "drafts" => has("DRAFT"),
        "starred" => has("STARRED"), "important" => has("IMPORTANT"),
        "spam" => has("SPAM"), "trash" => has("TRASH"),
        "archive" => labels.is_some() && !["INBOX", "SENT", "DRAFT", "SPAM", "TRASH"].iter().any(|label| has(label)),
        "allmail" => labels.is_some() && !has("SPAM") && !has("TRASH"), _ => false,
    };
    let category_label = if category == "primary" { "PERSONAL" } else { category };
    folder && (mailbox != "inbox" || category == "all" || has(&format!("CATEGORY_{}", category_label.to_uppercase())))
}

fn gmail_include_spam_trash(mailbox: &str) -> bool { matches!(mailbox, "spam" | "trash") }

fn google_mailbox_query(mailbox: &str, category: &str, search: &str) -> String {
    let folder = match mailbox {
        "starred" => "is:starred", "important" => "is:important", "sent" => "in:sent", "drafts" => "in:drafts",
        "archive" => "in:anywhere -in:inbox -in:spam -in:trash -in:sent -in:drafts",
        "spam" => "in:spam", "trash" => "in:trash",
        "allmail" => "in:anywhere -in:spam -in:trash", _ => "in:inbox",
    };
    let category = if mailbox == "inbox" && category != "all" { format!(" category:{category}") } else { String::new() };
    format!("{folder}{category}{}", if search.is_empty() { String::new() } else { format!(" {search}") })
}

fn microsoft_mailbox_path(mailbox: &str) -> &str {
    match mailbox {
        "sent" => "sentitems", "drafts" => "drafts", "archive" => "archive",
        "spam" => "junkemail", "trash" => "deleteditems", _ => "inbox",
    }
}

fn inbox_category(category: Option<&str>) -> AppResult<&str> {
    match category.unwrap_or("all") {
        "all" => Ok("all"),
        "primary" => Ok("primary"),
        "promotions" => Ok("promotions"),
        "social" => Ok("social"),
        "updates" => Ok("updates"),
        _ => Err((StatusCode::BAD_REQUEST, "Kategori tidak dikenal".into())),
    }
}

#[derive(Deserialize)]
struct Callback {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct Token {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    #[serde(default)]
    scope: Option<String>,
}

fn granted_gmail_modify(scope: Option<&str>) -> Option<bool> {
    scope.map(|value| value.split_ascii_whitespace().any(|part| part == "https://www.googleapis.com/auth/gmail.modify"))
}

fn refreshed_gmail_grant(previous: Option<bool>, scope: Option<&str>) -> Option<bool> {
    granted_gmail_modify(scope).or(previous)
}


fn provider_http_client() -> reqwest::Client {
    reqwest::Client::builder().connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30)).build().expect("HTTP client tidak dapat dibuat")
}

fn application_document() -> impl axum::response::IntoResponse {
    ([(header::CACHE_CONTROL, "no-store"), (header::X_FRAME_OPTIONS, "DENY"),
      (header::CONTENT_SECURITY_POLICY, "frame-ancestors 'none'")], Html(include_str!("aurora-dist/index.html")))
}

async fn request_token(client: &reqwest::Client, url: &str, form: &[(&str, &str)]) -> Result<Token, String> {
    let response = client.post(url).form(form).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?;
    serde_json::from_value(bounded_gmail_json(response, 65_536).await?).map_err(|e| e.to_string())
}

#[tokio::main]
async fn main() {
    let google = load_config("config/google.json");
    let microsoft = load_config("config/microsoft.json");
    let account_file = std::path::PathBuf::from("config/accounts.json");
    let saved = persistence::load(&account_file).expect("Gagal membaca daftar akun; file tidak diubah");
    let mut restored = HashMap::new();
    for item in saved {
        let token = persistence::lookup(&item.id).expect("OS keyring tidak tersedia; buka keyring dahulu");
        restored.insert(item.id.clone(), Account {
            id: item.id, email: item.email, provider: item.provider,
            access_token: String::new(), refresh_token: token, expires: Instant::now(), gmail_modify: None,
        });
    }
    let state = AppState {
        http: provider_http_client(),
        gmail_base: "https://gmail.googleapis.com/gmail/v1/users/me".into(),
        attachment_transfers: Arc::new(Semaphore::new(2)),
        accounts: Arc::new(RwLock::new(restored)),
        pending: Arc::new(Mutex::new(HashMap::new())),
        refresh_lock: Arc::new(Mutex::new(())),
        submissions: Arc::new(Mutex::new(HashMap::new())),
        google_id: google.client_id,
        google_secret: google.client_secret.unwrap_or_default(),
        microsoft_id: microsoft.client_id,
        account_file,
    };
    let app = Router::new()
        .route("/", get(|| async { application_document() }))
        .route("/assets/{*path}", get(embedded_asset))
        .route("/icon/sela_aurora_app_icon.svg", get(|| async { ([(header::CONTENT_TYPE, "image/svg+xml")], include_str!("../frontend/public/icon/sela_aurora_app_icon.svg")) }))
        .route("/auth/{provider}", get(auth))
        .route("/callback/{provider}", get(callback))
        .route("/api/accounts", get(accounts))
        .route("/api/accounts/{id}", axum::routing::delete(disconnect))
        .route("/api/inbox/{id}", get(inbox))
        .route("/api/message/{account_id}", get(message_detail))
        .route("/api/message/{account_id}/attachment", get(message_attachment))
        .route("/api/draft/{account_id}", get(draft_detail))
        .route("/api/message/{account_id}/read", post(mark_read))
        .route("/api/message/{account_id}/action", post(message_action))
        .route("/api/compose/{account_id}", post(compose_message).layer(axum::extract::DefaultBodyLimit::max(27_000_000)))
        .with_state(state);
    let address: SocketAddr = "127.0.0.1:3000".parse().unwrap();
    println!("Buka http://{address}");
    axum::serve(tokio::net::TcpListener::bind(address).await.unwrap(), app)
        .await
        .unwrap();
}

fn config<'a>(state: &'a AppState, provider: &str) -> AppResult<(&'a str, Option<&'a str>, &'static str, &'static str, &'static str)> {
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

fn redirect_uri(provider: &str) -> String {
    // Microsoft menerima HTTP localhost di portal; HTTP 127.0.0.1 perlu edit manifest.
    let host = if provider == "microsoft" { "localhost" } else { "127.0.0.1" };
    format!("http://{host}:3000/callback/{provider}")
}

fn random_key() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn check_local_origin(headers: &HeaderMap) -> AppResult<()> {
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

async fn auth(Path(provider): Path<String>, Query(query): Query<AuthQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<Redirect> {
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

async fn callback(Path(provider): Path<String>, Query(query): Query<Callback>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<Redirect> {
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

fn saved_account(account: &Account) -> persistence::SavedAccount {
    persistence::SavedAccount { id: account.id.clone(), email: account.email.clone(), provider: account.provider.clone() }
}

async fn disconnect(Path(id): Path<String>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<StatusCode> {
    check_local_origin(&headers)?;
    let _guard = state.refresh_lock.lock().await;
    let mut accounts = state.accounts.write().await;
    if !accounts.contains_key(&id) { return Err((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into())); }
    let saved: Vec<_> = accounts.values().map(saved_account).collect();
    persistence::disconnect_account(&state.account_file, &saved, &id, persistence::remove)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Akun tidak dapat diputus: {e}")))?;
    accounts.remove(&id);
    Ok(StatusCode::NO_CONTENT)
}

fn network_error(error: reqwest::Error) -> (StatusCode, String) {
    (StatusCode::BAD_GATEWAY, format!("Provider email gagal: {error}"))
}

async fn accounts(State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(&headers)?;
    let mut list: Vec<_> = state.accounts.read().await.values().map(|account| AccountView {
        id: account.id.clone(), email: account.email.clone(), provider: account.provider.clone(),
        reconnect: account.refresh_token.is_none(), gmail_modify: account.gmail_modify,
    }).collect();
    list.sort_by(|a, b| a.email.cmp(&b.email));
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(list)))
}

async fn inbox(Path(id): Path<String>, Query(query): Query<InboxQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
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

async fn fetch_messages(state: &AppState, account: Account, mailbox: &str, category: &str, search: &str, page: Option<&str>) -> Result<(Vec<Message>, Option<String>), String> {
    // shortcut: Outlook categories/starred/all-mail and pagination lack Gmail equivalents; add Graph-specific APIs when needed.
    if account.provider == "microsoft" && (mailbox == "starred" || mailbox == "important" || mailbox == "allmail" || (mailbox == "inbox" && !matches!(category, "all" | "primary"))) { return Ok((vec![], None)); }
    let account = refresh_account(state, account).await?;
    if account.provider == "google" { google_messages(state, &account, mailbox, category, search, page).await }
    else if page.is_some() { Err("Paginasi Outlook belum didukung".into()) }
    else { microsoft_messages(state, &account, mailbox, search).await.map(|messages| (messages, None)) }
}

async fn refresh_account(state: &AppState, account: Account) -> Result<Account, String> {
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

async fn mark_read(Path(account_id): Path<String>, State(state): State<AppState>, headers: HeaderMap, Json(message): Json<MessageQuery>) -> AppResult<StatusCode> {
    check_local_origin(&headers)?;
    if message.id.is_empty() || message.id.len() > 512 {
        return Err((StatusCode::BAD_REQUEST, "ID pesan tidak valid".into()));
    }
    let account = state.accounts.read().await.get(&account_id).cloned()
        .ok_or((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into()))?;
    let account = refresh_account(&state, account).await.map_err(|error| (StatusCode::BAD_GATEWAY, error))?;
    let response = if account.provider == "google" {
        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}/modify", message.id);
        state.http.post(url).bearer_auth(&account.access_token)
            .json(&serde_json::json!({"removeLabelIds": ["UNREAD"]}))
            .send().await
    } else {
        let id = url::form_urlencoded::byte_serialize(message.id.as_bytes()).collect::<String>();
        let url = format!("https://graph.microsoft.com/v1.0/me/messages/{id}");
        state.http.patch(url).bearer_auth(&account.access_token)
            .json(&serde_json::json!({"isRead": true}))
            .send().await
    }.map_err(network_error)?;
    response.error_for_status().map_err(network_error)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn message_action(Path(account_id): Path<String>, State(state): State<AppState>, headers: HeaderMap, Json(message): Json<ActionQuery>) -> AppResult<StatusCode> {
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
    let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}/{}", message.id, endpoint);
    let mut request = state.http.post(url).bearer_auth(&account.access_token);
    if endpoint == "modify" { request = request.json(&serde_json::json!({"addLabelIds": add, "removeLabelIds": remove})); }
    let response = request.send().await.map_err(network_error)?;
    gmail_json(response).await.map_err(|error| (StatusCode::BAD_GATEWAY, error))?;
    Ok(StatusCode::NO_CONTENT)
}

fn validate_draft(draft: &serde_json::Value, expected: &str) -> AppResult<()> {
    if draft["message"]["id"].as_str() != Some(expected) { return Err((StatusCode::CONFLICT,"Draf berubah di Gmail. Buka ulang sebelum mengedit.".into())); }
    fn supported(node: &serde_json::Value, depth: usize, counts: &mut [usize;3]) -> bool {
        if depth>30 { return false; }
        let Ok(parts) = attachments::inspect(node) else {return false;};
        if let Some(file) = parts.attachments.iter().find(|file| file.part=="root") {
            counts[2]+=1;
            return file.available;
        }
        match node["mimeType"].as_str().unwrap_or("") {
            "text/plain" => {counts[0]+=1; node["parts"].as_array().is_none_or(Vec::is_empty)},
            "text/html" => {counts[1]+=1; node["parts"].as_array().is_none_or(Vec::is_empty)},
            "multipart/mixed" | "multipart/alternative" | "multipart/related" => {
                !node["body"]["data"].is_string() && !node["body"]["attachmentId"].is_string()
                    && node["parts"].as_array().is_some_and(|children| !children.is_empty() && children.iter().all(|part| supported(part,depth+1,counts)))
            },
            _ => false,
        }
    }
    let payload=&draft["message"]["payload"];
    let mut counts=[0;3];
    // ponytail: HTML-only conversion and multi-body reconstruction need a lossless editor; use Gmail until then.
    if !supported(payload,0,&mut counts) || counts[0]!=1 || counts[1]>1 || attachments::inspect(payload).map_or(true,|parts| parts.attachments.len()!=counts[2]) {
        return Err((StatusCode::UNPROCESSABLE_ENTITY,"Struktur draf tidak didukung editor tanpa kehilangan isi. Edit di Gmail.".into()));
    }
    Ok(())
}
async fn gmail_draft(state: &AppState, account: &Account, id: &str) -> AppResult<serde_json::Value> {
    if !valid_gmail_message_id(id) { return Err((StatusCode::BAD_REQUEST,"ID draf tidak valid".into())); }
    let response = state.http.get(format!("{}/drafts/{id}",state.gmail_base)).query(&[("format","full")]).bearer_auth(&account.access_token).timeout(Duration::from_secs(30)).send().await.map_err(|_| (StatusCode::BAD_GATEWAY,"Draf belum dapat dimuat".into()))?;
    bounded_gmail_json(response,40_000_000).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Draf belum dapat dimuat".into()))
}
async fn draft_detail(Path(account_id): Path<String>, Query(query): Query<AttachmentQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(&headers)?;
    if !valid_gmail_message_id(&query.message_id) {return Err((StatusCode::BAD_REQUEST,"ID pesan tidak valid".into()));}
    let _permit = state.attachment_transfers.try_acquire().map_err(|_| (StatusCode::TOO_MANY_REQUESTS,"Transfer sedang sibuk".into()))?;
    let account = state.accounts.read().await.get(&account_id).cloned().ok_or((StatusCode::NOT_FOUND,"Akun tidak ditemukan".into()))?;
    if account.provider!="google" {return Err((StatusCode::NOT_IMPLEMENTED,"Draf Outlook belum didukung".into()));}
    let account = refresh_account(&state,account).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Izin akun belum dapat diperiksa".into()))?;
    if account.gmail_modify!=Some(true) {return Err((StatusCode::FORBIDDEN,"Izin Gmail belum terverifikasi".into()));}
    let mut page = String::new();
    for _ in 0..100 {
        let response = state.http.get(format!("{}/drafts",state.gmail_base)).query(&[("maxResults","500"),("pageToken",page.as_str())]).bearer_auth(&account.access_token).timeout(Duration::from_secs(30)).send().await.map_err(|_| (StatusCode::BAD_GATEWAY,"Daftar draf gagal dimuat".into()))?;
        let list = bounded_gmail_json(response,2_000_000).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Daftar draf tidak valid".into()))?;
        if let Some(found) = list["drafts"].as_array().and_then(|rows| rows.iter().find(|row| row["message"]["id"].as_str()==Some(query.message_id.as_str()))) {
            let id = found["id"].as_str().ok_or((StatusCode::BAD_GATEWAY,"ID draf tidak tersedia".into()))?;
            let draft = gmail_draft(&state,&account,id).await?; validate_draft(&draft,&query.message_id)?;
            let payload = &draft["message"]["payload"]; let parts = attachments::inspect(payload).map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"MIME draf tidak didukung".into()))?;
            let mut body = String::new();
            if let Some(path) = &parts.plain {
                let node = attachments::resolve(payload,path).map_err(|_| (StatusCode::BAD_GATEWAY,"Bagian draf tidak valid".into()))?;
                body = String::from_utf8(gmail_part_bytes(&state,&account,&query.message_id,node,1_000_000).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Isi draf gagal dimuat".into()))?).map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"Draf bukan UTF-8; edit di Gmail".into()))?;
            }
            let to = attachments::header(payload,"To"); let cc = attachments::header(payload,"Cc"); let bcc = attachments::header(payload,"Bcc"); let subject = attachments::header(payload,"Subject");
            // Validate every recipient before offering editing; unsupported display-name syntax fails closed.
            compose_raw(&account.email,&to,&subject,&body,None,(!cc.is_empty()).then_some(cc.as_str()),(!bcc.is_empty()).then_some(bcc.as_str())).map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"Alamat atau subjek draf tidak didukung editor. Edit di Gmail.".into()))?;
            return Ok(([(header::CACHE_CONTROL,"no-store")],Json(serde_json::json!({"draft_id":id,"message_id":query.message_id,"to":to,"cc":cc,"bcc":bcc,"subject":subject,"body":body,"html_only":parts.plain.is_none() && parts.html.is_some(),"attachments":parts.attachments}))));
        }
        let next = list["nextPageToken"].as_str().unwrap_or(""); if next.is_empty() {break;} if next==page || next.len()>4096 {return Err((StatusCode::BAD_GATEWAY,"Kursor draf tidak valid".into()));} page=next.into();
    }
    Err((StatusCode::NOT_FOUND,"Draf tidak ditemukan; buka ulang folder Draf".into()))
}

async fn compose_message(Path(account_id): Path<String>, State(state): State<AppState>, request: axum::extract::Request) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(request.headers())?;
    let _permit = state.attachment_transfers.try_acquire().map_err(|_| (StatusCode::TOO_MANY_REQUESTS,"Transfer sedang sibuk".into()))?;
    let (message, mut files) = read_compose(request).await?;
    let mode = message.mode.as_deref().unwrap_or("new");
    compose_request_valid(mode, message.message_id.as_deref(), message.submission_id.as_deref(), message.draft_reply)?;
    let account = state.accounts.read().await.get(&account_id).cloned()
        .ok_or((StatusCode::NOT_FOUND, "Akun tidak ditemukan".into()))?;
    if account.provider != "google" { return Err((StatusCode::NOT_IMPLEMENTED, "Pengiriman Outlook belum didukung".into())); }
    let account = refresh_account(&state, account).await.map_err(|_| (StatusCode::FAILED_DEPENDENCY, "Persiapan akun gagal; pesan belum dikirim".into()))?;
    if account.gmail_modify != Some(true) { return Err((StatusCode::FORBIDDEN, "Izin Gmail belum terverifikasi".into())); }
    let existing_draft = if let Some(id) = &message.draft_id {
        let draft = gmail_draft(&state,&account,id).await.map_err(|(_,reason)| (StatusCode::FAILED_DEPENDENCY,reason))?;
        let expected = message.expected_message_id.as_deref().ok_or((StatusCode::BAD_REQUEST,"Revisi draf wajib diisi".into()))?;
        validate_draft(&draft,expected).map_err(|(status,reason)| (if status==StatusCode::CONFLICT {StatusCode::FAILED_DEPENDENCY} else {status},reason))?;
        if message.message_id.as_deref()!=Some(expected) {return Err((StatusCode::BAD_REQUEST,"Sumber draf tidak cocok".into()));}
        Some(draft)
    } else {None};
    let (thread, reply_header) = if let Some(draft) = &existing_draft {
        let original = attachments::header(&draft["message"]["payload"],"In-Reply-To");
        (draft["message"]["threadId"].as_str().filter(|id| valid_gmail_message_id(id)).map(str::to_owned),(!original.is_empty()).then_some(original))
    } else if let Some(id) = message.message_id.as_deref() {
        let url = format!("{}/messages/{id}",state.gmail_base);
        let source = bounded_gmail_json(state.http.get(url).query(&[("format", "metadata")]).bearer_auth(&account.access_token)
            .timeout(Duration::from_secs(30)).send().await.map_err(|_| (StatusCode::FAILED_DEPENDENCY,"Pesan sumber belum dapat dimuat; belum dikirim".into()))?,1_000_000)
            .await.map_err(|_| (StatusCode::FAILED_DEPENDENCY,"Metadata sumber gagal disiapkan; pesan belum dikirim".into()))?;
        if matches!(mode, "reply" | "replyAll") || message.draft_reply {
            let (thread, header) = reply_metadata(&source).map_err(|(_,reason)| (StatusCode::FAILED_DEPENDENCY,reason))?;
            (Some(thread), Some(header))
        } else {
            (source["threadId"].as_str().filter(|value| valid_gmail_message_id(value)).map(str::to_owned), None)
        }
    } else { (None, None) };
    if message.retained.len()+files.len() > attachments::MAX_FILES { return Err((StatusCode::BAD_REQUEST,"Terlalu banyak lampiran".into())); }
    let mut seen = std::collections::HashSet::new();
    let mut total: usize = files.iter().map(|file| file.bytes.len()).sum();
    for reference in &message.retained {
        if Some(reference.message_id.as_str()) != message.message_id.as_deref() || !valid_gmail_message_id(&reference.message_id) || !seen.insert((&reference.message_id,&reference.part)) {
            return Err((StatusCode::BAD_REQUEST,"Sumber lampiran tidak sesuai pesan".into()));
        }
        let source = gmail_full(&state,&account,&reference.message_id).await.map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"Lampiran sumber belum dapat disiapkan".into()))?;
        let parts = attachments::inspect(&source["payload"]).map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"MIME sumber tidak didukung".into()))?;
        let descriptor = parts.attachments.iter().find(|part| part.part == reference.part).ok_or((StatusCode::BAD_REQUEST,"Lampiran sumber tidak ditemukan".into()))?;
        let node = attachments::resolve(&source["payload"],&reference.part).map_err(|_| (StatusCode::BAD_REQUEST,"Bagian lampiran tidak valid".into()))?;
        let bytes = gmail_part_bytes(&state,&account,&reference.message_id,node,attachments::MAX_FILE_BYTES.saturating_sub(total)).await.map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"Lampiran sumber gagal disiapkan; pesan belum dikirim".into()))?;
        total += bytes.len();
        files.push(attachments::Upload { filename:descriptor.filename.clone(),mime_type:descriptor.mime_type.clone(),bytes,content_id:None });
    }
    let raw = compose_raw(&account.email, &message.to, &message.subject, &message.body, reply_header.as_deref(), message.cc.as_deref(), message.bcc.as_deref())?;
    let mut preserved_html = None;
    if let Some(draft) = &existing_draft {
        let payload = &draft["message"]["payload"];
        let parts = attachments::inspect(payload).map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"MIME draf tidak didukung".into()))?;
        let original_plain = if let Some(path) = &parts.plain { Some(gmail_part_bytes(&state,&account,message.expected_message_id.as_deref().unwrap(),attachments::resolve(payload,path).unwrap(),1_000_000).await.map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"Isi draf belum dapat disiapkan".into()))?) } else {None};
        if parts.plain.is_none() && parts.html.is_some() && !message.convert_html {return Err((StatusCode::UNPROCESSABLE_ENTITY,"Konversi draf HTML memerlukan persetujuan".into()));}
        if !message.convert_html && original_plain.as_deref()==Some(message.body.as_bytes()) {
            if let Some(path) = &parts.html {
                let bytes = gmail_part_bytes(&state,&account,message.expected_message_id.as_deref().unwrap(),attachments::resolve(payload,path).unwrap(),1_000_000).await.map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"HTML draf gagal disiapkan".into()))?;
                preserved_html = Some(String::from_utf8(bytes).map_err(|_| (StatusCode::UNPROCESSABLE_ENTITY,"HTML bukan UTF-8".into()))?);
            }
        }
        if preserved_html.is_some() {
            for (file,reference) in files.iter_mut().skip(message.files.len()).zip(&message.retained) {
                file.content_id = parts.attachments.iter().find(|part| part.part==reference.part && part.inline).and_then(|part| part.content_id.clone());
            }
        }
    }
    let raw = attachments::with_files(&raw,&files,preserved_html.as_deref()).map_err(|error| (StatusCode::BAD_REQUEST,error))?;
    let url = match (&message.draft_id,mode) {
        (Some(id),"draft") => format!("{}/drafts/{id}",state.gmail_base),
        (Some(_),_) => format!("{}/drafts/send",state.gmail_base),
        _ => format!("{}/{}",state.gmail_base,if mode == "draft" {"drafts"} else {"messages/send"}),
    };
    let thread = if existing_draft.is_some() {thread.as_deref()} else {compose_thread(mode, message.draft_reply, thread.as_deref())};
    let payload = if existing_draft.is_some() || mode == "draft" { serde_json::json!({"id":message.draft_id,"message": {"raw": raw, "threadId": thread}}) }
        else { serde_json::json!({"raw": raw, "threadId": thread}) };
    let submission_key = message.submission_id.as_ref().filter(|_| mode != "draft").map(|id| format!("{account_id}:{id}"));
    if let Some(key) = &submission_key { reserve_submission(&mut *state.submissions.lock().await, key)?; }
    let request = if mode=="draft" && existing_draft.is_some() {state.http.put(url)} else {state.http.post(url)};
    let response = bounded_gmail_json(request.bearer_auth(&account.access_token).json(&payload).timeout(Duration::from_secs(30))
        .send().await.map_err(|_| (StatusCode::BAD_GATEWAY,"Gmail belum mengonfirmasi penyimpanan/pengiriman".into()))?,1_000_000).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Gmail belum mengonfirmasi penyimpanan/pengiriman".into()))?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({"id": compose_result_id(&response)?,"message_id":response["message"]["id"]}))))
}

async fn message_detail(Path(account_id): Path<String>, Query(message): Query<MessageQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
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

async fn bounded_gmail_json(mut response: reqwest::Response, limit: usize) -> Result<serde_json::Value, String> {
    if !response.status().is_success() { return Err(format!("Gmail menolak permintaan ({})", response.status().as_u16())); }
    if response.content_length().is_some_and(|n| n > limit as u64) { return Err("Respons Gmail melebihi batas".into()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Respons Gmail terputus")? {
        if chunk.len() > limit.saturating_sub(bytes.len()) { return Err("Respons Gmail melebihi batas".into()); }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Respons Gmail tidak valid".into())
}

fn attachment_headers(name: &str, size: usize) -> AppResult<HeaderMap> {
    let safe = attachments::safe_filename(name);
    let fallback: String = safe.chars().map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.'|'_'|'-'|' ') {c} else {'_'}).collect();
    let encoded: String = safe.as_bytes().iter().map(|b| if b.is_ascii_alphanumeric() || matches!(b, b'.'|b'_'|b'-') { (*b as char).to_string() } else { format!("%{b:02X}") }).collect();
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "application/octet-stream".parse().unwrap());
    headers.insert(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}").parse().map_err(|_| (StatusCode::BAD_GATEWAY,"Nama lampiran tidak valid".into()))?);
    headers.insert(header::CONTENT_LENGTH, size.to_string().parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
    headers.insert(header::CONTENT_SECURITY_POLICY, "default-src 'none'; sandbox".parse().unwrap());
    Ok(headers)
}

async fn gmail_full(state: &AppState, account: &Account, message: &str) -> Result<serde_json::Value, String> {
    let response = state.http.get(format!("{}/messages/{message}",state.gmail_base)).query(&[("format","full")])
        .timeout(Duration::from_secs(30)).bearer_auth(&account.access_token).send().await.map_err(|_| "Gmail tidak dapat dihubungi")?;
    bounded_gmail_json(response, 40_000_000).await
}

async fn gmail_part_bytes(state: &AppState, account: &Account, message: &str, part: &serde_json::Value, limit: usize) -> Result<Vec<u8>, String> {
    let size = part["body"]["size"].as_u64().and_then(|n| usize::try_from(n).ok()).ok_or("Ukuran lampiran tidak tersedia")?;
    if size > limit { return Err("Lampiran melebihi batas ukuran".into()); }
    if let Some(data) = part["body"]["data"].as_str() { return attachments::decode(data,size,limit); }
    let id = part["body"]["attachmentId"].as_str().filter(|id| valid_gmail_message_id(id)).ok_or("Lampiran tidak tersedia")?;
    let response = state.http.get(format!("{}/messages/{message}/attachments/{id}",state.gmail_base))
        .timeout(Duration::from_secs(30)).bearer_auth(&account.access_token).send().await.map_err(|_| "Gmail tidak dapat dihubungi")?;
    let value = bounded_gmail_json(response, limit.div_ceil(3)*4+4096).await?;
    if value["size"].as_u64() != Some(size as u64) { return Err("Ukuran lampiran tidak sesuai".into()); }
    attachments::decode(value["data"].as_str().ok_or("Lampiran tidak tersedia")?,size,limit)
}

async fn message_attachment(Path(account_id): Path<String>, Query(query): Query<AttachmentQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(&headers)?;
    if !valid_gmail_message_id(&query.message_id) { return Err((StatusCode::BAD_REQUEST,"ID pesan tidak valid".into())); }
    let _permit = state.attachment_transfers.try_acquire().map_err(|_| (StatusCode::TOO_MANY_REQUESTS,"Transfer lampiran sedang penuh; coba lagi".into()))?;
    let account = state.accounts.read().await.get(&account_id).cloned().ok_or((StatusCode::NOT_FOUND,"Akun tidak ditemukan".into()))?;
    if account.provider != "google" { return Err((StatusCode::NOT_IMPLEMENTED,"Lampiran Outlook belum didukung".into())); }
    let account = refresh_account(&state,account).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Izin akun belum dapat diperiksa".into()))?;
    let value = gmail_full(&state,&account,&query.message_id).await.map_err(|e| (StatusCode::BAD_GATEWAY,e))?;
    let parts = attachments::inspect(&value["payload"]).map_err(|e| (StatusCode::BAD_GATEWAY,e))?;
    let file = parts.attachments.iter().find(|a| a.part == query.part).ok_or((StatusCode::NOT_FOUND,"Lampiran tidak ditemukan pada pesan ini".into()))?;
    let part = attachments::resolve(&value["payload"],&query.part).map_err(|e| (StatusCode::BAD_REQUEST,e))?;
    let bytes = gmail_part_bytes(&state,&account,&query.message_id,part,attachments::MAX_FILE_BYTES).await.map_err(|e| (StatusCode::BAD_GATEWAY,e))?;
    Ok((attachment_headers(&file.filename,bytes.len())?,bytes))
}

#[cfg(test)]
fn decode_body(encoded: &str) -> Result<String, String> {
    let bytes = URL_SAFE_NO_PAD.decode(encoded.trim_end_matches('=')).map_err(|_| "Isi email tidak dapat dibaca".to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[cfg(test)]
fn google_body(payload: &serde_json::Value, mime: &str) -> Option<String> {
    if payload["filename"].as_str().is_some_and(|name| !name.is_empty()) || attachments::header(payload,"Content-Disposition").to_ascii_lowercase().starts_with("attachment") || payload["mimeType"].as_str() == Some("message/rfc822") { return None; }
    if payload["mimeType"].as_str() == Some(mime) {
        if let Some(data) = payload["body"]["data"].as_str() {
            if let Ok(body) = decode_body(data) { return Some(body); }
        }
    }
    payload["parts"].as_array()?.iter().find_map(|part| google_body(part, mime))
}

async fn google_detail(state: &AppState, account: &Account, id: &str) -> Result<MessageDetail, String> {
    let _permit = state.attachment_transfers.try_acquire().map_err(|_| "Transfer lampiran sedang penuh; coba lagi")?;
    let value = gmail_full(state,account,id).await?;
    let parts = attachments::inspect(&value["payload"])?;
    let mut bodies = Vec::new();
    for path in [&parts.plain,&parts.html] {
        let text = if let Some(path) = path {
            let part = attachments::resolve(&value["payload"],path)?;
            let bytes = gmail_part_bytes(state,account,id,part,1_000_000).await?;
            Some(String::from_utf8_lossy(&bytes).into_owned())
        } else { None };
        bodies.push(text);
    }
    let header = |name: &str| gmail_header(&value, name);
    Ok(MessageDetail {
        account_id:account.id.clone(), message_id:id.into(), attachments:parts.attachments,
        sender: header("From"), recipient: header("To"), cc: header("Cc"), subject: header("Subject"),
        received: chrono::DateTime::from_timestamp_millis(value["internalDate"].as_str().unwrap_or("0").parse::<i64>().unwrap_or(0))
            .map(|date| date.to_rfc3339()).unwrap_or_default(),
        body: bodies[0].take().unwrap_or_default(),
        html: bodies[1].take(),
        url: format!("https://mail.google.com/mail/u/?authuser={}#all/{id}", url::form_urlencoded::byte_serialize(account.email.as_bytes()).collect::<String>()),
    })
}

async fn microsoft_detail(state: &AppState, account: &Account, id: &str) -> Result<MessageDetail, String> {
    let url = format!("https://graph.microsoft.com/v1.0/me/messages/{}", url::form_urlencoded::byte_serialize(id.as_bytes()).collect::<String>());
    let response = state.http.get(url).query(&[("$select", "from,toRecipients,subject,body,receivedDateTime,webLink")])
        .header("Prefer", "outlook.body-content-type=\"text\"")
        .bearer_auth(&account.access_token).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?
        .json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    let recipients = response["toRecipients"].as_array().into_iter().flatten()
        .filter_map(|item| item["emailAddress"]["address"].as_str()).collect::<Vec<_>>().join(", ");
    Ok(MessageDetail {
        account_id:account.id.clone(), message_id:id.into(), attachments:Vec::new(),
        sender: response["from"]["emailAddress"]["address"].as_str().unwrap_or("").to_owned(),
        recipient: recipients, cc: String::new(), subject: response["subject"].as_str().unwrap_or("").to_owned(),
        received: response["receivedDateTime"].as_str().unwrap_or("").to_owned(),
        body: if response["body"]["contentType"].as_str().is_some_and(|t| t.eq_ignore_ascii_case("text")) {
            response["body"]["content"].as_str().unwrap_or("").to_owned()
        } else { String::new() },
        html: if response["body"]["contentType"].as_str().is_some_and(|t| t.eq_ignore_ascii_case("html")) {
            response["body"]["content"].as_str().map(str::to_owned)
        } else { None },
        url: response["webLink"].as_str().unwrap_or("").to_owned(),
    })
}

fn gmail_error(status: reqwest::StatusCode, body: &serde_json::Value) -> String {
    let reason = body["error"]["details"].as_array().into_iter().flatten()
        .find_map(|detail| detail["reason"].as_str())
        .or_else(|| body["error"]["errors"][0]["reason"].as_str());
    let hint = match reason {
        Some("SERVICE_DISABLED" | "accessNotConfigured") => " Aktifkan Gmail API di Google Cloud project yang memiliki OAuth Client ID ini, lalu coba lagi.",
        Some("ACCESS_TOKEN_SCOPE_INSUFFICIENT" | "insufficientPermissions") => " Izin gmail.readonly belum diberikan; hubungkan ulang akun Google.",
        _ => "",
    };
    let detail = body["error"]["message"].as_str().unwrap_or("Gmail API menolak permintaan");
    format!("Gmail API {status}: {detail}{hint}")
}

async fn gmail_json(response: reqwest::Response) -> Result<serde_json::Value, String> {
    let status = response.status();
    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(gmail_error(status, &body)); }
    Ok(body)
}

async fn google_messages(state: &AppState, account: &Account, mailbox: &str, category: &str, search: &str, page: Option<&str>) -> Result<(Vec<Message>, Option<String>), String> {
    let query = google_mailbox_query(mailbox, category, search);
    let mut request = state.http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages")
        .query(&[("maxResults", "30"), ("q", query.as_str())]);
    if gmail_include_spam_trash(mailbox) { request = request.query(&[("includeSpamTrash", "true")]); }
    let label = match mailbox {
        "sent" => Some("SENT"), "inbox" => Some("INBOX"), "drafts" => Some("DRAFT"),
        "starred" => Some("STARRED"), "important" => Some("IMPORTANT"),
        "spam" => Some("SPAM"), "trash" => Some("TRASH"), _ => None,
    };
    if let Some(label) = label { request = request.query(&[("labelIds", label)]); }
    if let Some(page) = page { request = request.query(&[("pageToken", page)]); }
    let list = gmail_json(request.bearer_auth(&account.access_token).send().await.map_err(|e| e.to_string())?).await?;
    let ids: Vec<String> = list["messages"].as_array().into_iter().flatten()
        .filter_map(|v| v["id"].as_str().map(str::to_owned)).collect();
    let mut messages = Vec::new();
    let mut results = futures::stream::iter(ids.into_iter().map(|id| async move {
        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}");
        let value = gmail_json(state.http.get(url).query(&[("format", "metadata")])
            .bearer_auth(&account.access_token).send().await.map_err(|e| e.to_string())?).await?;
        if !gmail_message_matches(&value, mailbox, category) { return Ok(None); }
        let header = |name: &str| gmail_header(&value, name);
        Ok::<_, String>(Some(Message {
            id: id.clone(), account_id: account.id.clone(), recipient: header("To"),
            sender: header("From"), subject: header("Subject"),
            snippet: value["snippet"].as_str().unwrap_or("").to_owned(),
            received: chrono::DateTime::from_timestamp_millis(value["internalDate"].as_str().unwrap_or("0").parse::<i64>().unwrap_or(0))
                .map(|date| date.to_rfc3339()).unwrap_or_default(),
            unread: value["labelIds"].as_array().into_iter().flatten().any(|v| v.as_str() == Some("UNREAD")),
            starred: value["labelIds"].as_array().into_iter().flatten().any(|v| v.as_str() == Some("STARRED")),
            url: format!("https://mail.google.com/mail/u/?authuser={}#all/{id}", url::form_urlencoded::byte_serialize(account.email.as_bytes()).collect::<String>()),
        }))
    })).buffer_unordered(5);
    while let Some(result) = results.next().await {
        if let Some(message) = result? { messages.push(message); }
    }
    Ok((messages, list["nextPageToken"].as_str().map(str::to_owned)))
}

async fn microsoft_messages(state: &AppState, account: &Account, mailbox: &str, search: &str) -> Result<Vec<Message>, String> {
    let url = format!("https://graph.microsoft.com/v1.0/me/mailFolders/{}/messages", microsoft_mailbox_path(mailbox));
    let request = state.http.get(url)
        .query(&[("$top", "30"), ("$select", "id,from,subject,bodyPreview,receivedDateTime,isRead,webLink"), ("$orderby", "receivedDateTime desc")]);
    if !search.is_empty() {
        // Graph search is not a drop-in for Gmail's search grammar; avoid silently returning wrong results.
        return Err("Pencarian Outlook belum didukung; gunakan pencarian akun Google atau buka Outlook.".into());
    }
    let response: serde_json::Value = request
        .bearer_auth(&account.access_token).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    Ok(response["value"].as_array().into_iter().flatten().map(|v| Message {
        id: v["id"].as_str().unwrap_or("").to_owned(), account_id: account.id.clone(),
        recipient: account.email.clone(),
        sender: v["from"]["emailAddress"]["address"].as_str().unwrap_or("").to_owned(),
        subject: v["subject"].as_str().unwrap_or("").to_owned(),
        snippet: v["bodyPreview"].as_str().unwrap_or("").to_owned(),
        received: v["receivedDateTime"].as_str().unwrap_or("").to_owned(),
        unread: !v["isRead"].as_bool().unwrap_or(true),
        starred: false,
        url: v["webLink"].as_str().unwrap_or("").to_owned(),
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn attachment_test_state(base: String) -> AppState {
        let accounts = ["one", "two"].into_iter().map(|id| (id.into(),Account {
            id:id.into(), email:format!("{id}@example.test"),provider:"google".into(),access_token:format!("synthetic-{id}"),refresh_token:None,
            expires:Instant::now()+Duration::from_secs(3600),gmail_modify:Some(true),
        })).collect();
        AppState {http:reqwest::Client::new(),gmail_base:base,attachment_transfers:Arc::new(Semaphore::new(2)),accounts:Arc::new(RwLock::new(accounts)),pending:Arc::new(Mutex::new(HashMap::new())),refresh_lock:Arc::new(Mutex::new(())),submissions:Arc::new(Mutex::new(HashMap::new())),google_id:String::new(),google_secret:String::new(),microsoft_id:String::new(),account_file:std::path::PathBuf::new()}
    }

    #[test]
    fn application_document_denies_framing() {
        use axum::response::IntoResponse;
        let response = application_document().into_response();
        assert_eq!(response.headers()[header::X_FRAME_OPTIONS], "DENY");
        assert_eq!(response.headers()[header::CONTENT_SECURITY_POLICY], "frame-ancestors 'none'");
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
    }

    #[tokio::test]
    async fn provider_deadline_covers_headers_body_and_releases_refresh_lock() {
        use axum::{body::Body, response::IntoResponse};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let app = Router::new()
            .route("/headers", get(|| async { std::future::pending::<StatusCode>().await }))
            .route("/body", get(|| async {
                Body::from_stream(futures::stream::once(std::future::pending::<Result<String,std::io::Error>>())).into_response()
            }))
            .route("/large", post(|| async { format!("{{\"access_token\":\"{}\"}}", "x".repeat(70_000)) }))
            .route("/token", post(|| async { Json(serde_json::json!({"access_token":"synthetic","expires_in":3600})) }));
        let server = tokio::spawn(async move { axum::serve(listener,app).await.unwrap(); });
        let client = provider_http_client();
        let start = Instant::now();
        let requests = ["headers","body"].map(|path| {
            let client = client.clone();
            async move {
                let state = attachment_test_state(String::new());
                let account = state.accounts.read().await["one"].clone();
                let lock = state.refresh_lock.lock().await;
                let queued = tokio::spawn({ let state=state.clone(); async move { refresh_account(&state,account).await } });
                let result = tokio::time::timeout(Duration::from_secs(32), async {
                    match client.get(format!("http://{address}/{path}")).send().await {
                        Ok(response) => response.bytes().await.map(|_| ()),
                        Err(error) => Err(error),
                    }
                }).await.expect("provider request must have a finite deadline");
                assert!(result.unwrap_err().is_timeout(), "{path} must time out");
                drop(lock);
                assert!(tokio::time::timeout(Duration::from_secs(1),queued).await.unwrap().unwrap().is_ok());
            }
        });
        futures::future::join_all(requests).await;
        assert!(start.elapsed() < Duration::from_secs(32));
        assert_eq!(request_token(&client,&format!("http://{address}/token"),&[]).await.unwrap().access_token,"synthetic");
        assert!(request_token(&client,&format!("http://{address}/large"),&[]).await.err().unwrap().contains("melebihi batas"), "token JSON must be byte-bounded, not rejected by the mock route");
        server.abort();
    }

    #[tokio::test]
    async fn attachment_handler_binds_account_message_and_part_without_live_gmail() {
        use axum::response::IntoResponse;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let app = Router::new().route("/messages/owned",get(|headers:HeaderMap| async move {
            if headers.get(header::AUTHORIZATION).and_then(|h| h.to_str().ok()) != Some("Bearer synthetic-one") { return StatusCode::NOT_FOUND.into_response(); }
            Json(serde_json::json!({"payload":{"mimeType":"multipart/mixed","parts":[
                {"mimeType":"application/pdf","filename":"bytes.pdf","body":{"attachmentId":"external","size":4}},
                {"mimeType":"text/plain","filename":"inline.txt","body":{"data":"AP_-AQ==","size":4}}
            ]}})).into_response()
        })).route("/messages/owned/attachments/external",get(|headers:HeaderMap| async move {
            assert_eq!(headers[header::AUTHORIZATION],"Bearer synthetic-one");
            Json(serde_json::json!({"data":"AP_-AQ","size":4}))
        }));
        let task = tokio::spawn(async move { axum::serve(listener,app).await.unwrap(); });
        let state = attachment_test_state(format!("http://{address}"));
        let mut headers = HeaderMap::new(); headers.insert(header::HOST,"127.0.0.1:3000".parse().unwrap());
        for part in ["0","1"] {
            let response = message_attachment(Path("one".into()),Query(AttachmentQuery{message_id:"owned".into(),part:part.into()}),State(state.clone()),headers.clone()).await.unwrap().into_response();
            assert_eq!(axum::body::to_bytes(response.into_body(),100).await.unwrap().as_ref(),[0,255,254,1]);
        }
        let error = message_attachment(Path("two".into()),Query(AttachmentQuery{message_id:"owned".into(),part:"0".into()}),State(state.clone()),headers.clone()).await.err().unwrap();
        assert_eq!(error.0,StatusCode::BAD_GATEWAY);
        let error = message_attachment(Path("one".into()),Query(AttachmentQuery{message_id:"owned".into(),part:"2".into()}),State(state.clone()),headers.clone()).await.err().unwrap();
        assert_eq!(error.0,StatusCode::NOT_FOUND);
        headers.insert(header::ORIGIN,"https://evil.example.test".parse().unwrap());
        assert_eq!(message_attachment(Path("one".into()),Query(AttachmentQuery{message_id:"owned".into(),part:"0".into()}),State(state),headers).await.err().unwrap().0,StatusCode::FORBIDDEN);
        task.abort();
    }

    #[tokio::test]
    async fn compose_handler_uses_mock_gmail_send_draft_update_and_send_paths() {
        use axum::{response::IntoResponse, body::Body};
        let captured = Arc::new(Mutex::new(Vec::<(String,serde_json::Value)>::new()));
        let sink = captured.clone();
        let payload = serde_json::json!({"mimeType":"multipart/mixed","headers":[{"name":"To","value":"recipient@example.test"},{"name":"Subject","value":"Draft"}],"parts":[{"mimeType":"text/plain","body":{"size":4,"data":"Ym9keQ"}},{"mimeType":"application/octet-stream","filename":"kept.bin","body":{"size":4,"data":"AP_-AQ"}}]});
        let draft = serde_json::json!({"id":"draft1","message":{"id":"msg1","threadId":"thread1","payload":payload}});
        let get_draft = draft.clone(); let get_message = draft["message"].clone();
        let app = Router::new()
            .route("/drafts",get(|| async {Json(serde_json::json!({"drafts":[{"id":"draft1","message":{"id":"msg1"}}]}))}))
            .route("/drafts/draft1",get(move || {let draft=get_draft.clone(); async move {Json(draft)}}))
            .route("/messages/msg1",get(move || {let message=get_message.clone(); async move {Json(message)}}))
            .fallback(move |request:axum::extract::Request| {let sink=sink.clone(); async move {
                assert_eq!(request.headers()[header::AUTHORIZATION],"Bearer synthetic-one");
                let route=format!("{} {}",request.method(),request.uri().path());
                let bytes=axum::body::to_bytes(request.into_body(),2_000_000).await.unwrap();
                sink.lock().await.push((route,serde_json::from_slice(&bytes).unwrap()));
                Json(serde_json::json!({"id":"result1","message":{"id":"msg2"}}))
            }});
        // PUT shares the same path as GET; add its explicit handler using the same captured state.
        let sink=captured.clone();
        let app=app.route("/drafts/draft1",axum::routing::put(move |Json(value):Json<serde_json::Value>| {let sink=sink.clone(); async move {sink.lock().await.push(("PUT /drafts/draft1".into(),value)); Json(serde_json::json!({"id":"draft1","message":{"id":"msg2"}}))}}));
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap(); let address=listener.local_addr().unwrap();
        let task=tokio::spawn(async move {axum::serve(listener,app).await.unwrap()});
        let state=attachment_test_state(format!("http://{address}"));
        let mut headers=HeaderMap::new(); headers.insert(header::HOST,"127.0.0.1:3000".parse().unwrap());
        let detail=draft_detail(Path("one".into()),Query(AttachmentQuery{message_id:"msg1".into(),part:String::new()}),State(state.clone()),headers.clone()).await.unwrap().into_response();
        let body=axum::body::to_bytes(detail.into_body(),10000).await.unwrap();
        let loaded:serde_json::Value=serde_json::from_slice(&body).unwrap(); assert_eq!(loaded["draft_id"],"draft1"); assert_eq!(loaded["attachments"][0]["filename"],"kept.bin");
        for (index, mode) in ["new","draft","new"].into_iter().enumerate() {
            let mut manifest=serde_json::json!({"to":"recipient@example.test","subject":"Test","body":"body","mode":mode,"submission_id":format!("test-{index}"),"message_id":"msg1","retained":[{"message_id":"msg1","part":"1"}]});
            if index>0 {manifest["draft_id"]="draft1".into(); manifest["expected_message_id"]="msg1".into();}
            let request=axum::http::Request::builder().header(header::HOST,"127.0.0.1:3000").header(header::CONTENT_TYPE,"application/json").body(Body::from(manifest.to_string())).unwrap();
            assert_eq!(compose_message(Path("one".into()),State(state.clone()),request).await.unwrap().into_response().status(),StatusCode::CREATED);
        }
        let calls=captured.lock().await;
        assert_eq!(calls.iter().map(|(path,_)|path.as_str()).collect::<Vec<_>>(),["POST /messages/send","PUT /drafts/draft1","POST /drafts/send"]);
        for (_,value) in calls.iter() {
            let raw=value["raw"].as_str().or_else(||value["message"]["raw"].as_str()).unwrap();
            let mime=String::from_utf8(URL_SAFE_NO_PAD.decode(raw).unwrap()).unwrap();
            assert!(mime.contains("kept.bin")); assert!(mime.contains("AP/+AQ=="));
        }
        task.abort();
    }

    #[tokio::test]
    async fn compose_preparation_is_bounded_retryable_and_never_reserves_delivery() {
        use axum::body::Body;
        let app=Router::new()
            .route("/messages/unavailable",get(|| async {StatusCode::SERVICE_UNAVAILABLE}))
            .route("/drafts/unavailable",get(|| async {StatusCode::SERVICE_UNAVAILABLE}))
            .route("/drafts/stale",get(|| async {Json(serde_json::json!({"message":{"id":"latest"}}))}))
            .route("/messages/oversized",get(|| async {format!("{{\"padding\":\"{}\"}}","x".repeat(2_000_000))}))
            .route("/messages/stalled",get(|| async {std::future::pending::<StatusCode>().await}))
            .route("/messages/send",post(|| async {StatusCode::SERVICE_UNAVAILABLE}));
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap(); let address=listener.local_addr().unwrap();
        let task=tokio::spawn(async move {axum::serve(listener,app).await.unwrap()});
        let state=attachment_test_state(format!("http://{address}"));
        for (id,draft) in [("oversized",false),("stalled",false),("unavailable",false),("unavailable",true),("stale",true)] {
            let mut manifest=serde_json::json!({"to":"recipient@example.test","subject":"Retry","body":"keep body","mode":"forward","message_id":id,"submission_id":"retry-test"});
            if draft {manifest["draft_id"]=id.into(); manifest["expected_message_id"]=id.into();}
            let request=axum::http::Request::builder().header(header::HOST,"127.0.0.1:3000").header(header::CONTENT_TYPE,"application/json").body(Body::from(manifest.to_string())).unwrap();
            let error=tokio::time::timeout(Duration::from_secs(32),compose_message(Path("one".into()),State(state.clone()),request)).await.expect("preparation must time out").err().unwrap();
            assert!(state.submissions.lock().await.is_empty(),"preparation must reject {id} before reserving delivery");
            assert_eq!(error.0,StatusCode::FAILED_DEPENDENCY,"{id}, draft={draft}");
            assert_eq!(state.attachment_transfers.available_permits(),2);
        }
        let manifest=serde_json::json!({"to":"recipient@example.test","subject":"Uncertain","body":"body","mode":"new","submission_id":"mutation-test"});
        let request=axum::http::Request::builder().header(header::HOST,"127.0.0.1:3000").header(header::CONTENT_TYPE,"application/json").body(Body::from(manifest.to_string())).unwrap();
        assert_eq!(compose_message(Path("one".into()),State(state.clone()),request).await.err().unwrap().0,StatusCode::BAD_GATEWAY);
        assert!(state.submissions.lock().await.contains_key("one:mutation-test"));
        task.abort();
    }

    #[test]
    fn attachment_download_headers_cannot_inject_or_execute_html() {
        let headers = attachment_headers("../résumé\r\n.html", 4).unwrap();
        assert_eq!(headers[header::CONTENT_TYPE], "application/octet-stream");
        assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
        assert!(headers[header::CONTENT_DISPOSITION].to_str().unwrap().contains("filename*=UTF-8''r%C3%A9sum%C3%A9.html"));
        assert!(headers[header::CONTENT_DISPOSITION].to_str().unwrap().starts_with("attachment;"));
    }

    #[tokio::test]
    async fn bounded_gmail_reads_reject_actual_oversize() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move { axum::serve(listener, Router::new().route("/", get(|| async { "{\"data\":\"too much\"}" }))).await.unwrap(); });
        let response = reqwest::Client::new().get(format!("http://{address}/")).send().await.unwrap();
        assert!(bounded_gmail_json(response, 5).await.is_err());
        task.abort();
    }

    #[test]
    fn text_attachments_are_not_message_bodies() {
        let payload = serde_json::json!({"mimeType":"multipart/mixed","parts":[
            {"mimeType":"text/plain","filename":"private.txt","body":{"data":URL_SAFE_NO_PAD.encode("not body"),"size":8}},
            {"mimeType":"text/plain","body":{"data":URL_SAFE_NO_PAD.encode("body"),"size":4}}
        ]});
        assert_eq!(google_body(&payload,"text/plain").as_deref(),Some("body"));
    }

    #[test]
    fn draft_edit_rejects_stale_identity_and_complex_mime() {
        let draft = serde_json::json!({"id":"draft1","message":{"id":"msg1","payload":{"mimeType":"text/plain","body":{"size":0,"data":""}}}});
        assert!(validate_draft(&draft,"msg1").is_ok());
        assert_eq!(validate_draft(&draft,"old").unwrap_err().0,StatusCode::CONFLICT);
        let complex = serde_json::json!({"message":{"id":"msg1","payload":{"mimeType":"multipart/signed","parts":[]}}});
        assert!(validate_draft(&complex,"msg1").is_err());
        for mime in ["multipart/mixed","multipart/alternative","multipart/related"] {
            let lossy = serde_json::json!({"message":{"id":"msg1","payload":{"mimeType":mime,"parts":[
                {"mimeType":"text/plain","body":{"size":5,"data":"Zmlyc3Q"}},
                {"mimeType":"text/plain","body":{"size":6,"data":"c2Vjb25k"}}
            ]}}});
            assert!(validate_draft(&lossy,"msg1").is_err(),"must not discard a second body in {mime}");
        }
    }

    #[test]
    fn html_only_draft_cannot_be_overwritten_by_empty_conversion() {
        let html_only = serde_json::json!({"message":{"id":"msg1","payload":{"mimeType":"text/html","body":{"size":12,"data":"PHA-SGVsbG88L3A-"}}}});
        assert_eq!(validate_draft(&html_only,"msg1").unwrap_err().0,StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn multipart_compose_keeps_binary_and_rejects_duplicate_fields() {
        use axum::body::Body;
        let manifest = r#"{"to":"a@example.test","subject":"Files","body":"body","files":[{"id":"file0","filename":"x.bin","mime_type":"application/octet-stream","size":4}]}"#;
        let mut bytes = format!("--test\r\nContent-Disposition: form-data; name=\"manifest\"\r\n\r\n{manifest}\r\n--test\r\nContent-Disposition: form-data; name=\"file0\"; filename=\"x.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n").into_bytes();
        bytes.extend_from_slice(&[0,255,254,1]); bytes.extend_from_slice(b"\r\n--test--\r\n");
        let request = axum::http::Request::builder().header(header::CONTENT_TYPE,"multipart/form-data; boundary=test").body(Body::from(bytes)).unwrap();
        let (_,files) = read_compose(request).await.unwrap();
        assert_eq!(files.len(),1); assert_eq!(files[0].bytes,[0,255,254,1]);
        let bad = format!("--test\r\nContent-Disposition: form-data; name=\"manifest\"\r\n\r\n{manifest}\r\n--test--\r\n");
        let request = axum::http::Request::builder().header(header::CONTENT_TYPE,"multipart/form-data; boundary=test").body(Body::from(bad)).unwrap();
        assert!(read_compose(request).await.is_err());
    }

    #[tokio::test]
    async fn embedded_pdf_assets_are_exact_and_never_serve_source_files() {
        use axum::response::IntoResponse;
        for (path, mime) in [("pdf/pdf.worker.min.mjs", "text/javascript"), ("pdf/standard_fonts/LiberationSans-Regular.ttf", "application/octet-stream"), ("pdf/wasm/openjpeg.wasm", "application/wasm")] {
            let response = embedded_asset(Path(path.into())).await.into_response();
            assert_eq!(response.status(), StatusCode::OK, "{path}");
            assert!(response.headers()[header::CONTENT_TYPE].to_str().unwrap().starts_with(mime));
            assert!(!axum::body::to_bytes(response.into_body(), 4_000_000).await.unwrap().is_empty());
        }
        for path in ["../main.rs", "pdf/../../main.rs", "config/google.json", "missing.js"] {
            assert_eq!(embedded_asset(Path(path.into())).await.into_response().status(), StatusCode::NOT_FOUND);
        }
    }

    #[test]
    fn plain_text_mail_body_is_decoded_without_html_execution() {
        let payload = serde_json::json!({"mimeType":"multipart/alternative","parts":[
            {"mimeType":"text/html","body":{"data":URL_SAFE_NO_PAD.encode("<script>bad()</script>")}},
            {"mimeType":"text/plain","body":{"data":URL_SAFE_NO_PAD.encode("Halo dari email")}}
        ]});
        assert_eq!(google_body(&payload, "text/plain").as_deref(), Some("Halo dari email"));
        assert_eq!(google_body(&payload, "text/html").as_deref(), Some("<script>bad()</script>"));
        assert_eq!(google_body(&serde_json::json!({"mimeType":"text/plain","body":{"data":URL_SAFE_NO_PAD.encode("Langsung")}}), "text/plain").as_deref(), Some("Langsung"));
        assert!(google_body(&serde_json::json!({"mimeType":"text/html","body":{"data":"PHNjcmlwdD4="}}), "text/plain").is_none());
    }

    #[test]
    fn failed_account_keeps_cursor_for_retry() {
        let previous = HashMap::from([("one".to_owned(), "opaque-cursor".to_owned())]);
        let mut next = HashMap::new();
        retain_failed_cursor(&mut next, &previous, "one");
        assert_eq!(next.get("one").map(String::as_str), Some("opaque-cursor"));
        retain_failed_cursor(&mut next, &previous, "two");
        assert_eq!(next.len(), 1);
    }

    #[test]
    fn cursor_page_fetches_only_accounts_with_remaining_pages() {
        let cursor = encode_cursor("one", "inbox", "all", "", "next-one");
        let cursors = HashMap::from([("one".to_owned(), cursor)]);
        let pages = inbox_pages(&["one".to_owned(), "two".to_owned()], &cursors, "inbox", "all", "").unwrap();
        assert_eq!(pages, vec![("one".to_owned(), Some("next-one".to_owned()))]);
        assert!(inbox_pages(&["one".to_owned()], &HashMap::new(), "inbox", "all", "").unwrap().len() == 1);
        assert!(inbox_pages(&["two".to_owned()], &cursors, "inbox", "all", "").is_err());
    }

    #[test]
    fn cursor_rejects_cross_account_and_cross_folder_replay() {
        let token = encode_cursor("account-one", "sent", "all", "", "opaque-page-token");
        assert_eq!(decode_cursor(&token, "account-one", "sent", "all", "").unwrap(), "opaque-page-token");
        assert!(decode_cursor(&token, "account-two", "sent", "all", "").is_err());
        assert!(decode_cursor(&token, "account-one", "inbox", "all", "").is_err());
        assert!(decode_cursor(&token, "account-one", "sent", "all", "invoice").is_err());
        assert!(decode_cursor("nonsense", "account-one", "sent", "all", "").is_err());
    }

    #[test]
    fn sent_requires_individual_message_label_and_uses_to_header() {
        let received = serde_json::json!({"labelIds":["INBOX"],"payload":{"headers":[{"name":"From","value":"Me <me@example.test>"},{"name":"To","value":"Friend <friend@example.test>"}]}});
        let sent = serde_json::json!({"labelIds":["SENT"],"payload":{"headers":[{"name":"From","value":"Me <me@example.test>"},{"name":"To","value":"Friend <friend@example.test>"}]}});
        assert!(!gmail_message_matches(&received, "sent", "all"));
        assert!(gmail_message_matches(&sent, "sent", "all"));
        assert_eq!(gmail_header(&sent, "To"), "Friend <friend@example.test>");
        assert!(gmail_message_matches(&received, "inbox", "all"));
        assert!(!gmail_message_matches(&sent, "inbox", "all"));
        assert!(!gmail_message_matches(&serde_json::json!({}), "archive", "all"));
        let primary = serde_json::json!({"labelIds":["INBOX", "CATEGORY_PERSONAL"]});
        assert!(gmail_message_matches(&primary, "inbox", "primary"));
    }

    #[test]
    fn folder_filter_rejects_invalid_and_long_search() {
        assert!(validate_mail_query("../../secrets", "").is_err());
        assert!(validate_mail_query("inbox", &"x".repeat(201)).is_err());
        assert!(validate_mail_query("inbox", "hello\nworld").is_err());
        assert_eq!(validate_mail_query("inbox", "  invoice  ").unwrap(), "invoice");
    }

    #[test]
    fn mailbox_queries_are_provider_specific() {
        assert_eq!(google_mailbox_query("sent", "all", ""), "in:sent");
        assert_eq!(google_mailbox_query("archive", "all", ""), "in:anywhere -in:inbox -in:spam -in:trash -in:sent -in:drafts");
        assert_eq!(google_mailbox_query("inbox", "social", ""), "in:inbox category:social");
        assert_eq!(google_mailbox_query("inbox", "all", "invoice"), "in:inbox invoice");
        assert_eq!(microsoft_mailbox_path("trash"), "deleteditems");
        assert_eq!(microsoft_mailbox_path("archive"), "archive");
        assert!(valid_mailbox("inbox"));
        assert!(!valid_mailbox("../../bad"));
    }

    #[test]
    fn inbox_categories_are_validated() {
        assert_eq!(inbox_category(None).unwrap(), "all");
        assert_eq!(inbox_category(Some("primary")).unwrap(), "primary");
        assert_eq!(inbox_category(Some("promotions")).unwrap(), "promotions");
        assert_eq!(inbox_category(Some("social")).unwrap(), "social");
        assert_eq!(inbox_category(Some("updates")).unwrap(), "updates");
        assert!(inbox_category(Some("spam")).is_err());
    }

    #[test]
    fn spam_and_trash_queries_include_excluded_mail() {
        assert!(gmail_include_spam_trash("spam"));
        assert!(gmail_include_spam_trash("trash"));
        assert!(!gmail_include_spam_trash("inbox"));
        assert!(!gmail_include_spam_trash("sent"));
    }

    #[test]
    fn gmail_message_id_rejects_path_and_control_characters() {
        assert!(valid_gmail_message_id("abc-123_456"));
        for value in ["", "../other", "bad%2Fid", "\n", "x".repeat(513).as_str()] {
            assert!(!valid_gmail_message_id(value));
        }
    }

    #[test]
    fn gmail_action_only_uses_nonpermanent_modify_operations() {
        assert_eq!(gmail_action("star"), Some(("modify", vec!["STARRED"], vec![])));
        assert_eq!(gmail_action("unstar"), Some(("modify", vec![], vec!["STARRED"])));
        assert_eq!(gmail_action("archive"), Some(("modify", vec![], vec!["INBOX"])));
        assert_eq!(gmail_action("unread"), Some(("modify", vec!["UNREAD"], vec![])));
        assert_eq!(gmail_action("trash"), Some(("trash", vec![], vec![])));
        assert_eq!(gmail_action("restore"), Some(("untrash", vec![], vec![])));
        assert_eq!(gmail_action("notSpam"), Some(("modify", vec!["INBOX"], vec!["SPAM"])));
        assert_eq!(gmail_action("unstar"), Some(("modify", vec![], vec!["STARRED"])));
        assert!(gmail_action("delete").is_none());
    }

    #[test]
    fn outgoing_headers_reject_injection_and_invalid_recipients() {
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo", "Isi", None, None, None).is_ok());
        assert!(compose_raw("me@example.test", "friend@example.test\r\nBcc: bad@example.test", "Halo", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test\r\n", "Halo", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo", "Isi", None, Some("team@example.test\r\n"), None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo\0", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "not-an-email", "Halo", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@@example.test", "Halo", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example..test", "Halo", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test\0", "Halo", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo", "Isi", Some("<ok@example.test>\0"), None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo\nBcc: bad@example.test", "Isi", None, None, None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo", "Isi", Some("bad\r\nHeader: 1"), None, None).is_err());
    }

    #[test]
    fn reply_all_accepts_multiple_recipients_without_header_injection() {
        let raw = compose_raw("me@example.test", "friend@example.test, team@example.test", "Re: Halo", "Halo semua", Some("<source@example.test>"), None, None).unwrap();
        let text = String::from_utf8(URL_SAFE_NO_PAD.decode(raw).unwrap()).unwrap();
        assert!(text.contains("To: friend@example.test, team@example.test\r\n"));
        let cc = compose_raw("me@example.test", "friend@example.test", "Re: Halo", "Halo semua", None, Some("team@example.test"), None).unwrap();
        assert!(String::from_utf8(URL_SAFE_NO_PAD.decode(cc).unwrap()).unwrap().contains("Cc: team@example.test\r\n"));
        assert!(compose_raw("me@example.test", "friend@example.test", "Halo", "Isi", None, Some("team@example.test\r\nBcc: attacker@example.test"), None).is_err());
        assert!(compose_raw("me@example.test", "friend@example.test,\r\nBcc: attacker@example.test", "Re: Halo", "Hai", None, None, None).is_err());
    }

    #[test]
    fn compose_requires_explicit_confirmation_id_for_send() {
        assert!(compose_request_valid("new", None, None, false).is_err());
        assert!(compose_request_valid("new", None, Some("nonce-123"), false).is_ok());
        assert!(compose_request_valid("draft", None, None, false).is_ok());
        assert!(compose_request_valid("reply", Some("abc123"), Some("nonce-123"), false).is_ok());
        assert!(compose_request_valid("reply", None, Some("nonce-123"), false).is_err());
    }

    #[test]
    fn source_message_header_rejects_tampering() {
        let value = serde_json::json!({"threadId":"thread123","payload":{"headers":[{"name":"Message-ID","value":"<original@example.test>"}]}});
        assert_eq!(reply_metadata(&value).unwrap(), ("thread123".to_owned(), "<original@example.test>".to_owned()));
        assert!(reply_metadata(&serde_json::json!({"threadId":"bad/thread","payload":{"headers":[]}})).is_err());
        assert!(reply_metadata(&serde_json::json!({"threadId":"thread123","payload":{"headers":[{"name":"Message-ID","value":"<x>\r\nBcc: attacker@example.test"}]}})).is_err());
    }

    #[test]
    fn reply_draft_keeps_source_thread_and_header() {
        assert_eq!(compose_thread("draft", true, Some("original-thread")), Some("original-thread"));
        assert_eq!(compose_thread("draft", false, Some("original-thread")), None);
        assert!(compose_request_valid("draft", Some("abc123"), None, true).is_ok());
        assert!(compose_request_valid("draft", None, None, true).is_err());
    }

    #[test]
    fn compose_rejects_provider_success_without_id() {
        assert!(compose_result_id(&serde_json::json!({})).is_err());
        assert_eq!(compose_result_id(&serde_json::json!({"id": "fictional-id"})).unwrap(), "fictional-id");
    }

    #[test]
    fn forwarding_does_not_join_source_thread() {
        assert_eq!(compose_thread("forward", false, Some("original-thread")), None);
        assert_eq!(compose_thread("reply", false, Some("original-thread")), Some("original-thread"));
    }

    #[test]
    fn uncertain_send_reservation_does_not_expire_automatically() {
        let mut submissions = HashMap::new();
        assert!(reserve_submission(&mut submissions, "account:request").is_ok());
        submissions.insert("account:request".into(), Instant::now() - Duration::from_secs(7200));
        assert!(reserve_submission(&mut submissions, "account:request").is_err());
    }

    #[test]
    fn duplicate_submission_id_is_rejected() {
        let mut submissions = HashMap::new();
        assert!(reserve_submission(&mut submissions, "account:request").is_ok());
        assert!(reserve_submission(&mut submissions, "account:request").is_err());
        assert!(reserve_submission(&mut submissions, "account:other").is_ok());
    }

    #[test]
    fn outgoing_mime_is_encoded_without_body_header_injection() {
        let raw = compose_raw("me@example.test", "friend@example.test", "Café ☕", "Line 1\nBcc: harmless@example.test", None, None, None).unwrap();
        let text = String::from_utf8(URL_SAFE_NO_PAD.decode(raw).unwrap()).unwrap();
        assert!(text.contains("Content-Transfer-Encoding: base64\r\n"));
        assert!(text.contains("Subject: =?UTF-8?B?"));
        assert!(!text.contains("\r\nBcc: harmless@example.test\r\n"));
        assert!(text.starts_with("From: me@example.test\r\nTo: friend@example.test\r\n"));
    }

    #[test]
    fn omitted_scope_preserves_previously_verified_grant() {
        assert_eq!(refreshed_gmail_grant(Some(true), None), Some(true));
        assert_eq!(refreshed_gmail_grant(Some(true), Some("https://www.googleapis.com/auth/gmail.readonly")), Some(false));
        assert_eq!(refreshed_gmail_grant(None, None), None);
    }

    #[test]
    fn oauth_scope_check_matches_only_exact_grants() {
        assert_eq!(granted_gmail_modify(Some("openid https://www.googleapis.com/auth/gmail.modify email")), Some(true));
        assert_eq!(granted_gmail_modify(Some("https://www.googleapis.com/auth/gmail.modify-extra")), Some(false));
        assert_eq!(granted_gmail_modify(Some("https://www.googleapis.com/auth/gmail.readonly")), Some(false));
        assert_eq!(granted_gmail_modify(None), None);
        assert_eq!(granted_gmail_modify(Some("openid https://www.googleapis.com/auth/gmail.modify")), Some(true));
        assert_eq!(granted_gmail_modify(Some("https://www.googleapis.com/auth/gmail.readonly")), Some(false));
    }

    #[test]
    fn read_status_requires_write_scopes() {
        assert!(SCOPES_GOOGLE.contains("/gmail.modify"));
        assert!(!SCOPES_GOOGLE.contains("/gmail.readonly"));
        assert!(SCOPES_MICROSOFT.contains("Mail.ReadWrite"));
    }

    #[test]
    fn gmail_errors_include_safe_reason() {
        let body = serde_json::json!({"error": {"message": "Gmail API has not been used in project 123", "details": [{"reason": "SERVICE_DISABLED"}]}});
        let error = gmail_error(reqwest::StatusCode::FORBIDDEN, &body);
        assert!(error.contains("Gmail API has not been used"));
        assert!(error.contains("Aktifkan Gmail API"));
    }

    #[test]
    fn local_origin_only() {
        let mut headers = HeaderMap::new();
        headers.insert(header::HOST, "127.0.0.1:3000".parse().unwrap());
        assert!(check_local_origin(&headers).is_ok());
        headers.insert(header::ORIGIN, "https://attacker.example".parse().unwrap());
        assert!(check_local_origin(&headers).is_err());
        headers.remove(header::ORIGIN);
        headers.insert(header::HOST, "localhost:3000".parse().unwrap());
        assert!(check_local_origin(&headers).is_ok());
        headers.insert(header::ORIGIN, "http://127.0.0.1:3000".parse().unwrap());
        assert!(check_local_origin(&headers).is_err());
        headers.remove(header::ORIGIN);
        headers.insert(header::HOST, "attacker.example:3000".parse().unwrap());
        assert!(check_local_origin(&headers).is_err());
    }

    #[test]
    fn provider_configs_are_separate() {
        let google = load_config("config/google.json");
        let microsoft = load_config("config/microsoft.json");
        assert!(google.client_secret.is_some());
        assert!(microsoft.client_secret.is_none());
    }

    #[test]
    fn redirect_hosts_match_provider() {
        assert_eq!(redirect_uri("google"), "http://127.0.0.1:3000/callback/google");
        assert_eq!(redirect_uri("microsoft"), "http://localhost:3000/callback/microsoft");
    }

    #[test]
    fn pkce_and_state_are_unique() {
        let first = random_key();
        let second = random_key();
        assert_ne!(first, second);
        assert_eq!(URL_SAFE_NO_PAD.decode(first).unwrap().len(), 32);
    }
}
