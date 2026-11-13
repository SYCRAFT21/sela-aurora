use std::{fs, io::{self, Read}, path::Path};
use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct OAuth { pub client_id: String, pub client_secret: Option<String> }

#[derive(Clone, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct Ai { pub enabled: bool, pub model: String, pub api_key: String, pub protocol: Protocol, pub endpoint: String }
#[derive(Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all="snake_case")]
pub enum Protocol { OpenaiCompatible, #[default] Anthropic }
impl Default for Ai {
    fn default() -> Self { Self { enabled: false, model: "claude-opus-5-5".into(), api_key: String::new(), protocol: Protocol::Anthropic, endpoint: "https://api.anthropic.com/v1/messages".into() } }
}
impl Ai {
    pub fn validate_endpoint(&self) -> io::Result<()> {
        if self.endpoint.len()>2048 || self.endpoint.chars().any(|c| c.is_control() || c.is_whitespace()) { return Err(invalid()); }
        let url=url::Url::parse(&self.endpoint).map_err(|_| invalid())?;
        let local=match url.host() {
            Some(url::Host::Domain(name)) => name=="localhost",
            Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
            Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
            None => false,
        };
        if url.host().is_none() || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some()
            || !(url.scheme()=="https" || url.scheme()=="http" && local) { return Err(invalid()); }
        Ok(())
    }
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Appearance { pub theme: String, pub density: String, pub read_mode: String }

#[derive(Clone, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct Settings {
    pub version: u32,
    pub google: OAuth,
    pub microsoft: OAuth,
    pub ai: Ai,
    pub appearance: Option<Appearance>,
}
impl Default for Settings {
    fn default() -> Self { Self { version: 1, google: OAuth::default(), microsoft: OAuth::default(), ai: Ai::default(), appearance: None } }
}
#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Patch {
    pub model: Option<String>, pub enabled: Option<bool>, pub api_key: Option<String>,
    pub protocol: Option<Protocol>, pub endpoint: Option<String>,
    #[serde(default)] pub clear_api_key: bool,
    pub appearance: Option<Appearance>,
}

fn invalid() -> io::Error { io::Error::other("Konfigurasi tidak valid; periksa format, batas, dan izin file") }

