use axum::{extract::{Path, Query, State}, http::{header, HeaderMap, StatusCode}};
use crate::{attachments, app::{AppResult, AppState, AttachmentQuery, check_local_origin}, gmail::{gmail_full, gmail_part_bytes, valid_gmail_message_id}, oauth::refresh_account};

pub(super) fn attachment_headers(name: &str, size: usize) -> AppResult<HeaderMap> {
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

pub(super) async fn message_attachment(Path(account_id): Path<String>, Query(query): Query<AttachmentQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
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
