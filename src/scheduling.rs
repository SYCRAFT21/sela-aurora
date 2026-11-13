use chrono::{DateTime, Utc, TimeZone};
use serde::{Deserialize,Serialize};
use crate::{assistant::Draft, app::AppResult};

pub(super) fn validate(d:&Draft, sender:&str, now:DateTime<Utc>) -> AppResult<String> {
    crate::compose::compose_raw(sender,&d.to,&d.subject,&d.body,None,(!d.cc.is_empty()).then_some(d.cc.as_str()),(!d.bcc.is_empty()).then_some(d.bcc.as_str()))?;
    if d.body.len()>16384 {return Err((axum::http::StatusCode::BAD_REQUEST,"Isi rencana maksimal16 KiB".into()));}
    let invalid=||(axum::http::StatusCode::BAD_REQUEST,"Tanggal harus mendatang; zona yang tersedia: UTC, Asia/Jakarta, Asia/Makassar, Asia/Jayapura".into());
    let hours=match d.timezone.as_str(){"UTC"=>0,"Asia/Jakarta"=>7,"Asia/Makassar"=>8,"Asia/Jayapura"=>9,_=>return Err(invalid())};
    let local=chrono::NaiveDateTime::parse_from_str(&d.local_datetime,"%Y-%m-%dT%H:%M").map_err(|_|invalid())?;
    let date=chrono::FixedOffset::east_opt(hours*3600).unwrap().from_local_datetime(&local).single().ok_or_else(invalid)?.with_timezone(&Utc);
    if date<=now {return Err(invalid());} Ok(date.to_rfc3339())
}

