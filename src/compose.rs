use std::{collections::HashMap, time::{Duration, Instant}};
use axum::{extract::{Path, Query, State}, http::{header, HeaderMap, StatusCode}, Json};
use base64::{engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD}, Engine};
use serde::Deserialize;
use crate::{attachments, app::{Account, AppResult, AppState, AttachmentQuery, check_local_origin}, gmail::{bounded_gmail_json, gmail_full, gmail_header, gmail_part_bytes, valid_gmail_message_id}, oauth::refresh_account};

#[derive(Deserialize)]
pub(super) struct ComposeQuery {
    pub(super) to: String,
    pub(super) subject: String,
    pub(super) body: String,
    #[serde(default)]
    pub(super) message_id: Option<String>,
    #[serde(default)]
    pub(super) mode: Option<String>,
    #[serde(default)]
    pub(super) cc: Option<String>,
    #[serde(default)]
    pub(super) bcc: Option<String>,
    #[serde(default)]
    pub(super) submission_id: Option<String>,
    #[serde(default)]
    pub(super) draft_reply: bool,
    #[serde(default)]
    pub(super) draft_id: Option<String>,
    #[serde(default)]
    pub(super) expected_message_id: Option<String>,
    #[serde(default)]
    pub(super) convert_html: bool,
    #[serde(default)]
    pub(super) files: Vec<UploadMeta>,
    #[serde(default)]
    pub(super) retained: Vec<RetainedFile>,
}
#[derive(Deserialize)]
pub(super) struct UploadMeta { id: String, filename: String, mime_type: String, size: usize }
#[derive(Deserialize)]
pub(super) struct RetainedFile { message_id: String, part: String }

pub(super) async fn read_compose(request: axum::extract::Request) -> AppResult<(ComposeQuery,Vec<attachments::Upload>)> {
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

pub(super) fn compose_request_valid(mode: &str, source: Option<&str>, submission: Option<&str>, draft_reply: bool) -> AppResult<()> {
    if !matches!(mode, "new" | "reply" | "replyAll" | "forward" | "draft") ||
        source.is_some_and(|id| !valid_gmail_message_id(id)) ||
        (matches!(mode, "reply" | "replyAll" | "forward") || draft_reply) && source.is_none() ||
        draft_reply && mode != "draft" ||
        mode != "draft" && !submission.is_some_and(|id| !id.is_empty() && id.len() <= 100 && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')) {
        return Err((StatusCode::BAD_REQUEST, "Mode, sumber, atau konfirmasi pesan tidak valid".into()));
    }
    Ok(())
}

pub(super) fn reserve_submission(submissions: &mut HashMap<String, Instant>, key: &str) -> AppResult<()> {
    // shortcut: reservations last only until restart; persistent deduplication needs durable storage.
    if submissions.contains_key(key) {
        return Err((StatusCode::CONFLICT, "Pengiriman ini sudah diproses; periksa folder Terkirim sebelum mencoba lagi".into()));
    }
    submissions.insert(key.to_owned(), Instant::now());
    Ok(())
}

pub(super) fn compose_raw(from: &str, to: &str, subject: &str, body: &str, thread_header: Option<&str>, cc: Option<&str>, bcc: Option<&str>) -> AppResult<String> {
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

pub(super) fn compose_result_id(response: &serde_json::Value) -> AppResult<&str> {
    response["id"].as_str().filter(|id| !id.is_empty())
        .ok_or((StatusCode::BAD_GATEWAY, "Gmail tidak mengonfirmasi ID pesan".into()))
}

pub(super) fn compose_thread<'a>(mode: &str, draft_reply: bool, thread: Option<&'a str>) -> Option<&'a str> {
    if matches!(mode, "reply" | "replyAll") || mode == "draft" && draft_reply { thread } else { None }
}

pub(super) fn reply_metadata(source: &serde_json::Value) -> AppResult<(String, String)> {
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


pub(super) fn validate_draft(draft: &serde_json::Value, expected: &str) -> AppResult<()> {
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
pub(super) async fn gmail_draft(state: &AppState, account: &Account, id: &str) -> AppResult<serde_json::Value> {
    if !valid_gmail_message_id(id) { return Err((StatusCode::BAD_REQUEST,"ID draf tidak valid".into())); }
    let response = state.http.get(format!("{}/drafts/{id}",state.gmail_base)).query(&[("format","full")]).bearer_auth(&account.access_token).timeout(Duration::from_secs(30)).send().await.map_err(|_| (StatusCode::BAD_GATEWAY,"Draf belum dapat dimuat".into()))?;
    bounded_gmail_json(response,40_000_000).await.map_err(|_| (StatusCode::BAD_GATEWAY,"Draf belum dapat dimuat".into()))
}
pub(super) async fn draft_detail(Path(account_id): Path<String>, Query(query): Query<AttachmentQuery>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
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

pub(super) async fn compose_message(Path(account_id): Path<String>, State(state): State<AppState>, request: axum::extract::Request) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(request.headers())?;
    let _permit = state.attachment_transfers.try_acquire().map_err(|_| (StatusCode::TOO_MANY_REQUESTS,"Transfer sedang sibuk".into()))?;
    let (message, files) = read_compose(request).await?;
    let result = deliver(&state, &account_id, message, files).await?;
    Ok((StatusCode::CREATED, Json(result)))
}

#[derive(serde::Serialize)]
pub(super) struct ComposeResult {
    id: String,
    message_id: serde_json::Value,
}

pub(super) async fn deliver(state: &AppState, account_id: &str, message: ComposeQuery, mut files: Vec<attachments::Upload>) -> AppResult<ComposeResult> {
    let mode = message.mode.as_deref().unwrap_or("new");
    compose_request_valid(mode, message.message_id.as_deref(), message.submission_id.as_deref(), message.draft_reply)?;
    let account = state.accounts.read().await.get(account_id).cloned()
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
    Ok(ComposeResult { id: compose_result_id(&response)?.into(), message_id: response["message"]["id"].clone() })
}