pub fn private_path(path: &Path, directory: bool) -> io::Result<()> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() || (directory && !meta.is_dir()) || (!directory && !meta.is_file()) { return Err(invalid()); }
    #[cfg(unix)] {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        // The parent and file must belong to the same user, with no group/other access.
        if meta.permissions().mode() & 0o077 != 0 { return Err(invalid()); }
        if !directory && meta.uid() != fs::metadata(path.parent().ok_or_else(invalid)?)?.uid() { return Err(invalid()); }
    }
    Ok(())
}
fn read<T: serde::de::DeserializeOwned>(path: &Path, private: bool) -> io::Result<T> {
    if private { private_path(path, false)?; }
    else if fs::symlink_metadata(path)?.file_type().is_symlink() { return Err(invalid()); }
    let mut data = Vec::new();
    fs::File::open(path)?.take(65_537).read_to_end(&mut data)?;
    if data.len() > 65_536 { return Err(invalid()); }
    serde_json::from_slice(&data).map_err(|_| invalid())
}
impl Settings {
    pub fn validate(&self) -> io::Result<()> {
        self.ai.validate_endpoint()?;
        let header = |s: &str, max: usize| s.len() <= max && s.bytes().all(|b| (0x21..=0x7e).contains(&b));
        if self.version != 1 || !header(&self.ai.api_key, 4096) || self.ai.model.is_empty() || !header(&self.ai.model, 128)
            || !self.ai.model.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_./:".contains(&b))
            || [ &self.google, &self.microsoft ].iter().any(|o| !header(&o.client_id, 4096) || o.client_secret.as_ref().is_some_and(|s| !header(s, 4096))) {
            return Err(invalid());
        }
        if let Some(a) = &self.appearance {
            if !["dark", "light"].contains(&a.theme.as_str()) || !["comfortable", "compact"].contains(&a.density.as_str()) || !["Adaptive", "Original", "Plain Text"].contains(&a.read_mode.as_str()) { return Err(invalid()); }
        }
        Ok(())
    }
    pub fn view(&self) -> serde_json::Value {
        serde_json::json!({"ai":{"enabled":self.ai.enabled,"model":self.ai.model,"protocol":self.ai.protocol,"endpoint":self.ai.endpoint,"key_configured":!self.ai.api_key.is_empty()},"appearance":self.appearance})
    }
    pub fn patched(&self, patch: Patch) -> io::Result<Self> {
        if patch.clear_api_key && patch.api_key.is_some() { return Err(invalid()); }
        let mut next = self.clone();
        if let Some(v) = patch.protocol { next.ai.protocol=v; }
        if let Some(v) = patch.endpoint { next.ai.endpoint=v; }
        if (next.ai.protocol!=self.ai.protocol || next.ai.endpoint!=self.ai.endpoint) && !self.ai.api_key.is_empty() && patch.api_key.is_none() && !patch.clear_api_key { return Err(invalid()); }
        if let Some(v) = patch.model { next.ai.model = v; }
        if let Some(v) = patch.enabled { next.ai.enabled = v; }
        if let Some(v) = patch.api_key { if v.is_empty() { return Err(invalid()); } next.ai.api_key = v; }
        if patch.clear_api_key { next.ai.api_key.clear(); next.ai.enabled = false; }
        if let Some(v) = patch.appearance { next.appearance = Some(v); }
        next.validate()?;
        Ok(next)
    }
}
pub fn load(path: &Path) -> io::Result<Settings> {
    let dir = path.parent().ok_or_else(invalid)?;
    match fs::symlink_metadata(dir) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            let mut builder = fs::DirBuilder::new();
            #[cfg(unix)] { use std::os::unix::fs::DirBuilderExt; builder.mode(0o700); }
            builder.create(dir)?;
        }
        Err(e) => return Err(e),
        Ok(_) => {}
    }
    private_path(dir, true)?;
    match fs::symlink_metadata(path) {
        Ok(_) => { let value: Settings = read(path, true)?; value.validate()?; Ok(value) }
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            let mut value = Settings::default();
            for (name, target) in [("google.json", &mut value.google), ("microsoft.json", &mut value.microsoft)] {
                let old = dir.join(name);
                match fs::symlink_metadata(&old) {
                    Ok(_) => *target = read(&old, false)?,
                    Err(e) if e.kind() == io::ErrorKind::NotFound => {},
                    Err(e) => return Err(e),
                }
            }
            value.validate()?;
            match crate::persistence::write_json(path, &value, true) {
                Ok(()) => Ok(value),
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => load(path),
                Err(e) => Err(e),
            }
        }
        Err(e) => Err(e),
    }
}
pub fn save(path: &Path, settings: &Settings) -> io::Result<()> {
    settings.validate()?;
    private_path(path.parent().ok_or_else(invalid)?, true)?;
    private_path(path, false)?;
    crate::persistence::write_json(path, settings, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("aurora-settings-{}", rand::random::<u64>()));
        let mut builder = fs::DirBuilder::new();
        #[cfg(unix)] { use std::os::unix::fs::DirBuilderExt; builder.mode(0o700); }
        builder.create(&dir).unwrap(); dir
    }
    #[test]
    fn configurable_destination_preserves_legacy_and_protects_keys() {
        let legacy: Settings = serde_json::from_str(r#"{"ai":{"enabled":true,"model":"claude-opus-5-5","api_key":"old-key"}}"#).unwrap();
        assert_eq!(legacy.view()["ai"]["protocol"], "anthropic");
        assert_eq!(legacy.view()["ai"]["endpoint"], "https://api.anthropic.com/v1/messages");
        let patch = |s| serde_json::from_str::<Patch>(s).unwrap();
        assert!(legacy.patched(patch(r#"{"endpoint":"https://api.openai.com/v1/chat/completions"}"#)).is_err());
        assert!(legacy.patched(patch(r#"{"protocol":"openai_compatible"}"#)).is_err());
        let next=legacy.patched(patch(r#"{"protocol":"openai_compatible","endpoint":"https://api.openai.com/v1/chat/completions","model":"vendor/model:free","api_key":"new-key"}"#)).unwrap();
        assert_eq!(next.view()["ai"]["protocol"], "openai_compatible");
        assert_eq!(next.ai.api_key,"new-key");
        let dir=fixture();let path=dir.join("app.json");load(&path).unwrap();save(&path,&next).unwrap();
        let restored=load(&path).unwrap();assert_eq!(restored.view(),next.view());assert_eq!(restored.ai.api_key,"new-key");
        fs::remove_dir_all(dir).unwrap();
        assert!(!next.view().to_string().contains("new-key"));
        assert_eq!(next.patched(patch(r#"{"model":"other/model:1"}"#)).unwrap().ai.api_key,"new-key");
        let cleared=next.patched(patch(r#"{"endpoint":"http://localhost:11434/v1/chat/completions","clear_api_key":true}"#)).unwrap();
        assert!(cleared.ai.api_key.is_empty());assert!(!cleared.ai.enabled);
        for endpoint in ["https://api.example.test/v1/chat/completions","http://127.0.0.1:9000/v1/chat/completions","http://[::1]:9000/v1/chat/completions"] {
            assert!(Settings::default().patched(serde_json::from_value(serde_json::json!({"endpoint":endpoint})).unwrap()).is_ok(),"{endpoint}");
        }
        for endpoint in ["http://api.example.test/v1","http://192.168.1.1/v1","https://key@example.test/v1","https://example.test/v1?key=secret","https://example.test/v1#fragment","file:///tmp/x","https://example.test:99999/v1"," https://example.test/v1","https://example.test/with space"] {
            assert!(Settings::default().patched(serde_json::from_value(serde_json::json!({"endpoint":endpoint})).unwrap()).is_err(),"{endpoint}");
        }
        assert!(serde_json::from_str::<Patch>(r#"{"protocol":"unknown"}"#).is_err());
    }

    #[test]
    fn imports_legacy_without_changing_accounts_or_legacy_files() {
        let dir = fixture();
        fs::write(dir.join("google.json"), r#"{"client_id":"fixture-id","client_secret":"fixture-secret"}"#).unwrap();
        fs::write(dir.join("accounts.json"), b"synthetic account data").unwrap();
        let config = load(&dir.join("app.json")).unwrap();
        assert_eq!(config.google.client_id, "fixture-id");
        assert_eq!(config.google.client_secret.as_deref(), Some("fixture-secret"));
        assert_eq!(fs::read(dir.join("accounts.json")).unwrap(), b"synthetic account data");
        assert!(dir.join("google.json").exists());
        assert!(dir.join("app.json").exists());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn updates_preserve_secrets_redact_view_and_clear_explicitly() {
        let dir = fixture(); let path = dir.join("app.json");
        let original = load(&path).unwrap();
        let with_key = original.patched(serde_json::from_str(r#"{"api_key":"fixture-key","enabled":true}"#).unwrap()).unwrap();
        save(&path, &with_key).unwrap();
        let next = load(&path).unwrap().patched(serde_json::from_str(r#"{"model":"claude-fixture"}"#).unwrap()).unwrap();
        assert_eq!(next.ai.api_key, "fixture-key");
        let public = next.view().to_string();
        assert!(!public.contains("fixture-key")); assert!(!public.contains("client_secret"));
        assert_eq!(next.view()["ai"]["key_configured"], true);
        let cleared = next.patched(serde_json::from_str(r#"{"clear_api_key":true}"#).unwrap()).unwrap();
        assert!(cleared.ai.api_key.is_empty()); assert!(!cleared.ai.enabled);
        for bad in [r#"{"api_key":"bad\r\nheader"}"#,r#"{"clear_api_key":true,"api_key":"x"}"#,r#"{"api_key":""}"#,r#"{"model":""}"#,r#"{"appearance":{"theme":"x","density":"compact","read_mode":"Adaptive"}}"#] {
            assert!(next.patched(serde_json::from_str(bad).unwrap()).is_err());
        }
        assert!(serde_json::from_str::<Patch>(r#"{"google":{}}"#).is_err());
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600); }
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn corruption_and_write_failures_do_not_overwrite_config() {
        let dir = fixture(); let path = dir.join("app.json"); let value = load(&path).unwrap();
        fs::write(&path, b"corrupt").unwrap();
        assert!(load(&path).is_err()); assert_eq!(fs::read(&path).unwrap(), b"corrupt");
        assert!(crate::persistence::write_json(&path, &value, true).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"corrupt");
        assert!(save(&dir.join("missing.json"), &value).is_err());
        fs::write(&path, vec![b' '; 65_537]).unwrap(); assert!(load(&path).is_err());
        #[cfg(unix)] {
            use std::os::unix::{fs::{symlink, PermissionsExt}};
            fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap(); assert!(load(&path).is_err());
            fs::remove_file(&path).unwrap(); symlink(dir.join("google.json"), &path).unwrap(); assert!(load(&path).is_err());
        }
        fs::remove_dir_all(dir).unwrap();
    }
}
