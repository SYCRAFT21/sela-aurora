use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use crate::{app::AppResult, settings::{Ai, Protocol}};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Instruction { pub instruction: String, pub consent: bool }
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Draft { pub subject: String, pub body: String }

pub fn client(timeout: std::time::Duration) -> reqwest::Client {
    reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(10))
        .timeout(timeout).redirect(reqwest::redirect::Policy::none()).build().expect("HTTP AI tidak tersedia")
}
fn error(status: StatusCode, text: &str) -> (StatusCode, String) { (status, text.into()) }
pub fn validate(input: &Instruction) -> AppResult<()> {
    if !input.consent || input.instruction.trim().is_empty() || input.instruction.len() > 8192
        || input.instruction.chars().any(|c| c.is_control() && !matches!(c, '\n'|'\r'|'\t')) {
        return Err(error(StatusCode::BAD_REQUEST, "Setujui pemrosesan eksternal; instruksi wajib diisi, maksimal 8 KiB"));
    }
    Ok(())
}
#[cfg(test)]
fn parse(value: serde_json::Value) -> AppResult<Draft> { parse_draft(&response_text(value)?) }
#[cfg(test)]
fn parse_openai(value: serde_json::Value) -> AppResult<Draft> { parse_draft(&response_text(value)?) }
fn parse_draft(text: &str) -> AppResult<Draft> {
    let invalid=|| error(StatusCode::BAD_GATEWAY,"Hasil AI tidak valid, ditolak, atau terpotong; teks lama tetap disimpan");
    let draft: Draft = serde_json::from_str(text).map_err(|_| invalid())?;
    if draft.subject.trim().is_empty() || draft.subject.len() > 512 || draft.subject.chars().any(char::is_control)
        || draft.body.trim().is_empty() || draft.body.len() > 16_384
        || draft.body.chars().any(|c| c.is_control() && !matches!(c, '\n'|'\r'|'\t')) { return Err(invalid()); }
    Ok(draft)
}

pub async fn generate(client: &reqwest::Client, config: &Ai, input: &Instruction) -> AppResult<Draft> {
    validate(input)?;
    let system="Write a short plain-text email from the user's instruction. Return only a JSON object with string subject and body. Follow the requested language, otherwise Indonesian. Never claim to have sent or saved anything. Do not invent factual details: use clear placeholders when details are missing.";
    let schema=serde_json::json!({"type":"object","properties":{"subject":{"type":"string"},"body":{"type":"string"}},"required":["subject","body"],"additionalProperties":false});
    let text=conversation(client,config,system,serde_json::json!([{"role":"user","content":input.instruction}]),schema).await?;
    parse_draft(&text)
}

