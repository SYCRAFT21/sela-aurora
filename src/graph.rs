use crate::app::{Account, AppState, Message, MessageDetail};

pub(super) fn microsoft_mailbox_path(mailbox: &str) -> &str {
    match mailbox {
        "sent" => "sentitems", "drafts" => "drafts", "archive" => "archive",
        "spam" => "junkemail", "trash" => "deleteditems", _ => "inbox",
    }
}


pub(super) async fn microsoft_detail(state: &AppState, account: &Account, id: &str) -> Result<MessageDetail, String> {
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

pub(super) async fn microsoft_messages(state: &AppState, account: &Account, mailbox: &str, search: &str) -> Result<Vec<Message>, String> {
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

pub(super) async fn mark_read(state: &AppState, account: &Account, id: &str) -> crate::app::AppResult<()> {
    let id = url::form_urlencoded::byte_serialize(id.as_bytes()).collect::<String>();
    let url = format!("https://graph.microsoft.com/v1.0/me/messages/{id}");
    state.http.patch(url).bearer_auth(&account.access_token)
        .json(&serde_json::json!({"isRead": true}))
        .send().await.map_err(crate::network_error)?
        .error_for_status().map_err(crate::network_error)?;
    Ok(())
}
