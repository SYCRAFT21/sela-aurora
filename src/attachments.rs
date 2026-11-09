use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Serialize;
use serde_json::Value;

pub const MAX_FILE_BYTES: usize = 25_000_000;
pub const MAX_FILES: usize = 100;

#[derive(Clone, Debug, Serialize)]
pub struct Attachment {
    pub part: String,
    pub filename: String,
    pub mime_type: String,
    pub size: usize,
    pub attachment_id: Option<String>,
    pub content_id: Option<String>,
    pub inline: bool,
    pub available: bool,
}

#[derive(Default)]
pub struct Parts {
    pub attachments: Vec<Attachment>,
    pub plain: Option<String>,
    pub html: Option<String>,
}

pub fn header(part: &Value, name: &str) -> String {
    part["headers"].as_array().and_then(|headers| headers.iter().find(|h| h["name"].as_str().is_some_and(|n| n.eq_ignore_ascii_case(name))))
        .and_then(|h| h["value"].as_str()).unwrap_or("").to_owned()
}

pub fn safe_filename(name: &str) -> String {
    let leaf = name.rsplit(['/', '\\']).next().unwrap_or("");
    let safe: String = leaf.chars().filter(|c| !c.is_control() && !matches!(c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}')).take(180).collect();
    let safe = safe.trim_matches([' ', '.']);
    if safe.is_empty() { "attachment.bin".into() } else { safe.into() }
}

pub fn valid_mime(mime: &str) -> bool {
    mime.len() <= 127 && mime.split('/').count() == 2 && mime.split('/').all(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'!'|b'#'|b'$'|b'&'|b'^'|b'_'|b'.'|b'+'|b'-')))
}

pub fn decode(data: &str, size: usize, limit: usize) -> Result<Vec<u8>, String> {
    if size > limit || data.len() > limit.div_ceil(3) * 4 + 2 { return Err("Lampiran melebihi batas ukuran".into()); }
    let unpadded = data.trim_end_matches('=');
    let padding = data.len()-unpadded.len();
    if padding>2 || padding>0 && (data.len()%4!=0 || padding != (4-unpadded.len()%4)%4) {return Err("Padding lampiran tidak valid".into());}
    let bytes = URL_SAFE_NO_PAD.decode(unpadded).map_err(|_| "Data lampiran rusak")?;
    if bytes.len() != size || bytes.len() > limit { return Err("Ukuran lampiran tidak sesuai".into()); }
    Ok(bytes)
}

pub fn resolve<'a>(payload: &'a Value, path: &str) -> Result<&'a Value, String> {
    if path == "root" { return Ok(payload); }
    if path.len() > 180 { return Err("Bagian MIME tidak valid".into()); }
    let mut node = payload;
    for (depth, segment) in path.split('.').enumerate() {
        if depth >= 30 || segment.is_empty() || !segment.bytes().all(|b| b.is_ascii_digit()) || segment.len() > 4 {
            return Err("Bagian MIME tidak valid".into());
        }
        let index: usize = segment.parse().map_err(|_| "Bagian MIME tidak valid")?;
        if segment != index.to_string() { return Err("Bagian MIME tidak valid".into()); }
        node = node["parts"].as_array().and_then(|parts| parts.get(index)).ok_or("Bagian MIME tidak ditemukan")?;
    }
    Ok(node)
}

pub fn inspect(payload: &Value) -> Result<Parts, String> {
    fn walk(node: &Value, path: String, depth: usize, count: &mut usize, result: &mut Parts) -> Result<(), String> {
        *count += 1;
        if depth > 30 || *count > 1000 { return Err("Struktur MIME melampaui batas".into()); }
        let mime = node["mimeType"].as_str().filter(|m| valid_mime(m)).unwrap_or("application/octet-stream").to_ascii_lowercase();
        let name = node["filename"].as_str().unwrap_or("");
        let disposition = header(node, "Content-Disposition").split(';').next().unwrap_or("").trim().to_ascii_lowercase();
        let cid = header(node, "Content-ID").trim().trim_matches(['<','>']).to_owned();
        let file = !name.is_empty() || disposition == "attachment" || !cid.is_empty() || (!mime.starts_with("multipart/") && mime != "text/plain" && mime != "text/html");
        if file {
            if result.attachments.len() >= MAX_FILES { return Err("Terlalu banyak lampiran".into()); }
            let attachment_id = node["body"]["attachmentId"].as_str().filter(|s| !s.is_empty()).map(str::to_owned);
            let size = node["body"]["size"].as_u64().and_then(|s| usize::try_from(s).ok());
            result.attachments.push(Attachment {
                part: path, filename: safe_filename(name), mime_type: mime,
                size: size.unwrap_or(0), attachment_id: attachment_id.clone(),
                content_id: (!cid.is_empty() && cid.len() <= 512 && !cid.chars().any(char::is_control)).then_some(cid),
                inline: disposition != "attachment" && (disposition == "inline" || !header(node, "Content-ID").is_empty()),
                available: size.is_some_and(|s| s <= MAX_FILE_BYTES) && (attachment_id.is_some() || node["body"]["data"].is_string()),
            });
            return Ok(());
        }
        if mime == "text/plain" && result.plain.is_none() { result.plain = Some(path.clone()); }
        if mime == "text/html" && result.html.is_none() { result.html = Some(path.clone()); }
        if let Some(children) = node["parts"].as_array() {
            for (index, part) in children.iter().enumerate() {
                walk(part, if path == "root" { index.to_string() } else { format!("{path}.{index}") }, depth + 1, count, result)?;
            }
        }
        Ok(())
    }
    let mut result = Parts::default();
    walk(payload, "root".into(), 0, &mut 0, &mut result)?;
    let mut storage = std::collections::HashSet::new();
    result.attachments.retain(|part| part.attachment_id.as_ref().is_none_or(|id| storage.insert((id.clone(),part.content_id.clone()))));
    Ok(result)
}

