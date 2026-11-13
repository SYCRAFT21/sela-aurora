use std::time::Duration;
#[cfg(test)]
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use futures::StreamExt;
use crate::{attachments, app::{Account, AppState, Message, MessageDetail}};

pub(super) fn valid_gmail_message_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 512 && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

pub(super) fn gmail_action(action: &str) -> Option<(&'static str, Vec<&'static str>, Vec<&'static str>)> {
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


pub(super) fn gmail_header(value: &serde_json::Value, name: &str) -> String {
    attachments::header(&value["payload"], name)
}

pub(super) fn gmail_message_matches(value: &serde_json::Value, mailbox: &str, category: &str) -> bool {
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

pub(super) fn gmail_include_spam_trash(mailbox: &str) -> bool { matches!(mailbox, "spam" | "trash") }

pub(super) fn google_mailbox_query(mailbox: &str, category: &str, search: &str) -> String {
    let folder = match mailbox {
        "starred" => "is:starred", "important" => "is:important", "sent" => "in:sent", "drafts" => "in:drafts",
        "archive" => "in:anywhere -in:inbox -in:spam -in:trash -in:sent -in:drafts",
        "spam" => "in:spam", "trash" => "in:trash",
        "allmail" => "in:anywhere -in:spam -in:trash", _ => "in:inbox",
    };
    let category = if mailbox == "inbox" && category != "all" { format!(" category:{category}") } else { String::new() };
    format!("{folder}{category}{}", if search.is_empty() { String::new() } else { format!(" {search}") })
}


pub(super) async fn bounded_gmail_json(mut response: reqwest::Response, limit: usize) -> Result<serde_json::Value, String> {
    if !response.status().is_success() { return Err(format!("Gmail menolak permintaan ({})", response.status().as_u16())); }
    if response.content_length().is_some_and(|n| n > limit as u64) { return Err("Respons Gmail melebihi batas".into()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Respons Gmail terputus")? {
        if chunk.len() > limit.saturating_sub(bytes.len()) { return Err("Respons Gmail melebihi batas".into()); }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Respons Gmail tidak valid".into())
}

pub(super) async fn gmail_full(state: &AppState, account: &Account, message: &str) -> Result<serde_json::Value, String> {
    let response = state.http.get(format!("{}/messages/{message}",state.gmail_base)).query(&[("format","full")])
        .timeout(Duration::from_secs(30)).bearer_auth(&account.access_token).send().await.map_err(|_| "Gmail tidak dapat dihubungi")?;
    bounded_gmail_json(response, 40_000_000).await
}

pub(super) async fn gmail_part_bytes(state: &AppState, account: &Account, message: &str, part: &serde_json::Value, limit: usize) -> Result<Vec<u8>, String> {
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

#[cfg(test)]
pub(super) fn decode_body(encoded: &str) -> Result<String, String> {
    let bytes = URL_SAFE_NO_PAD.decode(encoded.trim_end_matches('=')).map_err(|_| "Isi email tidak dapat dibaca".to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[cfg(test)]
pub(super) fn google_body(payload: &serde_json::Value, mime: &str) -> Option<String> {
    if payload["filename"].as_str().is_some_and(|name| !name.is_empty()) || attachments::header(payload,"Content-Disposition").to_ascii_lowercase().starts_with("attachment") || payload["mimeType"].as_str() == Some("message/rfc822") { return None; }
    if payload["mimeType"].as_str() == Some(mime) {
        if let Some(data) = payload["body"]["data"].as_str() {
            if let Ok(body) = decode_body(data) { return Some(body); }
        }
    }
    payload["parts"].as_array()?.iter().find_map(|part| google_body(part, mime))
}

fn received(value: &serde_json::Value) -> String {
    chrono::DateTime::from_timestamp_millis(value["internalDate"].as_str().unwrap_or("0").parse::<i64>().unwrap_or(0))
        .map(|date| date.to_rfc3339()).unwrap_or_default()
}

fn message_url(email: &str, id: &str) -> String {
    format!("https://mail.google.com/mail/u/?authuser={}#all/{id}", url::form_urlencoded::byte_serialize(email.as_bytes()).collect::<String>())
}

#[test]
fn presentation_preserves_unicode_missing_fields_and_encoding() {
    let value = serde_json::json!({"payload":{"headers":[{"name":"sUbJeCt","value":"Undangan 日本語"}]},"internalDate":"0"});
    assert_eq!(gmail_header(&value, "Subject"), "Undangan 日本語");
    assert_eq!(gmail_header(&value, "Missing"), "");
    assert_eq!(received(&value), "1970-01-01T00:00:00+00:00");
    assert_eq!(received(&serde_json::json!({})), received(&value));
    assert_eq!(received(&serde_json::json!({"internalDate":"invalid"})), received(&value));
    assert_eq!(message_url("a+b@example.test", "abc_1"), "https://mail.google.com/mail/u/?authuser=a%2Bb%40example.test#all/abc_1");
}

pub(super) async fn google_detail(state: &AppState, account: &Account, id: &str) -> Result<MessageDetail, String> {
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
        received: received(&value),
        body: bodies[0].take().unwrap_or_default(),
        html: bodies[1].take(),
        url: message_url(&account.email, id),
    })
}

pub(super) fn gmail_error(status: reqwest::StatusCode, body: &serde_json::Value) -> String {
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

pub(super) async fn gmail_json(response: reqwest::Response) -> Result<serde_json::Value, String> {
    let status = response.status();
    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(gmail_error(status, &body)); }
    Ok(body)
}

pub(super) async fn google_messages(state: &AppState, account: &Account, mailbox: &str, category: &str, search: &str, page: Option<&str>) -> Result<(Vec<Message>, Option<String>), String> {
    google_messages_limited(state,account,mailbox,category,search,page,30).await
}

pub(super) async fn google_messages_limited(state: &AppState, account: &Account, mailbox: &str, category: &str, search: &str, page: Option<&str>, limit:usize) -> Result<(Vec<Message>, Option<String>), String> {
    let query = google_mailbox_query(mailbox, category, search);
    let count=limit.clamp(1,30).to_string();
    let mut request = state.http.get(format!("{}/messages",state.gmail_base))
        .timeout(Duration::from_secs(30)).query(&[("maxResults", count.as_str()), ("q", query.as_str())]);
    if gmail_include_spam_trash(mailbox) { request = request.query(&[("includeSpamTrash", "true")]); }
    let label = match mailbox {
        "sent" => Some("SENT"), "inbox" => Some("INBOX"), "drafts" => Some("DRAFT"),
        "starred" => Some("STARRED"), "important" => Some("IMPORTANT"),
        "spam" => Some("SPAM"), "trash" => Some("TRASH"), _ => None,
    };
    if let Some(label) = label { request = request.query(&[("labelIds", label)]); }
    if let Some(page) = page { request = request.query(&[("pageToken", page)]); }
    let list = bounded_gmail_json(request.bearer_auth(&account.access_token).send().await.map_err(|_| "Gmail tidak dapat dihubungi")?,1_000_000).await?;
    let ids: Vec<String> = list["messages"].as_array().into_iter().flatten().take(limit.clamp(1,30))
        .filter_map(|v| v["id"].as_str().filter(|id|valid_gmail_message_id(id)).map(str::to_owned)).collect();
    let mut messages = Vec::new();
    let mut results = futures::stream::iter(ids.into_iter().map(|id| async move {
        let url = format!("{}/messages/{id}",state.gmail_base);
        let value = bounded_gmail_json(state.http.get(url).query(&[("format", "metadata")]).timeout(Duration::from_secs(30))
            .bearer_auth(&account.access_token).send().await.map_err(|_| "Gmail tidak dapat dihubungi")?,1_000_000).await?;
        if !gmail_message_matches(&value, mailbox, category) { return Ok(None); }
        let header = |name: &str| gmail_header(&value, name);
        Ok::<_, String>(Some(Message {
            id: id.clone(), account_id: account.id.clone(), recipient: header("To"),
            sender: header("From"), subject: header("Subject"),
            snippet: value["snippet"].as_str().unwrap_or("").to_owned(),
            received: received(&value),
            unread: value["labelIds"].as_array().into_iter().flatten().any(|v| v.as_str() == Some("UNREAD")),
            starred: value["labelIds"].as_array().into_iter().flatten().any(|v| v.as_str() == Some("STARRED")),
            url: message_url(&account.email, &id),
        }))
    })).buffer_unordered(5);
    while let Some(result) = results.next().await {
        if let Some(message) = result? { messages.push(message); }
    }
    Ok((messages, list["nextPageToken"].as_str().map(str::to_owned)))
}

pub(super) async fn mark_read(state: &AppState, account: &Account, id: &str) -> crate::app::AppResult<()> {
    let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/modify");
    state.http.post(url).bearer_auth(&account.access_token)
        .json(&serde_json::json!({"removeLabelIds": ["UNREAD"]}))
        .send().await.map_err(crate::network_error)?
        .error_for_status().map_err(crate::network_error)?;
    Ok(())
}

pub(super) async fn apply_action(state: &AppState, account: &Account, id: &str, endpoint: &str, add: Vec<&str>, remove: Vec<&str>) -> crate::app::AppResult<()> {
    let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/{endpoint}");
    let mut request = state.http.post(url).bearer_auth(&account.access_token);
    if endpoint == "modify" { request = request.json(&serde_json::json!({"addLabelIds": add, "removeLabelIds": remove})); }
    let response = request.send().await.map_err(crate::network_error)?;
    gmail_json(response).await.map_err(|error| (axum::http::StatusCode::BAD_GATEWAY, error))?;
    Ok(())
}
