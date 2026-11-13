use std::{fs,io,path::{Path,PathBuf}};
use serde::{Serialize,Deserialize};
use axum::{extract::{State,Path as RoutePath},http::{HeaderMap,StatusCode},Json};
use crate::{assistant::Draft,app::{AppState,AppResult,check_settings_origin}};

#[derive(Clone,Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Proposal {pub id:String,pub revision:u64,pub key:String,pub account_id:String,pub draft:Draft,pub utc:String,pub created_at:String,pub updated_at:String,pub state:String}
#[derive(Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
struct Document {version:u8,proposals:Vec<Proposal>}
pub(super) struct Store {dir:PathBuf,_lock:fs::File,document:Document,failed:bool}
impl Drop for Store {
    fn drop(&mut self) { let _ = self._lock.unlock(); }
}
fn private(path:&Path,dir:bool)->io::Result<()> {
    let m=fs::symlink_metadata(path)?;
    if m.file_type().is_symlink() || (dir&&!m.is_dir()) || (!dir&&!m.is_file()){return Err(io::Error::other("Unsafe proposal storage"));}
    #[cfg(unix)] {use std::os::unix::fs::{MetadataExt,PermissionsExt};if m.permissions().mode()&0o777 != if dir{0o700}else{0o600} || (!dir&&m.nlink()!=1){return Err(io::Error::other("Proposal storage requires private permissions"));}}
    Ok(())
}
impl Store {
    pub fn open(dir:&Path)->io::Result<Self>{
        if !dir.exists(){let mut b=fs::DirBuilder::new();#[cfg(unix)]{use std::os::unix::fs::DirBuilderExt;b.mode(0o700);}b.create(dir)?;}
        private(dir,true)?;
        let lockpath=dir.join("store.lock");
        if lockpath.exists(){private(&lockpath,false)?;}
        let mut o=fs::OpenOptions::new();o.read(true).write(true);
        #[cfg(unix)]{use std::os::unix::fs::OpenOptionsExt;o.mode(0o600);}
        let lock=if lockpath.exists(){o.open(&lockpath)?}else{o.create_new(true).open(&lockpath)?};
        private(&lockpath,false)?;lock.try_lock().map_err(|_|io::Error::other("Proposal store already in use"))?;
        let path=dir.join("proposals.json");
        let document=match fs::symlink_metadata(&path){
            Ok(m)=>{private(&path,false)?;if m.len()>2_097_152{return Err(io::Error::other("Proposal storage exceeds limit"));}serde_json::from_slice::<Document>(&fs::read(&path)?).map_err(|_|io::Error::other("Corrupt proposal storage"))?},
            Err(e)if e.kind()==io::ErrorKind::NotFound=>Document{version:1,proposals:vec![]},Err(e)=>return Err(e),
        };
        if document.version!=1 || document.proposals.len()>100{return Err(io::Error::other("Unsupported proposal storage"));}
        Ok(Self{dir:dir.to_owned(),_lock:lock,document,failed:false})
    }
    fn commit(&mut self,next:Vec<Proposal>)->io::Result<()> {
        if self.failed{return Err(io::Error::other("Store requires reopen"));}
        let doc=Document{version:1,proposals:next};
        if doc.proposals.len()>100 || serde_json::to_vec_pretty(&doc)?.len()>2_097_152{return Err(io::Error::other("Proposal storage limit"));}
        private(&self.dir,true)?;let path=self.dir.join("proposals.json");
        if path.exists(){private(&path,false)?;}
        let result=crate::persistence::write_json(&path,&doc,false).and_then(|_|fs::File::open(&self.dir)?.sync_all());
        if result.is_err(){self.failed=true;return result;}
        self.document=doc;Ok(())
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Change {pub key:String,pub account_id:String,pub draft:Draft,pub revision:Option<u64>,pub attachments:Option<Vec<serde_json::Value>>}
fn failure()->(StatusCode,String){(StatusCode::SERVICE_UNAVAILABLE,"Rencana tidak tersedia; periksa penyimpanan privat. Tidak ada email dijadwalkan.".into())}
fn path(state:&AppState)->PathBuf{state.settings_file.with_file_name("schedule-proposals")}
async fn with_store<T>(state:&AppState,f:impl FnOnce(&mut Store)->AppResult<T>)->AppResult<T>{
    let mut slot=state.proposals.lock().await;
    if slot.is_none(){*slot=Some(Store::open(&path(state)).map_err(|_|failure())?);}
    let store=slot.as_mut().unwrap();if store.failed{return Err(failure());}f(store)
}
pub(super) async fn list(State(state):State<AppState>,headers:HeaderMap)->AppResult<Json<Vec<Proposal>>>{
    crate::app::check_local_origin(&headers)?;
    with_store(&state,|s|Ok(Json(s.document.proposals.clone()))).await
}
pub(super) async fn create(State(state):State<AppState>,headers:HeaderMap,Json(change):Json<Change>)->AppResult<Json<Proposal>>{save(state,headers,None,change).await}
pub(super) async fn update(State(state):State<AppState>,headers:HeaderMap,RoutePath(id):RoutePath<String>,Json(change):Json<Change>)->AppResult<Json<Proposal>>{save(state,headers,Some(id),change).await}
async fn save(state:AppState,headers:HeaderMap,id:Option<String>,change:Change)->AppResult<Json<Proposal>>{
    check_settings_origin(&headers)?;
    if change.key.is_empty() || change.key.len()>100 || !change.key.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'-') || change.attachments.as_ref().is_some_and(|a|!a.is_empty()){return Err((StatusCode::BAD_REQUEST,"Rencana hanya teks; lampiran belum disimpan".into()));}
    let accounts=state.accounts.read().await;
    let account=accounts.get(&change.account_id).filter(|a|a.provider=="google").ok_or((StatusCode::BAD_REQUEST,"Pilih akun Gmail yang terhubung".into()))?;
    let utc=crate::scheduling::validate(&change.draft,&account.email,chrono::Utc::now())?;drop(accounts);
    with_store(&state,|s|{
        let mut next=s.document.proposals.clone();let now=chrono::Utc::now().to_rfc3339();
        if id.is_none(){if let Some(old)=next.iter().find(|p|p.key==change.key){
            if old.account_id==change.account_id && serde_json::to_value(&old.draft).ok()==serde_json::to_value(&change.draft).ok(){return Ok(Json(old.clone()));}
            return Err((StatusCode::CONFLICT,"Kunci rencana sudah digunakan".into()));
        }}
        let proposal=if let Some(id)=id{
            let old=next.iter_mut().find(|p|p.id==id).ok_or((StatusCode::NOT_FOUND,"Rencana tidak ditemukan".into()))?;
            if change.revision!=Some(old.revision){return Err((StatusCode::CONFLICT,"Rencana berubah; muat ulang sebelum menyetujui".into()));}
            old.revision+=1;old.account_id=change.account_id;old.draft=change.draft;old.utc=utc;old.updated_at=now;old.clone()
        }else{let p=Proposal{id:format!("{:032x}",rand::random::<u128>()),revision:1,key:change.key,account_id:change.account_id,draft:change.draft,utc,created_at:now.clone(),updated_at:now,state:"draft".into()};next.push(p.clone());p};
        s.commit(next).map_err(|_|failure())?;Ok(Json(proposal))
    }).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Revision{pub revision:u64}
pub(super) async fn remove(State(state):State<AppState>,headers:HeaderMap,RoutePath(id):RoutePath<String>,Json(revision):Json<Revision>)->AppResult<StatusCode>{
    check_settings_origin(&headers)?;with_store(&state,|s|{
        let old=s.document.proposals.iter().find(|p|p.id==id).ok_or((StatusCode::NOT_FOUND,"Rencana tidak ditemukan".into()))?;
        if old.revision!=revision.revision{return Err((StatusCode::CONFLICT,"Rencana berubah; muat ulang".into()));}
        let next=s.document.proposals.iter().filter(|p|p.id!=id).cloned().collect();s.commit(next).map_err(|_|failure())?;Ok(StatusCode::NO_CONTENT)
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persisted_proposals_survive_reopen_and_failed_write_preserves_memory() {
        let path=std::env::temp_dir().join(format!("aurora-store-roundtrip-{}",rand::random::<u64>()));
        let mut store=Store::open(&path).unwrap();
        let proposal=Proposal{id:"fixture".into(),revision:1,key:"fixture-key".into(),account_id:"one".into(),draft:crate::assistant::Draft::default(),utc:String::new(),created_at:String::new(),updated_at:String::new(),state:"draft".into()};
        store.commit(vec![proposal]).unwrap();drop(store);
        let mut store=Store::open(&path).unwrap();assert_eq!(store.document.proposals.len(),1);
        std::fs::remove_file(path.join("proposals.json")).unwrap();std::fs::create_dir(path.join("proposals.json")).unwrap();
        assert!(store.commit(vec![]).is_err());assert_eq!(store.document.proposals.len(),1);
        drop(store);std::fs::remove_dir_all(path).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn rejects_public_permissions_and_symlink_storage() {
        use std::os::unix::{fs::{PermissionsExt,symlink}};
        let path=std::env::temp_dir().join(format!("aurora-store-private-{}",rand::random::<u64>()));
        let store=Store::open(&path).unwrap();drop(store);
        std::fs::set_permissions(&path,std::fs::Permissions::from_mode(0o755)).unwrap();assert!(Store::open(&path).is_err());
        std::fs::set_permissions(&path,std::fs::Permissions::from_mode(0o700)).unwrap();
        symlink("nonexistent",path.join("proposals.json")).unwrap();assert!(Store::open(&path).is_err());
        std::fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn oversized_pretty_document_is_rejected_before_write() {
        let path=std::env::temp_dir().join(format!("aurora-limit-{}",rand::random::<u64>()));let mut store=Store::open(&path).unwrap();
        let mut draft=crate::assistant::Draft::default();draft.body="x".repeat(20600);
        let p=Proposal{id:"x".into(),revision:1,key:"x".into(),account_id:"one".into(),draft,utc:String::new(),created_at:String::new(),updated_at:String::new(),state:"draft".into()};
        let mut values=vec![p;100];
        // Choose content where compact JSON fits, but the actual pretty file exceeds the cap.
        while serde_json::to_vec_pretty(&Document{version:1,proposals:values.clone()}).unwrap().len()<=2_097_152 {for p in &mut values{p.draft.body.push('x');}}
        assert!(serde_json::to_vec(&Document{version:1,proposals:values.clone()}).unwrap().len()<2_097_152);
        assert!(store.commit(values).is_err());assert!(!path.join("proposals.json").exists());drop(store);std::fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn private_store_reopens_and_rejects_second_writer_and_corruption() {
        let path=std::env::temp_dir().join(format!("aurora-proposals-{}",rand::random::<u64>()));
        let store=Store::open(&path).unwrap();
        assert!(Store::open(&path).is_err());
        #[cfg(unix)] {use std::os::unix::fs::PermissionsExt;assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode()&0o777,0o700);}
        drop(store);assert!(Store::open(&path).is_ok());
        std::fs::write(path.join("proposals.json"),b"corrupt").unwrap();
        assert!(Store::open(&path).is_err());std::fs::remove_dir_all(path).unwrap();
    }
}