// ponytail: storage-independent queue domain only; production authorization/worker belongs to Phase 2.
#[allow(dead_code)]
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize)]
pub(super) enum JobState {Scheduled,Sending,Sent,Failed,Canceled}
#[allow(dead_code)]
#[derive(Serialize,Deserialize)]
pub(super) struct Job {pub state:JobState,pub key:String,pub digest:String,pub due:i64,pub attempts:u8,pub failure:Option<String>,pub message_id:Option<String>}
#[allow(dead_code)]
impl Job {
    pub fn confirmed(key:String,digest:String,due:i64)->Self{Self{state:JobState::Scheduled,key,digest,due,attempts:0,failure:None,message_id:None}}
    pub fn claim(&mut self,now:i64)->bool {
        if self.state!=JobState::Scheduled || now<self.due{return false;}
        if now-self.due>86400 {self.state=JobState::Failed;self.failure=Some("missed_schedule".into());return false;}
        self.state=JobState::Sending;self.attempts+=1;true
    }
    pub fn cancel(&mut self)->bool {if self.state!=JobState::Scheduled{return false;}self.state=JobState::Canceled;true}
    pub fn recover(&mut self){if self.state==JobState::Sending{self.state=JobState::Failed;self.failure=Some("delivery_uncertain".into());}}
    pub fn complete(&mut self,id:Option<String>,explicit_rate_limit:bool,now:i64){
        if self.state!=JobState::Sending{return;}
        if let Some(id)=id.filter(|s|!s.is_empty()){self.state=JobState::Sent;self.message_id=Some(id);}
        else if explicit_rate_limit && self.attempts<4 {self.state=JobState::Scheduled;self.due=now+[30,120,600][(self.attempts-1)as usize];}
        else {self.state=JobState::Failed;self.failure=Some(if explicit_rate_limit{"rate_limit_exhausted"}else{"delivery_uncertain"}.into());}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn draft() -> crate::assistant::Draft { crate::assistant::Draft {sender_hint:"writer@example.test".into(),to:"reader@example.test".into(),subject:"Follow up".into(),body:"Hello".into(),local_datetime:"2026-11-14T09:00".into(),timezone:"Asia/Jakarta".into(),..Default::default()} }
    #[test]
    fn validates_time_without_silent_timezone_fallback() {
        let now=chrono::DateTime::parse_from_rfc3339("2026-11-13T12:00:00Z").unwrap().with_timezone(&chrono::Utc);
        assert_eq!(validate(&draft(),"writer@example.test",now).unwrap(),"2026-11-14T02:00:00+00:00");
        let mut d=draft();d.timezone="Europe/London".into();assert!(validate(&d,"writer@example.test",now).is_err());
        d=draft();d.to="victim@example.test\r\nBcc:other@example.test".into();assert!(validate(&d,"writer@example.test",now).is_err());
    }
    #[tokio::test]
    async fn synthetic_worker_child() {
        let Ok(path)=std::env::var("AURORA_TEST_JOB") else{return;};
        let mut job:Job=serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        if job.state==JobState::Sending {job.recover();crate::persistence::write_json(std::path::Path::new(&path),&job,false).unwrap();return;}
        if !job.claim(100){return;}
        crate::persistence::write_json(std::path::Path::new(&path),&job,false).unwrap();
        if std::env::var("AURORA_TEST_STOP_AFTER_CLAIM").is_ok(){return;}
        let url=std::env::var("AURORA_TEST_GMAIL").unwrap();assert!(url.starts_with("http://127.0.0.1:"));
        let response=reqwest::Client::new().post(url).body("synthetic MIME only").send().await.unwrap();
        let id=response.json::<serde_json::Value>().await.unwrap()["id"].as_str().map(str::to_owned);
        job.complete(id,false,100);crate::persistence::write_json(std::path::Path::new(&path),&job,false).unwrap();
    }
    #[tokio::test]
    async fn independent_synthetic_worker_persists_claim_and_recovers_without_resend() {
        let path=std::env::temp_dir().join(format!("aurora-worker-fixture-{}.json",rand::random::<u64>()));
        let count=std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));let observed=count.clone();
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();let address=listener.local_addr().unwrap();
        let server=tokio::spawn(async move{axum::serve(listener,axum::Router::new().route("/",axum::routing::post(move||{let count=observed.clone();async move{count.fetch_add(1,std::sync::atomic::Ordering::SeqCst);axum::Json(serde_json::json!({"id":"fictional-message"}))}}))).await.unwrap();});
        let run=|crash:bool|{let path=path.clone();async move{tokio::task::spawn_blocking(move||{
            let mut command=std::process::Command::new(std::env::current_exe().unwrap());command.args(["--exact","scheduling::tests::synthetic_worker_child","--nocapture"]).env("AURORA_TEST_JOB",path).env("AURORA_TEST_GMAIL",format!("http://{address}/"));
            if crash{command.env("AURORA_TEST_STOP_AFTER_CLAIM","1");}else{command.env_remove("AURORA_TEST_STOP_AFTER_CLAIM");}
            assert!(command.output().unwrap().status.success());
        }).await.unwrap();}};
        crate::persistence::write_json(&path,&Job::confirmed("fixture-key".into(),"fixture-digest".into(),100),false).unwrap();
        run(false).await;let job:Job=serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();assert_eq!(job.state,JobState::Sent);assert_eq!(job.message_id.as_deref(),Some("fictional-message"));
        crate::persistence::write_json(&path,&Job::confirmed("fixture-key2".into(),"fixture-digest2".into(),100),false).unwrap();
        run(true).await;run(false).await;let job:Job=serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();assert_eq!(job.failure.as_deref(),Some("delivery_uncertain"));assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst),1);
        server.abort();std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn explicit_rate_limit_has_bounded_retries_and_missed_jobs_fail() {
        let mut job=Job::confirmed("key".into(),"digest".into(),100);
        for (now,next) in [(100,130),(130,250),(250,850)]{assert!(job.claim(now));job.complete(None,true,now);assert_eq!(job.due,next);}
        assert!(job.claim(850));job.complete(None,true,850);assert_eq!(job.state,JobState::Failed);
        let mut job=Job::confirmed("key".into(),"digest".into(),100);assert!(!job.claim(86501));assert_eq!(job.failure.as_deref(),Some("missed_schedule"));
    }
    #[test]
    fn uncertain_attempt_cannot_be_retried_or_canceled() {
        let mut job=Job::confirmed("key".into(),"digest".into(),100);
        assert!(job.claim(100));assert!(!job.cancel());job.recover();
        assert_eq!(job.state,JobState::Failed);assert_eq!(job.failure.as_deref(),Some("delivery_uncertain"));assert!(!job.claim(200));
        let mut job=Job::confirmed("key".into(),"digest".into(),100);
        assert!(job.cancel());assert!(!job.claim(100));
    }
}
