use std::{fs, io, path::Path, process::{Command, Stdio}};

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq)]
pub struct SavedAccount {
    pub id: String,
    pub email: String,
    pub provider: String,
}

pub fn load(path: &Path) -> io::Result<Vec<SavedAccount>> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(io::Error::other),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error),
    }
}

pub fn save(path: &Path, accounts: &[SavedAccount]) -> io::Result<()> {
    write_json(path, accounts, false)
}

pub fn write_json(path: &Path, value: &(impl serde::Serialize + ?Sized), create_only: bool) -> io::Result<()> {
    let data = serde_json::to_vec_pretty(value).map_err(io::Error::other)?;
    let temp = path.with_extension(format!("{}-{}.tmp", std::process::id(), rand::random::<u64>()));
    let mut owned = false;
    let result = (|| {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&temp)?;
        owned = true;
        use std::io::Write;
        file.write_all(&data)?;
        file.sync_all()?;
        if create_only { fs::hard_link(&temp, path)?; Ok(()) } else { fs::rename(&temp, path) }
    })();
    // Only remove the temporary file owned by this attempt, never the destination.
    if owned { let _ = fs::remove_file(&temp); }
    result
}

fn lookup_with(binary: &str, id: &str) -> io::Result<Option<String>> {
    let output = Command::new(binary).args(["lookup", "service", "mailbox-local", "account", id])
        .stdin(Stdio::null()).output()?;
    match output.status.code() {
        Some(0) => Ok(Some(String::from_utf8(output.stdout).map_err(io::Error::other)?.trim_end_matches('\n').to_owned())),
        Some(1) if output.stdout.is_empty() && output.stderr.is_empty() => Ok(None),
        _ => Err(io::Error::other("OS keyring unavailable; unlock keyring before starting the app")),
    }
}

pub fn lookup(id: &str) -> io::Result<Option<String>> { lookup_with("secret-tool", id) }

pub fn store(id: &str, token: &str) -> io::Result<()> {
    use std::io::Write;
    let mut child = Command::new("secret-tool")
        .args(["store", "--label=Unified Inbox", "service", "mailbox-local", "account", id])
        .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn()?;
    child.stdin.take().unwrap().write_all(token.as_bytes())?;
    if child.wait()?.success() { Ok(()) } else { Err(io::Error::other("OS keyring rejected token")) }
}

pub fn disconnect_account(path: &Path, accounts: &[SavedAccount], id: &str, remove_token: impl FnOnce(&str) -> io::Result<()>) -> io::Result<()> {
    let kept: Vec<_> = accounts.iter().filter(|account| account.id != id).cloned().collect();
    save(path, &kept)?;
    if let Err(error) = remove_token(id) {
        save(path, accounts).map_err(|rollback| io::Error::other(format!("Keyring gagal: {error}; pemulihan daftar akun gagal: {rollback}")))?;
        return Err(error);
    }
    Ok(())
}

pub fn remove(id: &str) -> io::Result<()> {
    let status = Command::new("secret-tool").args(["clear", "service", "mailbox-local", "account", id])
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status()?;
    if status.success() { Ok(()) } else { Err(io::Error::other("OS keyring rejected removal")) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_metadata_is_empty_but_corrupt_metadata_fails() {
        let path = std::env::temp_dir().join(format!("mailbox-corrupt-{}.json", std::process::id()));
        assert!(load(&path).unwrap().is_empty());
        fs::write(&path, b"not json").unwrap();
        assert!(load(&path).is_err());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn removing_one_account_preserves_the_other() {
        let path = std::env::temp_dir().join(format!("mailbox-remove-{}.json", std::process::id()));
        let accounts = vec![SavedAccount { id: "one".into(), email: "a@example.com".into(), provider: "google".into() },
            SavedAccount { id: "two".into(), email: "b@example.com".into(), provider: "microsoft".into() }];
        save(&path, &accounts).unwrap();
        let kept: Vec<_> = load(&path).unwrap().into_iter().filter(|a| a.id != "one").collect();
        save(&path, &kept).unwrap();
        assert_eq!(load(&path).unwrap(), accounts[1..]);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn metadata_write_failure_never_removes_token() {
        let missing = std::env::temp_dir().join(format!("mailbox-no-dir-{}", std::process::id())).join("accounts.json");
        let accounts = vec![SavedAccount { id: "one".into(), email: "a@example.test".into(), provider: "google".into() }];
        let removed = std::cell::Cell::new(false);
        assert!(disconnect_account(&missing, &accounts, "one", |_| { removed.set(true); Ok(()) }).is_err());
        assert!(!removed.get());
    }

    #[test]
    fn keyring_failure_rolls_back_metadata() {
        let path = std::env::temp_dir().join(format!("mailbox-rollback-{}.json", std::process::id()));
        let accounts = vec![SavedAccount { id: "one".into(), email: "a@example.test".into(), provider: "google".into() }];
        save(&path, &accounts).unwrap();
        assert!(disconnect_account(&path, &accounts, "one", |_| Err(io::Error::other("keyring failed"))).is_err());
        assert_eq!(load(&path).unwrap(), accounts);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn keyring_failure_never_returns_empty_success() {
        assert!(lookup_with("/no/such/secret-tool", "one").is_err());
    }

    #[test]
    fn metadata_roundtrip_never_contains_tokens() {
        let path = std::env::temp_dir().join(format!("mailbox-{}.json", std::process::id()));
        let accounts = vec![SavedAccount { id: "one".into(), email: "a@example.com".into(), provider: "google".into() },
            SavedAccount { id: "two".into(), email: "b@example.com".into(), provider: "microsoft".into() }];
        save(&path, &accounts).unwrap();
        let raw = fs::read_to_string(&path).unwrap();
        assert!(!raw.contains("refresh_token"));
        assert_eq!(load(&path).unwrap(), accounts);
        fs::remove_file(path).unwrap();
    }
}
