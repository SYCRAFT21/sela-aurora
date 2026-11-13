import type { Attachment } from './AttachmentGallery';
import type { ReadMode } from './EmailBody';
export type Account = {
    id: string;
    email: string;
    provider: 'google' | 'microsoft';
    reconnect: boolean;
    gmail_modify?: boolean | null;
};
export type Mail = {
    id: string;
    account_id: string;
    recipient: string;
    sender: string;
    subject: string;
    snippet: string;
    received: string;
    unread: boolean;
    starred?: boolean;
    url: string;
};
export type Detail = {
    attachments?: Attachment[];
    sender: string;
    recipient: string;
    cc?: string;
    subject: string;
    received: string;
    body: string;
    html?: string;
    url: string;
};
export type Inbox = {
    messages: Mail[];
    errors: string[];
    next_cursors: Record<string, string>;
    limited_accounts: string[];
};
export type Appearance = {
    theme: string;
    density: string;
    read_mode: ReadMode;
};
export type Protocol = 'anthropic' | 'openai_compatible';
export type SettingsView = {
    ai: {
        model: string;
        protocol: Protocol;
        endpoint: string;
        enabled: boolean;
        key_configured: boolean;
    };
    appearance: Appearance | null;
};
export type SettingsPatch = {
    model?: string;
    protocol?: Protocol;
    endpoint?: string;
    enabled?: boolean;
    api_key?: string;
    clear_api_key?: boolean;
    appearance?: Appearance;
};
export type Draft = {
    draft_id: string;
    message_id: string;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    html_only: boolean;
    attachments: Attachment[];
};
export type ComposeInput = {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    mode?: 'new' | 'reply' | 'replyAll' | 'forward' | 'draft';
    message_id?: string;
    submission_id?: string | null;
    draft_reply?: boolean;
    draft_id?: string;
    expected_message_id?: string;
    convert_html?: boolean;
    files?: {
        id: string;
        filename: string;
        mime_type: string;
        size: number;
    }[];
    retained?: {
        message_id: string | null;
        part: string;
    }[];
};
export type AiDraft = {
    subject: string;
    body: string;
};
export type AssistantDraft = { sender_hint:string; to:string; cc:string; bcc:string; subject:string; body:string; local_datetime:string; timezone:string };
export type Proposal = { id:string; revision:number; key:string; account_id:string; draft:AssistantDraft; utc:string; created_at:string; updated_at:string; state:'draft' };
export type ChatMessage = { role:'user'|'assistant'; content:string };
export type Suggestion = { action:'review'|'edit'|'reschedule'|'cancel'; target_id:string; expected_revision:number; changes:AssistantDraft|null };
function assistantDraft(value:unknown):AssistantDraft { const v=object(value); return {sender_hint:text(v.sender_hint),to:text(v.to),cc:text(v.cc),bcc:text(v.bcc),subject:text(v.subject),body:text(v.body),local_datetime:text(v.local_datetime),timezone:text(v.timezone)}; }
function proposal(value:unknown):Proposal {const v=object(value);if(v.state!=='draft'||typeof v.revision!=='number'||!Number.isSafeInteger(v.revision)||v.revision<1)return invalid();return {id:text(v.id),revision:v.revision,key:text(v.key),account_id:text(v.account_id),draft:assistantDraft(v.draft),utc:text(v.utc),created_at:text(v.created_at),updated_at:text(v.updated_at),state:v.state};}
export type MessageReference = {account_id:string;message_id:string};
export type AgentEmail = {account_id:string;draft:AssistantDraft;source:MessageReference|null;mode:'new'|'reply'|'forward'};
export type AgentAction =
 | {kind:'list_connected_accounts'|'open_compose'|'cancel_pending'|'save_draft'|'send_email'|'list_schedule_proposals'|'create_schedule_proposal'}
 | {kind:'search_messages';account_id:string;query:string}
 | {kind:'read_message';account_id:string;message_id:string}
 | {kind:'prepare_email';account_id:string;draft:AssistantDraft}
 | {kind:'reply_to_email'|'forward_email';account_id:string;message_id:string;draft:AssistantDraft}
 | {kind:'update_schedule_proposal'|'cancel_schedule_proposal';proposal_id:string;revision:number}
 | {kind:'share_context';account_id:string;message_id:string;excerpt:string};
