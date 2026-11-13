mod persistence;
mod settings;
mod ai;
mod assistant;
mod agent;
mod scheduling;
mod schedule_store;
mod attachments;
mod app;
mod oauth;
mod accounts;
mod mailbox;
mod compose;
mod gmail;
mod graph;
mod downloads;
#[cfg(test)]
mod tests;

use std::{collections::HashMap, net::SocketAddr, sync::Arc, time::{Duration, Instant}};
use axum::http::StatusCode;
use tokio::sync::{Mutex, RwLock, Semaphore};
use app::{Account, AppState};

#[cfg(test)]
type ClientConfig = settings::OAuth;

fn provider_http_client() -> reqwest::Client {
    reqwest::Client::builder().connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30)).build().expect("HTTP client tidak dapat dibuat")
}

fn network_error(error: reqwest::Error) -> (StatusCode, String) {
    (StatusCode::BAD_GATEWAY, format!("Provider email gagal: {error}"))
}

#[tokio::main]
async fn main() {
    let settings_file = std::path::PathBuf::from("config/app.json");
    let settings = settings::load(&settings_file).expect("Konfigurasi gagal dibaca; periksa config/app.json dan izin privat direktori/file (0700/0600)");
    let google = settings.google.clone();
    let microsoft = settings.microsoft.clone();
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
        settings: Arc::new(Mutex::new(settings)), settings_file,
        ai_http: ai::client(Duration::from_secs(90)), ai_requests: Arc::new(Semaphore::new(1)),
        proposals: Arc::new(Mutex::new(None)),
        agent_sessions: Arc::new(Mutex::new(HashMap::new())),
    };
    let app = app::router(state);
    let address: SocketAddr = "127.0.0.1:3000".parse().unwrap();
    println!("Buka http://{address}");
    axum::serve(tokio::net::TcpListener::bind(address).await.unwrap(), app)
        .await
        .unwrap();
}
