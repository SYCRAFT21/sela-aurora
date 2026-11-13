import {useEffect,useRef,useState} from 'react';
import {api,ApiError,type AgentSession,type AgentAction,type MessageReference} from './api';
export function useAssistant(){
 const [session,setSession]=useState<AgentSession|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const current=useRef<AgentSession|null>(null),locked=useRef(false),request=useRef<AbortController|null>(null);
 const [thinking,setThinking]=useState(false);
 function accept(s:AgentSession){if(current.current?.id===s.id&&current.current.revision>s.revision)return current.current;current.current=s;setSession(s);return s;}
 async function run(work:()=>Promise<AgentSession>){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{return accept(await work());}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(String(e));if(e instanceof ApiError&&[404,410].includes(e.status)){current.current=null;setSession(null);}else if(current.current){try{accept(await api.getAssistant(current.current.id));}catch{ /* Preserve local draft on transient failure. */ }}}finally{locked.current=false;setBusy(false);}}
 function open(){return run(async()=>current.current?api.getAssistant(current.current.id):api.createAssistant());}
 async function access(consent:boolean,accounts:string[],selected?:MessageReference){request.current?.abort();const s=current.current;if(!s)return;setError('');try{return accept(await api.patchAssistant(s.id,s.revision,consent,accounts,selected));}catch(e){setError(String(e));}}
 useEffect(()=>()=>request.current?.abort(),[]);
 function chat(text:string){return run(async()=>{const s=current.current;if(!s)throw Error('Mulai sesi terlebih dahulu.');const controller=new AbortController();request.current=controller;setThinking(true);try{return await api.assistantTurn(s.id,s.revision,text,s.draft?.draft.timezone||'Asia/Jakarta',controller.signal);}finally{request.current=null;setThinking(false);}});}
 function cancel(){if(request.current){request.current.abort();const s=current.current;if(s)void access(s.consent,s.accounts);}}
 function action(action:AgentAction){return run(async()=>{const s=current.current;if(!s)throw Error('Mulai sesi terlebih dahulu.');return api.assistantAction(s.id,s.revision,action);});}
 function confirm(id:string){return run(async()=>{const s=current.current;if(!s)throw Error('Sesi berakhir.');return api.confirmAssistant(s.id,id,s.revision);});}
 function clear(){return run(async()=>{if(current.current)await api.clearAssistant(current.current.id);return api.createAssistant();});}
 return {session,busy,thinking,error,open,access,chat,action,confirm,clear,cancel};
}