export type AgentCard =
 | {kind:'accounts';accounts:{id:string;email:string}[]}
 | {kind:'draft';email:AgentEmail;open_compose:boolean}
 | {kind:'search_results';account_id:string;query:string;messages:{id:string;account_id:string;sender:string;subject:string;received:string}[]}
 | {kind:'schedule_plans';proposals:Proposal[]}
 | {kind:'result';status:'succeeded'|'failed'|'uncertain'|'canceled';text:string;provider_id:string|null};
export type AgentPending = {id:string;action:AgentAction;email:AgentEmail|null;status:'pending'|'running'|'finished'|'canceled';result:AgentCard|null};
export type AgentSession = {id:string;revision:number;consent:boolean;accounts:string[];messages:{role:'user'|'assistant'|'operation';text:string;cards:AgentCard[]}[];draft:AgentEmail|null;pending:AgentPending[];history_trimmed:boolean};
function revision(v:unknown):number {return typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:invalid();}
function reference(v:unknown):MessageReference {const r=object(v);return {account_id:text(r.account_id),message_id:text(r.message_id)};}
function agentEmail(v:unknown):AgentEmail {const e=object(v);if(e.mode!=='new'&&e.mode!=='reply'&&e.mode!=='forward')return invalid();return {account_id:text(e.account_id),draft:assistantDraft(e.draft),source:e.source==null?null:reference(e.source),mode:e.mode};}
function agentAction(v:unknown):AgentAction {
 const a=object(v),kind=text(a.kind);
 switch(kind){
 case 'list_connected_accounts':case 'open_compose':case 'cancel_pending':case 'save_draft':case 'send_email':case 'list_schedule_proposals':case 'create_schedule_proposal':return {kind};
 case 'prepare_email':return {kind,account_id:text(a.account_id),draft:assistantDraft(a.draft)};
 case 'search_messages':return {kind,account_id:text(a.account_id),query:text(a.query)};
 case 'read_message':return {kind,...reference(a)};
 case 'reply_to_email':case 'forward_email':return {kind,...reference(a),draft:assistantDraft(a.draft)};
 case 'update_schedule_proposal':case 'cancel_schedule_proposal':return {kind,proposal_id:text(a.proposal_id),revision:revision(a.revision)};
 case 'share_context':return {kind,...reference(a),excerpt:text(a.excerpt)};
 default:return invalid();
 }
}
function agentCard(v:unknown):AgentCard {
 const c=object(v),kind=text(c.kind);
 switch(kind){
 case 'draft':return {kind,email:agentEmail(c.email),open_compose:flag(c.open_compose)};
 case 'accounts':return {kind,accounts:array(c.accounts).map(v=>{const a=object(v);return {id:text(a.id),email:text(a.email)};})};
 case 'search_results':return {kind,account_id:text(c.account_id),query:text(c.query),messages:array(c.messages).map(v=>{const m=object(v);return {id:text(m.id),account_id:text(m.account_id),sender:text(m.sender),subject:text(m.subject),received:text(m.received)};})};
 case 'schedule_plans':return {kind,proposals:array(c.proposals).map(proposal)};
 case 'result':if(c.status!=='succeeded'&&c.status!=='failed'&&c.status!=='uncertain'&&c.status!=='canceled')return invalid();return {kind,status:c.status,text:text(c.text),provider_id:c.provider_id==null?null:text(c.provider_id)};
 default:return invalid();
 }
}
function agentSession(v:unknown):AgentSession {
 const s=object(v);return {id:text(s.id),revision:revision(s.revision),consent:flag(s.consent),accounts:strings(s.accounts),draft:s.draft==null?null:agentEmail(s.draft),history_trimmed:flag(s.history_trimmed),messages:array(s.messages).map(v=>{const m=object(v);if(m.role!=='user'&&m.role!=='assistant'&&m.role!=='operation')return invalid();return {role:m.role,text:text(m.text),cards:array(m.cards).map(agentCard)};}),pending:array(s.pending).map(v=>{const p=object(v);if(p.status!=='pending'&&p.status!=='running'&&p.status!=='finished'&&p.status!=='canceled')return invalid();return {id:text(p.id),action:agentAction(p.action),email:p.email==null?null:agentEmail(p.email),status:p.status,result:p.result==null?null:agentCard(p.result)};})};
}
const assistantPath=(id:string)=>'/api/assistant/sessions/'+encodeURIComponent(id);
export class ApiError extends Error {
    constructor(public readonly status: number, message: string) { super(message); this.name = 'Error'; }
}
function invalid(): never { throw new Error('Respons API tidak valid'); }
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return invalid();
    return Object.fromEntries(Object.entries(value));
}
function text(value: unknown): string { return typeof value === 'string' ? value : invalid(); }
function flag(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid(); }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid(); }
function strings(value: unknown): string[] { return array(value).map(text); }
function optionalText(value: unknown): string | undefined { return value == null ? undefined : text(value); }
function attachment(value: unknown): Attachment {
    const v = object(value);
    if (typeof v.size !== 'number' || !Number.isSafeInteger(v.size) || v.size < 0)
        return invalid();
    return { part: text(v.part), filename: text(v.filename), mime_type: text(v.mime_type), size: v.size, inline: flag(v.inline), available: flag(v.available), content_id: optionalText(v.content_id) };
}
function account(value: unknown): Account {
    const v = object(value);
    if (v.provider !== 'google' && v.provider !== 'microsoft')
        return invalid();
    if (v.gmail_modify != null && typeof v.gmail_modify !== 'boolean')
        return invalid();
    return { id: text(v.id), email: text(v.email), provider: v.provider, reconnect: v.reconnect == null ? false : flag(v.reconnect), gmail_modify: v.gmail_modify };
}
function mail(value: unknown): Mail {
    const v = object(value);
    return { id: text(v.id), account_id: text(v.account_id), recipient: text(v.recipient), sender: text(v.sender), subject: text(v.subject), snippet: text(v.snippet), received: text(v.received), unread: flag(v.unread), starred: v.starred == null ? undefined : flag(v.starred), url: text(v.url) };
}
function detail(value: unknown): Detail {
    const v = object(value);
    return { sender: text(v.sender), recipient: text(v.recipient), cc: optionalText(v.cc), subject: text(v.subject), received: text(v.received), body: text(v.body), html: optionalText(v.html), url: text(v.url), attachments: v.attachments == null ? [] : array(v.attachments).map(attachment) };
}
function settings(value: unknown): SettingsView {
    const v = object(value), ai = object(v.ai);
    const protocol = ai.protocol ?? 'anthropic';
    if (protocol !== 'anthropic' && protocol !== 'openai_compatible')
        return invalid();
    let appearance: Appearance | null = null;
    if (!('appearance' in v))
        return invalid();
    if (v.appearance != null) {
        const a = object(v.appearance), mode = a.read_mode;
        if (mode !== 'Adaptive' && mode !== 'Original' && mode !== 'Plain Text')
            return invalid();
        appearance = { theme: text(a.theme), density: text(a.density), read_mode: mode };
    }
    return { ai: { model: text(ai.model), protocol, endpoint: ai.endpoint == null ? 'https://api.anthropic.com/v1/messages' : text(ai.endpoint), enabled: flag(ai.enabled), key_configured: flag(ai.key_configured) }, appearance };
}
async function request(path: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(path, options);
    if (!response.ok)
        throw new ApiError(response.status, await response.text());
    if (response.status === 204)
        return undefined;
    return response.json();
}
const json = (method: string, value: unknown, signal?: AbortSignal): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal });
const messagePath = (account: string) => '/api/message/' + encodeURIComponent(account);
export const api = {
    createAssistant:async()=>agentSession(await request('/api/assistant/sessions',{method:'POST'})),
    getAssistant:async(id:string)=>agentSession(await request(assistantPath(id))),
    patchAssistant:async(id:string,expected_revision:number,consent:boolean,accounts:string[],selected?:MessageReference)=>agentSession(await request(assistantPath(id),json('PATCH',{expected_revision,consent,accounts,selected}))),
    clearAssistant:async(id:string):Promise<void>=>{await request(assistantPath(id),{method:'DELETE'});},
    assistantTurn:async(id:string,expected_revision:number,text:string,timezone:string,signal:AbortSignal)=>agentSession(await request(assistantPath(id)+'/turns',json('POST',{expected_revision,text,now:new Date().toISOString(),timezone},signal))),
    assistantAction:async(id:string,expected_revision:number,action:AgentAction)=>agentSession(await request(assistantPath(id)+'/actions',json('POST',{expected_revision,action}))),
    confirmAssistant:async(id:string,action:string,expected_revision:number)=>agentSession(await request(assistantPath(id)+'/actions/'+encodeURIComponent(action)+'/confirm',json('POST',{expected_revision}))),
    chat: async (input:{messages:ChatMessage[];consent:boolean;now:string;timezone:string;proposal:Proposal|null},signal:AbortSignal) => {
        const v=object(await request('/api/ai/chat',json('POST',input,signal)));let suggestion:Suggestion|null=null;
        if(v.suggestion!=null){const s=object(v.suggestion);if(!['review','edit','reschedule','cancel'].includes(text(s.action))||typeof s.expected_revision!=='number'||!Number.isSafeInteger(s.expected_revision)||s.expected_revision<1)return invalid();suggestion={action:s.action as Suggestion['action'],target_id:text(s.target_id),expected_revision:s.expected_revision,changes:s.changes==null?null:assistantDraft(s.changes)};}
        return {reply:text(v.reply),draft:v.draft==null?null:assistantDraft(v.draft),suggestion};
    },
    capabilities: async () => {const v=object(await request('/api/scheduling/capabilities'));return {enabled:flag(v.enabled),blockers:strings(v.blockers)};},
    proposals: async () => array(await request('/api/schedule-proposals')).map(proposal),
    saveProposal: async (input:{key:string;account_id:string;draft:AssistantDraft;revision?:number},id?:string) => proposal(await request('/api/schedule-proposals'+(id?'/'+encodeURIComponent(id):''),json(id?'PATCH':'POST',input))),
    removeProposal: async (id:string,revision:number):Promise<void> => {await request('/api/schedule-proposals/'+encodeURIComponent(id),json('DELETE',{revision}));},
    accounts: async () => array(await request('/api/accounts')).map(account),
    settings: async (signal?: AbortSignal) => settings(await request('/api/settings', { signal })),
    patchSettings: async (patch: SettingsPatch) => settings(await request('/api/settings', json('PATCH', patch))),
    inbox: async (account: string, params: URLSearchParams): Promise<Inbox> => {
        const v = object(await request('/api/inbox/' + encodeURIComponent(account) + '?' + params));
        const cursors = v.next_cursors == null ? {} : object(v.next_cursors);
        return { messages: array(v.messages).map(mail), errors: strings(v.errors), next_cursors: Object.fromEntries(Object.entries(cursors).map(([key, value]) => [key, text(value)])), limited_accounts: v.limited_accounts == null ? [] : strings(v.limited_accounts) };
    },
    detail: async (account: string, id: string, signal?: AbortSignal) => detail(await request(messagePath(account) + '?' + new URLSearchParams({ id }), { signal })),
    markRead: async (account: string, id: string): Promise<void> => { await request(messagePath(account) + '/read', json('POST', { id })); },
    action: async (account: string, id: string, action: string): Promise<void> => { await request(messagePath(account) + '/action', json('POST', { id, action })); },
    disconnect: async (id: string): Promise<void> => { await request('/api/accounts/' + encodeURIComponent(id), { method: 'DELETE' }); },
    draft: async (account: string, message_id: string): Promise<Draft> => {
        const v = object(await request('/api/draft/' + encodeURIComponent(account) + '?' + new URLSearchParams({ message_id })));
        return { draft_id: text(v.draft_id), message_id: text(v.message_id), to: text(v.to), cc: text(v.cc), bcc: text(v.bcc), subject: text(v.subject), body: text(v.body), html_only: flag(v.html_only), attachments: array(v.attachments).map(attachment) };
    },
    // The caller historically consumes only success/status, never a compose response body.
    compose: async (account: string, input: ComposeInput | FormData): Promise<void> => {
        const response = await fetch('/api/compose/' + encodeURIComponent(account), input instanceof FormData ? { method: 'POST', body: input } : json('POST', input));
        if (!response.ok)
            throw new ApiError(response.status, await response.text());
    },
    generateAi: async (input: {
        instruction: string;
        consent: boolean;
    }, signal: AbortSignal): Promise<AiDraft> => {
        const v = object(await request('/api/ai/compose', json('POST', input, signal)));
        return { subject: text(v.subject), body: text(v.body) };
    },
};