pub struct Upload {
    pub filename: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
    pub content_id: Option<String>,
}

fn folded(bytes: &[u8]) -> String {
    use base64::engine::general_purpose::STANDARD;
    STANDARD.encode(bytes).as_bytes().chunks(76).map(|chunk| format!("{}\r\n", std::str::from_utf8(chunk).unwrap())).collect()
}
fn boundary() -> String {
    use rand::RngCore;
    let mut random = [0;24]; rand::rngs::OsRng.fill_bytes(&mut random);
    format!("aurora_{}", URL_SAFE_NO_PAD.encode(random))
}
pub fn with_files(raw: &str, files: &[Upload], html: Option<&str>) -> Result<String,String> {
    if files.len() > MAX_FILES || files.iter().try_fold(0usize, |total, file| total.checked_add(file.bytes.len())).is_none_or(|size| size > MAX_FILE_BYTES) {
        return Err("Lampiran maksimal 100 file dan total 25 MB".into());
    }
    if html.is_some_and(|value| value.len() > 1_000_000) { return Err("HTML terlalu besar".into()); }
    for file in files {
        if file.filename != safe_filename(&file.filename) || file.filename.len() > 720 || !valid_mime(&file.mime_type) || file.bytes.len() > MAX_FILE_BYTES || file.content_id.as_ref().is_some_and(|cid| cid.is_empty() || cid.len()>512 || cid.bytes().any(|b| b<33 || b>126 || matches!(b,b'<'|b'>'))) { return Err("Metadata lampiran tidak valid".into()); }
    }
    if files.is_empty() && html.is_none() { return Ok(raw.into()); }
    let original = String::from_utf8(URL_SAFE_NO_PAD.decode(raw).map_err(|_| "MIME tidak valid")?).map_err(|_| "MIME tidak valid")?;
    let (headers, body) = original.split_once("\r\n\r\n").ok_or("MIME tidak valid")?;
    let mut content = format!("Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{}", body.as_bytes().chunks(76).map(|c| format!("{}\r\n",std::str::from_utf8(c).unwrap())).collect::<String>());
    if let Some(html) = html {
        let separator = boundary();
        content = format!("Content-Type: multipart/alternative; boundary=\"{separator}\"\r\n\r\n--{separator}\r\n{content}\r\n--{separator}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{}--{separator}--\r\n",folded(html.as_bytes()));
    }
    let separator = boundary();
    let mut output = headers.lines().filter(|line| !line.starts_with("Content-Type:") && !line.starts_with("Content-Transfer-Encoding:")).map(|line| format!("{line}\r\n")).collect::<String>();
    output.push_str(&format!("Content-Type: multipart/mixed; boundary=\"{separator}\"\r\n\r\n--{separator}\r\n{content}\r\n"));
    for file in files {
        let encoded: String = file.filename.as_bytes().iter().map(|b| if b.is_ascii_alphanumeric() || matches!(b,b'.'|b'_'|b'-') {(*b as char).to_string()} else {format!("%{b:02X}")}).collect();
        let name: String = file.filename.chars().map(|c| if c.is_ascii_alphanumeric() || matches!(c,'.'|'_'|'-'|' ') {c} else {'_'}).collect();
        output.push_str(&format!("--{separator}\r\nContent-Type: {}\r\nContent-Disposition: {}; filename*=UTF-8''{encoded}; filename=\"{name}\"\r\nContent-Transfer-Encoding: base64\r\n",file.mime_type,if file.content_id.is_some() {"inline"} else {"attachment"}));
        if let Some(cid) = &file.content_id { output.push_str(&format!("Content-ID: <{cid}>\r\n")); }
        output.push_str(&format!("\r\n{}\r\n",folded(&file.bytes)));
    }
    output.push_str(&format!("--{separator}--\r\n"));
    if output.len() > 36_700_160 { return Err("MIME melampaui batas Gmail 35 MiB".into()); }
    Ok(URL_SAFE_NO_PAD.encode(output))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn outgoing_files_are_binary_correct_folded_and_header_safe() {
        let bytes = vec![0,255,254,1];
        let file = Upload { filename: "laporan 日本.pdf".into(), mime_type: "application/pdf".into(), bytes: bytes.clone(), content_id: None };
        let raw = URL_SAFE_NO_PAD.encode("From: a@example.test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\nYm9keQ==");
        let mixed = with_files(&raw, &[file], None).unwrap();
        let decoded = String::from_utf8(URL_SAFE_NO_PAD.decode(mixed).unwrap()).unwrap();
        assert!(decoded.contains("multipart/mixed"));
        assert!(decoded.contains("filename*=UTF-8''laporan%20"));
        assert!(decoded.contains("AP/+AQ==\r\n"));
        // Independent stdlib parser verifies the emitted MIME, not another copy of our builder.
        use std::{io::Write,process::{Command,Stdio}};
        let mut parser = Command::new("python3").args(["-I","-c", "import sys,email,email.policy; m=email.message_from_bytes(sys.stdin.buffer.read(),policy=email.policy.default); a=list(m.iter_attachments()); assert len(a)==1; assert a[0].get_filename()=='laporan 日本.pdf'; assert a[0].get_payload(decode=True)==bytes([0,255,254,1]); assert m.get_body(preferencelist=('plain',)).get_payload(decode=True)==b'body'"]).stdin(Stdio::piped()).spawn().unwrap();
        parser.stdin.take().unwrap().write_all(decoded.as_bytes()).unwrap();
        assert!(parser.wait().unwrap().success());
        assert!(decoded.lines().all(|line| !line.starts_with("Content-Transfer-Encoding") || line.ends_with("base64")));
        let bad = Upload { filename: "x\r\nBcc: victim@example.test".into(), mime_type: "text/plain".into(), bytes, content_id: None };
        assert!(with_files(&raw,&[bad],None).is_err());
    }

    #[test]
    fn nested_parts_keep_three_pdfs_and_exclude_named_text_from_body() {
        let payload = json!({"mimeType":"multipart/mixed", "parts":[
            {"mimeType":"text/plain","filename":"notes.txt","body":{"data":"bm90IGJvZHk","size":8}},
            {"mimeType":"multipart/alternative","parts":[{"mimeType":"text/plain","body":{"data":"Ym9keQ","size":4}}]},
            {"mimeType":"application/pdf","filename":"a.pdf","body":{"attachmentId":"a","size":4}},
            {"mimeType":"application/pdf","filename":"a.pdf","body":{"attachmentId":"b","size":5}},
            {"mimeType":"application/pdf","filename":"c.pdf","body":{"data":"JVBERg","size":4}}
        ]});
        let parts = inspect(&payload).unwrap();
        assert_eq!(parts.plain.as_deref(), Some("1.0"));
        assert_eq!(parts.attachments.len(), 4);
        assert_eq!(resolve(&payload, "4").unwrap()["filename"], "c.pdf");
        assert!(resolve(&payload, "../4").is_err());
    }

    #[test]
    fn rejects_excess_padding_and_deduplicates_storage_not_names() {
        assert!(decode("AA====",1,10).is_err());
        let payload = json!({"mimeType":"multipart/mixed","parts":[
            {"mimeType":"application/pdf","filename":"a.pdf","body":{"attachmentId":"same","size":1}},
            {"mimeType":"application/pdf","filename":"a.pdf","body":{"attachmentId":"same","size":1}},
            {"mimeType":"application/pdf","filename":"a.pdf","body":{"attachmentId":"other","size":1}}
        ]});
        assert_eq!(inspect(&payload).unwrap().attachments.len(),2);
        let mut deep = json!({"mimeType":"text/plain","body":{"data":"","size":0}});
        for _ in 0..32 {deep=json!({"mimeType":"multipart/mixed","parts":[deep]});}
        assert!(inspect(&deep).is_err());
    }

    #[test]
    fn binary_decode_rejects_corruption_and_size_lies() {
        assert_eq!(decode("AP_-AQ==", 4, MAX_FILE_BYTES).unwrap(), [0,255,254,1]);
        assert!(decode("%%%",3,MAX_FILE_BYTES).is_err());
        assert!(decode("AA",2,MAX_FILE_BYTES).is_err());
        assert!(decode("AAAA",3,2).is_err());
        assert_eq!(safe_filename("../../a\r\n.pdf"), "a.pdf");
    }

    #[test]
    fn inline_images_and_attached_messages_do_not_become_outer_body() {
        let value = json!({"mimeType":"multipart/mixed","parts":[
            {"mimeType":"image/png","headers":[{"name":"Content-ID","value":"<logo>"},{"name":"Content-Disposition","value":"inline"}],"body":{"attachmentId":"logo","size":12}},
            {"mimeType":"message/rfc822","filename":"old.eml","body":{"attachmentId":"old","size":50},"parts":[{"mimeType":"text/plain","body":{"data":"b2xk","size":3}}]}
        ]});
        let parts = inspect(&value).unwrap();
        assert!(parts.plain.is_none());
        assert_eq!(parts.attachments.len(),2);
        assert_eq!(parts.attachments[0].content_id.as_deref(),Some("logo"));
        assert!(parts.attachments[0].inline);
    }
}
