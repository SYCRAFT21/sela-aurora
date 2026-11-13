use axum::{extract::{Path, State}, http::{header, HeaderMap, StatusCode}, Json};
use crate::{persistence, app::{Account, AccountView, AppResult, AppState, check_local_origin}};

pub(super) fn saved_account(account: &Account) -> persistence::SavedAccount {
    persistence::SavedAccount { id: account.id.clone(), email: account.email.clone(), provider: account.provider.clone() }
}

pub(super) async fn disconnect(Path(id): Path<String>, State(state): State<AppState>, headers: HeaderMap) -> AppResult<StatusCode> {
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

pub(super) async fn accounts(State(state): State<AppState>, headers: HeaderMap) -> AppResult<impl axum::response::IntoResponse> {
    check_local_origin(&headers)?;
    let mut list: Vec<_> = state.accounts.read().await.values().map(|account| AccountView {
        id: account.id.clone(), email: account.email.clone(), provider: account.provider.clone(),
        reconnect: account.refresh_token.is_none(), gmail_modify: account.gmail_modify,
    }).collect();
    list.sort_by(|a, b| a.email.cmp(&b.email));
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(list)))
}