pub(super) async fn conversation(client: &reqwest::Client, config: &Ai, system: &str, messages: serde_json::Value, schema: serde_json::Value) -> AppResult<String> {
    if !config.enabled || config.api_key.is_empty() { return Err(error(StatusCode::CONFLICT, "Aktifkan AI dan isi API key di Pengaturan")); }
    config.validate_endpoint().map_err(|_|error(StatusCode::BAD_REQUEST,"URL API tidak valid"))?;
    let request=client.post(&config.endpoint);
    let request=match config.protocol {
      Protocol::OpenaiCompatible=>request.bearer_auth(&config.api_key).json(&serde_json::json!({
        "model":config.model,"max_completion_tokens":4096,"stream":false,
        "messages":std::iter::once(serde_json::json!({"role":"system","content":system})).chain(messages.as_array().unwrap().iter().cloned()).collect::<Vec<_>>()
      })),
      Protocol::Anthropic=>request.header("x-api-key", &config.api_key).header("anthropic-version", "2026-10-21")
        .header("anthropic-beta", "server-side-fallback-2026-07-01")
        .json(&serde_json::json!({
            "model":config.model,"max_tokens":4096,"thinking":{"type":"adaptive"},"fallbacks":"default",
            "system":system,
            "output_config":{"effort":"low","format":{"type":"json_schema","schema":schema}},
            "messages":messages
        })),
    };
    let response=request.send().await.map_err(|_| error(StatusCode::BAD_GATEWAY, "AI tidak terjangkau atau melewati batas waktu; coba manual"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(match status.as_u16() {
            401 | 403 => error(StatusCode::BAD_GATEWAY, "API key AI ditolak; periksa key dan akses model"),
            429 => error(StatusCode::TOO_MANY_REQUESTS, "Batas penggunaan AI tercapai; coba lagi nanti"),
            400 | 404 => error(StatusCode::BAD_GATEWAY, "Model atau konfigurasi AI tidak didukung penyedia"),
            _ => error(StatusCode::BAD_GATEWAY, "Penyedia AI gagal; teks lama tidak diubah"),
        });
    }
    let invalid = || error(StatusCode::BAD_GATEWAY, "Respons AI tidak valid atau melebihi batas");
    let mut response = response;
    if response.content_length().is_some_and(|n| n > 131_072) { return Err(invalid()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| invalid())? {
        if chunk.len() > 131_072usize.saturating_sub(bytes.len()) { return Err(invalid()); }
        bytes.extend_from_slice(&chunk);
    }
    let value=serde_json::from_slice(&bytes).map_err(|_| invalid())?;
    response_text(value)
}

fn response_text(value: serde_json::Value) -> AppResult<String> {
    let invalid=|| error(StatusCode::BAD_GATEWAY,"Format respons penyedia AI tidak sesuai. Periksa format API dan model di Pengaturan; percakapan dan draf tetap disimpan.");
    let truncated=|| error(StatusCode::BAD_GATEWAY,"Jawaban AI terpotong karena batas panjang keluaran. Coba permintaan lebih singkat atau model lain; percakapan dan draf tetap disimpan.");
    let refused=|| error(StatusCode::BAD_GATEWAY,"Penyedia AI menolak menjawab. Ubah permintaan; percakapan dan draf tetap disimpan.");
    let tools=|| error(StatusCode::BAD_GATEWAY,"Penyedia mengembalikan tool call yang tidak didukung. Gunakan model yang mendukung respons JSON; tidak ada tindakan dijalankan.");
    // ponytail: recognize two complete envelopes only; add adapters for other API families explicitly.
    if value.get("error").is_some_and(|v| !v.is_null()) {return Err(invalid());}
    let protocol=match (value.get("choices"),value.get("content")) {
        (Some(_),None)=>Protocol::OpenaiCompatible,
        (None,Some(_))=>Protocol::Anthropic,
        _=>return Err(invalid()),
    };
    match protocol {
        Protocol::OpenaiCompatible => {
            let choices=value["choices"].as_array().ok_or_else(invalid)?;
            if choices.len()!=1 { return Err(invalid()); }
            let choice=&choices[0];let message=&choice["message"];
            if choice["finish_reason"]=="length" {return Err(truncated());}
            if choice["finish_reason"]=="content_filter" || !message["refusal"].is_null() {return Err(refused());}
            if choice["finish_reason"]=="tool_calls" || choice["finish_reason"]=="function_call" || ["tool_calls","function_call"].iter().any(|field| !message[*field].is_null()) {return Err(tools());}
            if choice["finish_reason"]!="stop" || message["role"]!="assistant" {return Err(invalid());}
            message["content"].as_str().map(str::to_owned).ok_or_else(invalid)
        }
        Protocol::Anthropic => {
            match value["stop_reason"].as_str() {
                Some("max_tokens")=>return Err(truncated()),
                Some("refusal")=>return Err(refused()),
                Some("tool_use")=>return Err(tools()),
                Some("end_turn")=>{},
                _=>return Err(invalid()),
            }
            let mut text=String::new();
            for block in value["content"].as_array().ok_or_else(invalid)? {
                match block["type"].as_str() {
                    Some("text") => text.push_str(block["text"].as_str().ok_or_else(invalid)?),
                    Some("thinking"|"redacted_thinking"|"fallback") => {},
                    _ => return Err(invalid()),
                }
            }
            Ok(text)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, routing::post, Json, http::HeaderMap};
    #[test]
    fn router_response_format_is_independent_of_request_protocol() {
        let openai=serde_json::json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\"reply\":\"Halo!\",\"action\":null}"}}]});
        let anthropic=serde_json::json!({"stop_reason":"end_turn","content":[{"type":"text","text":"{\"reply\":\"Halo!\",\"action\":null}"}]});
        for value in [&openai,&anthropic] {
            assert_eq!(response_text(value.clone()).unwrap(),"{\"reply\":\"Halo!\",\"action\":null}");
        }
        let mut truncated=openai.clone();truncated["choices"][0]["finish_reason"]="length".into();
        assert!(response_text(truncated).unwrap_err().1.contains("batas panjang"));
        let mut refused=anthropic.clone();refused["stop_reason"]="refusal".into();
        assert!(response_text(refused).unwrap_err().1.contains("menolak"));
        let mut mixed=openai.clone();mixed["content"]=anthropic["content"].clone();mixed["stop_reason"]="end_turn".into();
        assert!(response_text(mixed).is_err());
        let mut provider_error=openai.clone();provider_error["error"]=serde_json::json!({"message":"private error"});
        assert!(response_text(provider_error).is_err());
    }

    #[test]
    fn response_errors_explain_truncation_refusal_tools_and_format() {
        for (reason,expected) in [("length","batas panjang"),("content_filter","menolak"),("tool_calls","tool call")] {
            let value=serde_json::json!({"choices":[{"finish_reason":reason,"message":{"role":"assistant","content":"private fixture"}}]});
            let message=response_text(value).unwrap_err().1;
            assert!(message.contains(expected),"{reason}: {message}");
            assert!(!message.contains("private fixture"));
        }
        for (reason,expected) in [("max_tokens","batas panjang"),("refusal","menolak"),("tool_use","tool call")] {
            let value=serde_json::json!({"stop_reason":reason,"content":[]});
            assert!(response_text(value).unwrap_err().1.contains(expected));
        }
        let refused=serde_json::json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":null,"refusal":"private refusal"}}]});
        assert!(response_text(refused).unwrap_err().1.contains("menolak"));
        assert!(response_text(serde_json::json!({})).unwrap_err().1.contains("format API"));
    }

    #[test]
    fn openai_output_requires_complete_safe_json() {
        let valid=serde_json::json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\"subject\":\"Undangan\",\"body\":\"Halo\"}"}}]});
        assert_eq!(parse_openai(valid.clone()).unwrap().subject,"Undangan");
        for reason in ["length","content_filter","tool_calls"] {
            let mut v=valid.clone();v["choices"][0]["finish_reason"]=reason.into();assert!(parse_openai(v).is_err());
        }
        for (field,value) in [("refusal",serde_json::json!("No")),("tool_calls",serde_json::json!([])),("function_call",serde_json::json!({})),("content",serde_json::json!("```json\n{}\n```")),("content",serde_json::Value::Null)] {
            let mut v=valid.clone();v["choices"][0]["message"][field]=value;assert!(parse_openai(v).is_err());
        }
        assert!(parse_openai(serde_json::json!({"choices":[]})).is_err());
    }

    #[test]
    fn validates_consent_and_complete_plain_text_output() {
        assert!(validate(&Instruction{instruction:"Tulis undangan".into(),consent:false}).is_err());
        assert!(validate(&Instruction{instruction:"x".repeat(8193),consent:true}).is_err());
        let valid = serde_json::json!({"stop_reason":"end_turn","content":[{"type":"text","text":"{\"subject\":\"Undangan\",\"body\":\"Halo\\nTerima kasih\"}"}]});
        assert_eq!(parse(valid.clone()).unwrap().body, "Halo\nTerima kasih");
        for reason in ["refusal","max_tokens","tool_use"] { let mut v=valid.clone();v["stop_reason"]=reason.into(); assert!(parse(v).is_err()); }
        for body in ["not json",r#"{"subject":"bad\r\nheader","body":"ok"}"#,r#"{"subject":"x","body":""}"#,r#"{"subject":"x","body":"ok","extra":1}"#] {
            assert!(parse(serde_json::json!({"stop_reason":"end_turn","content":[{"type":"text","text":body}]})).is_err());
        }
    }
    #[tokio::test]
    async fn mock_request_uses_only_instruction_and_safe_errors() {
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address=listener.local_addr().unwrap();
        let task=tokio::spawn(async move { axum::serve(listener,Router::new().route("/",post(|headers:HeaderMap,Json(v):Json<serde_json::Value>|async move {
            assert_eq!(headers["x-api-key"],"fixture-key");assert_eq!(v["model"],"claude-opus-5-5");
            assert_eq!(v["messages"],serde_json::json!([{"role":"user","content":"Tulis undangan"}]));
            assert!(v.get("tools").is_none());
            Json(serde_json::json!({"stop_reason":"end_turn","content":[{"type":"text","text":"{\"subject\":\"Undangan\",\"body\":\"Halo\"}"}]}))
        })).route("/openai",post(|headers:HeaderMap,Json(v):Json<serde_json::Value>|async move {
            assert_eq!(headers["authorization"],"Bearer fixture-key");
            assert!(!headers.contains_key("x-api-key"));assert!(!headers.contains_key("anthropic-version"));
            assert_eq!(v["model"],"vendor/model:free");assert_eq!(v["max_completion_tokens"],4096);assert_eq!(v["stream"],false);
            assert_eq!(v["messages"][1],serde_json::json!({"role":"user","content":"Tulis undangan"}));
            assert_eq!(v["messages"].as_array().unwrap().len(),2);
            for field in ["thinking","fallbacks","output_config","tools"] {assert!(v.get(field).is_none());}
            Json(serde_json::json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\"subject\":\"Undangan\",\"body\":\"Halo\"}"}}]}))
        })).route("/router",post(|headers:HeaderMap,Json(v):Json<serde_json::Value>|async move {
            assert_eq!(headers["x-api-key"],"fixture-key");
            assert_eq!(v["messages"],serde_json::json!([{"role":"user","content":"Tulis undangan"}]));
            Json(serde_json::json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\"subject\":\"Undangan\",\"body\":\"Halo\"}"}}]}))
        })).route("/error",post(||async {(StatusCode::UNAUTHORIZED,"secret provider error")}))
          .route("/large",post(||async {"x".repeat(131_073)}))
          .route("/redirect",post(||async {axum::response::Redirect::temporary("/")}))
          .route("/rate",post(||async {(StatusCode::TOO_MANY_REQUESTS,"private error")}))
          .route("/failure",post(||async {(StatusCode::INTERNAL_SERVER_ERROR,"private error")}))
          .route("/headers",post(||async {std::future::pending::<StatusCode>().await}))
          .route("/body",post(||async {axum::body::Body::from_stream(futures::stream::once(std::future::pending::<Result<String,std::io::Error>>()))}))
          .route("/chunks",post(||async {axum::body::Body::from_stream(futures::stream::iter([Ok::<_,std::io::Error>("x".repeat(70_000)),Ok("x".repeat(70_000))]))}))
        ).await.unwrap(); });
        let config=Ai{enabled:true,api_key:"fixture-key".into(),..Ai::default()};
        let input=Instruction{instruction:"Tulis undangan".into(),consent:true};
        let client=client(std::time::Duration::from_secs(5));
        let base=format!("http://{address}");
        let at=|path:&str| Ai{endpoint:format!("{base}/{path}"),..config.clone()};
        assert_eq!(generate(&client,&at(""),&input).await.unwrap().subject,"Undangan");
        assert_eq!(generate(&client,&at("router"),&input).await.unwrap().subject,"Undangan");
        let openai=Ai{protocol:Protocol::OpenaiCompatible,model:"vendor/model:free".into(),..at("openai")};
        assert_eq!(generate(&client,&openai,&input).await.unwrap().subject,"Undangan");
        let e=generate(&client,&at("error"),&input).await.err().unwrap();
        assert!(!e.1.contains("secret provider"));
        for path in ["large","redirect","chunks","failure"] { assert!(generate(&client,&at(path),&input).await.is_err()); }
        assert_eq!(generate(&client,&at("rate"),&input).await.err().unwrap().0,StatusCode::TOO_MANY_REQUESTS);
        let deadline_client=super::client(std::time::Duration::from_millis(100));
        for path in ["headers","body"] {
            let start=std::time::Instant::now();
            assert!(generate(&deadline_client,&at(path),&input).await.is_err());
            assert!(start.elapsed()<std::time::Duration::from_secs(2));
        }
        task.abort();
    }
}
