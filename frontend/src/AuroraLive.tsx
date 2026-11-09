import React, { useEffect, useRef, useState } from 'react';
import './AuroraFullyInteractiveEmailClient.css';
import { type ReadMode } from './EmailBody';
import { MessageContent } from './MessageContent';
import { SenderSelector } from './SenderSelector';
import { ComposeAttachments, fileSize } from './ComposeAttachment';
import './compose.css';
import { Icon } from './Icon';
import { type Attachment } from './AttachmentGallery';
import { version as frontendVersion } from '../package.json';

const brandIcon = '/icon/sela_aurora_app_icon.svg';

type Account = { id: string; email: string; provider: 'google' | 'microsoft'; reconnect: boolean; gmail_modify?: boolean | null };
type Mail = { id: string; account_id: string; recipient: string; sender: string; subject: string; snippet: string; received: string; unread: boolean; starred?: boolean; url: string };
type Detail = { attachments?: Attachment[]; sender: string; recipient: string; cc?: string; subject: string; received: string; body: string; html?: string; url: string };
type Folder = { id: string; label: string; icon: React.ComponentProps<typeof Icon>['name'] };
const folders: Folder[] = [
  { id: 'inbox', label: 'Semua inbox', icon: 'Inbox' }, { id: 'starred', label: 'Berbintang', icon: 'Star' }, { id: 'important', label: 'Penting', icon: 'Flag' },
  { id: 'sent', label: 'Terkirim', icon: 'Send' }, { id: 'drafts', label: 'Draf', icon: 'FilePenLine' },
  { id: 'archive', label: 'Arsip', icon: 'Archive' }, { id: 'spam', label: 'Spam', icon: 'ShieldAlert' },
  { id: 'trash', label: 'Sampah', icon: 'Trash2' }, { id: 'allmail', label: 'Semua email', icon: 'Mails' }
];
const categories: Folder[] = [{ id: 'all', label: 'Semua', icon: 'Mails' }, { id: 'primary', label: 'Utama', icon: 'Mail' }, { id: 'promotions', label: 'Promosi', icon: 'Tag' }, { id: 'social', label: 'Sosial', icon: 'Users' }, { id: 'updates', label: 'Update', icon: 'Bell' }];
const settingsSections = ['Tampilan & Preferensi', 'Akun & Sinkronisasi', 'Email & Notifikasi', 'Privasi & Keamanan', 'Tentang Aurora'] as const;
const unsupported = 'Belum tersedia di aplikasi ini. Gunakan layanan email asal untuk tindakan ini.';
const sender = (raw: string) => { const match = /^(.*?)\s*<([^<>]+)>\s*$/.exec(raw || ''); return { name: match?.[1]?.replace(/^"(.*)"$/, '$1') || raw || 'Pengirim', address: match?.[2] || raw || '' }; };
const mailboxes = (raw: string) => (raw.match(/(?:"(?:[^"\\]|\\.)*"|<[^>]*>|[^,"<])+/g) || []).map(value => sender(value.trim()).address.trim()).filter(Boolean);
const providerLink = (value: string) => /^https:\/\/(mail\.google\.com|outlook\.(live|office|office365)\.com)\//.test(value);

export function AuroraLive() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [messages, setMessages] = useState<Mail[]>([]);
  const [nextCursors, setNextCursors] = useState<Record<string, string>>({});
  const [limitedAccounts, setLimitedAccounts] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [acting, setActing] = useState(false);
  const actionPending = useRef(false);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [folder, setFolder] = useState('inbox');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Mail | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [view, setView] = useState<'mail' | 'settings'>('mail');
  const [tab, setTab] = useState<(typeof settingsSections)[number]>('Tampilan & Preferensi');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileReading, setMobileReading] = useState(false);
  const [compose, setCompose] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const composeElement = useRef<HTMLElement>(null);
  const composeOpener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!compose || minimized) return;
    const element=composeElement.current!;
    const media=matchMedia('(max-width:660px)');
    let restore: (()=>void)[]=[];
    const update=()=>{
      restore.forEach(fn=>fn());restore=[];
      if(!media.matches)return;
      let child:HTMLElement=element;
      while(child.parentElement && !child.classList.contains('aurora-app')) {
        for(const sibling of child.parentElement.children)if(sibling!==child && sibling instanceof HTMLElement && !sibling.matches('.au-real-error,.au-toast')) {
          const previous=sibling.inert;sibling.inert=true;restore.push(()=>{sibling.inert=previous;});
        }
        child=child.parentElement;
      }
    };
    update();media.addEventListener('change',update);
    const frame=requestAnimationFrame(()=>element.querySelector<HTMLInputElement>('input[name="to"]')?.focus());
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||!media.matches)return;
      const controls=Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')).filter(control=>control.getClientRects().length && !control.closest('[hidden],[inert]'));
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    element.addEventListener('keydown',trap);
    return ()=>{cancelAnimationFrame(frame);restore.forEach(fn=>fn());media.removeEventListener('change',update);element.removeEventListener('keydown',trap);composeOpener.current?.focus();};
  }, [compose,minimized]);
  const [composeErrors, setComposeErrors] = useState<Record<string,string>>({});
  const [composeOperation, setComposeOperation] = useState<'send'|'draft'|null>(null);
  useEffect(() => {
    if (!compose) return;
    const viewport = window.visualViewport;
    const update = () => {
      composeElement.current?.style.setProperty('--compose-height',`${viewport?.height || innerHeight}px`);
      composeElement.current?.style.setProperty('--compose-top',`${viewport?.offsetTop || 0}px`);
    };
    update(); viewport?.addEventListener('resize',update); viewport?.addEventListener('scroll',update);
    window.addEventListener('resize',update);
    return () => {viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  }, [compose]);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'replyAll' | 'forward'>('new');
  const [composeSource, setComposeSource] = useState<string | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);
  const [sendUncertain, setSendUncertain] = useState(false);
  const submissionId = useRef<string | null>(null);
  const [composeFrom, setComposeFrom] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [retainedFiles, setRetainedFiles] = useState<Attachment[]>([]);
  const composeSession = useRef(0);
  const composeDirty = compose && Boolean(to || cc || bcc || subject || body || composeFiles.length || retainedFiles.length);
  useEffect(() => {
    if (!composeDirty) return;
    // ponytail: native unload prompts cannot cover mobile process termination; save important drafts to Gmail.
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [composeDirty]);
  const [editingDraft, setEditingDraft] = useState<{draft_id:string;message_id:string;html_only:boolean} | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountsReady, setAccountsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('aurora-theme') || 'dark'; } catch { return 'dark'; } });
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('aurora-density') || 'comfortable'; } catch { return 'comfortable'; } });
  const [readMode, setReadMode] = useState<ReadMode>(() => { try { const saved = localStorage.getItem('aurora-read-mode'); return saved === 'Original' || saved === 'Plain Text' ? saved : 'Adaptive'; } catch { return 'Adaptive'; } });
  const listRequest = useRef(0);
  const loadedExtraPages = useRef(false);
  const detailRequest = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const currentAccount = accounts.find(a => a.id === selectedAccount);
  const microsoftUnsupported = accounts.some(a => a.provider === 'microsoft' && (selectedAccount === 'all' || selectedAccount === a.id)) && (Boolean(query) || ['starred', 'allmail'].includes(folder) || (folder === 'inbox' && !['all', 'primary'].includes(category)));
  const warn = (message = unsupported) => setNotice(message);

  async function loadAccounts(): Promise<Account[] | null> {
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) throw new Error(await response.text());
      const list: Account[] = await response.json();
      setAccounts(list);
      setAccountError('');
      setAccountsReady(true);
      setComposeFrom(id => list.some(a => a.id === id) ? id : list[0]?.id || '');
      return list;
    } catch (cause) { setAccountError('Gagal memuat akun: ' + String(cause)); setLoading(false); return null; }
  }
  async function loadInbox(silent = false): Promise<boolean> {
    if (!accountsReady || (silent && (document.hidden || selected || loading || loadedExtraPages.current || Object.keys(nextCursors).length > 0 || messages.length > 30))) return false;
    const current = ++listRequest.current;
    if (!silent) { loadedExtraPages.current = false; setLoading(true); setError(''); setMessages([]); setNextCursors({}); setLimitedAccounts([]); setSelected(null); setDetail(null); setMobileReading(false); ++detailRequest.current; }
    try {
      const params = new URLSearchParams({ mailbox: folder, category, search: query.trim() });
      const response = await fetch('/api/inbox/' + encodeURIComponent(selectedAccount) + '?' + params);
      if (!response.ok) throw new Error(await response.text());
      const result: { messages: Mail[]; errors: string[]; next_cursors?: Record<string, string>; limited_accounts?: string[] } = await response.json();
      if (current !== listRequest.current) return false;
      setMessages(result.messages);
      setNextCursors(result.next_cursors || {});
      setLimitedAccounts(result.limited_accounts || []);
      if (!silent && accounts.some(account => account.provider === 'google' && account.gmail_modify == null)) void loadAccounts();
      setError([...(microsoftUnsupported ? ['Pencarian, kategori Gmail, Berbintang, dan Semua email Outlook belum didukung pada tampilan ini.'] : []), ...result.errors].join('\n'));
      return result.errors.length === 0;
    } catch (cause) {
      if (current === listRequest.current) setError('Gagal memuat email: ' + String(cause));
      return false;
    } finally { if (current === listRequest.current) setLoading(false); }
  }
  async function loadMore() {
    if (!Object.keys(nextCursors).length || loadingMore) return;
    const current = listRequest.current;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ mailbox: folder, category, search: query.trim(), cursors: JSON.stringify(nextCursors) });
      const response = await fetch('/api/inbox/' + encodeURIComponent(selectedAccount) + '?' + params);
      if (!response.ok) throw new Error(await response.text());
      const result: { messages: Mail[]; errors: string[]; next_cursors: Record<string, string> } = await response.json();
      if (current !== listRequest.current) return;
      loadedExtraPages.current = true;
      setMessages(previous => {
        const seen = new Set(previous.map(message => message.account_id + '/' + message.id));
        const merged = [...previous];
        for (const message of result.messages) {
          if (!seen.has(message.account_id + '/' + message.id)) { merged.push(message); seen.add(message.account_id + '/' + message.id); }
        }
        return merged.sort((a, b) => b.received.localeCompare(a.received) || a.account_id.localeCompare(b.account_id) || a.id.localeCompare(b.id));
      });
      setNextCursors(result.next_cursors || {});
      setError(result.errors.join('\n'));
    } catch (cause) { if (current === listRequest.current) setError('Gagal memuat halaman berikutnya: ' + String(cause)); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => { void loadAccounts(); }, []);
  useEffect(() => { if (accountsReady) void loadInbox(); }, [accountsReady, selectedAccount, folder, category, query]);
  useEffect(() => { const timer = setInterval(() => { if (view === 'mail') void loadInbox(true); }, 30000); const visible = () => { if (!document.hidden && view === 'mail') void loadInbox(true); }; document.addEventListener('visibilitychange', visible); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); }; }, [accountsReady, loading, selectedAccount, folder, category, query, selected, view]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') { if (compose && !minimized) closeCompose(); setMenuOpen(false); setMobileReading(false); }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.key === '/' || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); searchRef.current?.focus(); }
    if (event.key.toLowerCase() === 'c' && !compose) { event.preventDefault(); openCompose(); }
  }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [compose, minimized, to, cc, bcc, subject, body, composeFiles, retainedFiles, composeBusy, accounts, selectedAccount]);
  function navigate(nextFolder: string, nextAccount = selectedAccount) {
    setView('mail'); setFolder(nextFolder); setSelectedAccount(nextAccount); setCategory('all'); setSearch(''); setQuery(''); setMenuOpen(false);
  }
  async function openMail(message: Mail) {
    const current = ++detailRequest.current;
    setSelected(message); setDetail(null); setMobileReading(true); setError('');
    try {
      const response = await fetch('/api/message/' + encodeURIComponent(message.account_id) + '?id=' + encodeURIComponent(message.id));
      if (!response.ok) throw new Error(await response.text());
      const value: Detail = await response.json();
      if (current !== detailRequest.current) return;
      setDetail(value);
      if (message.unread) {
        const marked = await fetch('/api/message/' + encodeURIComponent(message.account_id) + '/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id }) });
        if (!marked.ok) throw new Error('Status dibaca gagal disinkronkan: ' + await marked.text());
        if (current === detailRequest.current) setMessages(list => list.map(m => m.id === message.id && m.account_id === message.account_id ? { ...m, unread: false } : m));
      }
    } catch (cause) { if (current === detailRequest.current) setError('Gagal memuat email: ' + String(cause)); }
  }
  function resetComposePresentation() {setMinimized(false);setExpanded(false);setShowCc(false);setShowBcc(false);setDragging(false);dragDepth.current=0;setComposeErrors({});}
  function addFiles(incoming: FileList | File[]) {
    if (composeBusy) return;
    // Match the server's filename/MIME boundary; reject the entire selection without losing prior files.
    if (Array.from(incoming).some(file => !file.name || [...file.name].length>180 || /[/\\\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(file.name) || /^[ .]|[ .]$/.test(file.name))) {warn('Nama file tidak didukung. Ubah nama: maksimal 180 karakter, tanpa pemisah path, kontrol, atau titik/spasi di tepi.');return;}
    if (Array.from(incoming).some(file => file.type && (file.type.length>127 || !/^[A-Za-z0-9!#$&^_.+\-]+\/[A-Za-z0-9!#$&^_.+\-]+$/.test(file.type)))) {warn('Tipe MIME file tidak valid. Pilih ulang file dengan tipe yang valid.');return;}
    const next = [...composeFiles,...Array.from(incoming)];
    if (next.length+retainedFiles.length > 100 || next.reduce((size,file) => size+file.size,0)+retainedFiles.reduce((size,file) => size+file.size,0) > 25_000_000) { warn('Lampiran maksimal 100 file, total 25 MB.'); return; }
    setComposeFiles(next);
  }
  function openCompose(message?: Mail, mode: 'reply' | 'replyAll' | 'forward' | 'new' = 'new') {
    if (composeBusy || mode === 'replyAll' && !detail) return;
    if (!compose) composeOpener.current=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (compose && (to || cc || bcc || subject || body || composeFiles.length || retainedFiles.length) && !confirm('Ganti pesan yang belum dikirim? Teks dan lampiran akan hilang.')) return;
    resetComposePresentation(); setShowCc(mode === 'replyAll');
    composeSession.current++; setEditingDraft(null); setComposeFiles([]); setRetainedFiles(mode === 'forward' ? (detail?.attachments || []).filter(file => !file.inline) : []);
    setComposeFrom(message?.account_id || (selectedAccount !== 'all' ? selectedAccount : accounts[0]?.id || ''));
    const owner = accounts.find(account => account.id === message?.account_id);
    const seen = new Set<string>();
    const unique = (values: string[]) => values.filter(address => {
      const key = address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const ownMessage = message && owner?.email.toLowerCase() === sender(message.sender).address.toLowerCase();
    const replyTo = unique(mailboxes(ownMessage ? detail?.recipient || message?.recipient || '' : message?.sender || ''));
    setTo((mode === 'reply' || mode === 'replyAll') && message ? replyTo.join(', ') : '');
    if (owner) seen.add(owner.email.toLowerCase());
    setCc(mode === 'replyAll' ? unique([...mailboxes(detail?.recipient || message?.recipient || ''), ...mailboxes(detail?.cc || '')]).join(', ') : ''); setBcc('');
    setSubject(message ? (mode === 'forward' ? 'Fwd: ' : 'Re: ') + message.subject : '');
    setComposeMode(mode);
    submissionId.current = null;
    setSendUncertain(false);
    setComposeSource(message?.id || null);
    setBody(mode === 'forward' && message && detail ? `\n\n----- Pesan diteruskan -----\nDari: ${detail.sender}\nKepada: ${detail.recipient}\nSubjek: ${detail.subject}\n\n${detail.body || '[Pesan HTML: buka di penyedia untuk meneruskan format asli]'}` : ''); setCompose(true);
  }
  async function editDraft(message: Mail) {
    if (composeBusy) return;
    if (compose && !confirm('Ganti pesan yang sedang ditulis? Teks dan lampiran akan hilang.')) return;
    if (!compose) composeOpener.current=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const session = ++composeSession.current;
    setComposeBusy(true);
    try {
      const response = await fetch(`/api/draft/${encodeURIComponent(message.account_id)}?${new URLSearchParams({message_id:message.id})}`);
      if (!response.ok) throw new Error(await response.text());
      const draft = await response.json();
      if (session!==composeSession.current) return;
      if (draft.html_only && !confirm('Draf ini hanya HTML. Mengedit akan mengubah format menjadi teks biasa. Lanjutkan?')) return;
      resetComposePresentation();setShowCc(!!draft.cc);setShowBcc(!!draft.bcc);
      setEditingDraft(draft); setComposeFrom(message.account_id); setComposeSource(draft.message_id); setComposeMode('new');
      setTo(draft.to); setCc(draft.cc); setBcc(draft.bcc); setSubject(draft.subject); setBody(draft.body);
      setComposeFiles([]); setRetainedFiles(draft.attachments); setSendUncertain(false); submissionId.current=null; setCompose(true);
    } catch (cause) {setError('Draf belum dapat dibuka: '+String(cause));}
    finally {setComposeBusy(false);}
  }
  function closeCompose() {
    if (composeBusy) return;
    if ((to || cc || bcc || subject || body || composeFiles.length || retainedFiles.length) && !confirm('Tutup pesan yang belum dikirim? Teks dan lampiran akan hilang.')) return;
    composeSession.current++; setComposeFiles([]); setRetainedFiles([]);
    setCompose(false); setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('');
  }
  async function submitCompose(mode: 'send' | 'draft') {
    const owner = accounts.find(account => account.id === composeFrom);
    if (!owner || owner.provider !== 'google' || owner.gmail_modify !== true) { warn('Izin gmail.modify belum terverifikasi untuk akun pengirim.'); return; }
    if (composeBusy || sendUncertain && mode === 'send') {warn('Periksa folder Terkirim sebelum membuat pesan baru.');return;}
    const errors: Record<string,string> = {};
    const length = (value:string) => new TextEncoder().encode(value).length;
    for (const [field,value] of Object.entries({to:to.trim(),cc:cc.trim(),bcc:bcc.trim()})) {
      if (!value && field !== 'to') continue;
      if (!value || length(value)>1024 || /[\x00-\x1f\x7f]/.test(value) || value.split(',').length>20 || !value.split(',').every(raw => {
        const address=raw.trim(), parts=address.split('@'), local=parts[0], domain=parts[1];
        return address.length<=254 && /^[A-Za-z0-9@._+\-]+$/.test(address) && parts.length===2 && !!local && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && !!domain && domain.includes('.') && domain.split('.').every(part=>!!part && !part.startsWith('-') && !part.endsWith('-'));
      })) errors[field]='Gunakan maksimal 20 alamat email, dipisahkan koma (maks. 1024 byte).';
    }
    if (!subject.trim() || length(subject)>512 || /[\x00-\x1f\x7f]/.test(subject)) errors.subject='Isi subjek tanpa karakter kontrol, maksimal 512 byte.';
    if (length(body)>1_000_000) errors.body='Isi pesan maksimal 1 MB.';
    setComposeErrors(errors);
    if (Object.keys(errors).length) {
      if (errors.cc) setShowCc(true); if (errors.bcc) setShowBcc(true);
      requestAnimationFrame(()=>composeElement.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());return;
    }
    if (mode === 'send' && !confirm('Kirim email ke ' + to + '?')) return;
    setComposeBusy(true);setComposeOperation(mode);
    const session = composeSession.current;
    if (mode === 'send' && !submissionId.current) submissionId.current = crypto.randomUUID();
    try {
      const manifest = { to: to.trim(), subject, body, ...(editingDraft ? {draft_id:editingDraft.draft_id,expected_message_id:editingDraft.message_id,convert_html:editingDraft.html_only} : {}), ...(cc.trim() ? { cc: cc.trim() } : {}), ...(bcc.trim() ? { bcc: bcc.trim() } : {}), mode: mode === 'draft' ? 'draft' : composeMode, ...(composeSource ? { message_id: composeSource } : {}), ...(mode === 'draft' && ['reply', 'replyAll'].includes(composeMode) ? { draft_reply: true } : {}), ...(mode === 'send' ? { submission_id: submissionId.current } : {}), ...(composeFiles.length ? {files:composeFiles.map((file,index) => ({id:`file${index}`,filename:file.name,mime_type:file.type || 'application/octet-stream',size:file.size}))} : {}), ...(retainedFiles.length ? {retained:retainedFiles.map(file => ({message_id:composeSource,part:file.part}))} : {}) };
      const form = new FormData(); form.append('manifest',JSON.stringify(manifest)); composeFiles.forEach((file,index) => form.append(`file${index}`,file));
      const response = await fetch('/api/compose/' + encodeURIComponent(composeFrom), { method: 'POST', ...(composeFiles.length ? {body:form} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(manifest)}) });
      if (session !== composeSession.current) return;
      if (!response.ok) {
        const reason = await response.text();
        if (mode === 'send' && [400,413,422,424,429].includes(response.status)) { submissionId.current = null; setError('Perbaiki pesan sebelum mengirim ulang: ' + reason); return; }
        throw new Error(reason);
      }
      composeSession.current++; setComposeFiles([]); setRetainedFiles([]);
      setCompose(false); setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('');
      warn(mode === 'draft' ? 'Draf tersimpan di Gmail' : 'Pesan terkirim melalui Gmail');
      if (view === 'mail') void loadInbox();
    } catch (cause) {
      if (mode === 'send') { setSendUncertain(true); setError('Status pengiriman tidak diketahui. Periksa folder Terkirim sebelum mencoba lagi. ' + String(cause)); }
      else setError('Draf belum tersimpan: ' + String(cause));
    } finally { setComposeBusy(false);setComposeOperation(null); }
  }
  async function act(message: Mail, action: string) {
    const owner = accounts.find(account => account.id === message.account_id);
    if (!owner || owner.provider !== 'google' || owner.gmail_modify !== true) { warn('Izin gmail.modify belum terverifikasi untuk akun ini. Perbarui izin di Kelola akun.'); return; }
    if (actionPending.current) return;
    actionPending.current = true;
    setActing(true);
    try {
      const response = await fetch('/api/message/' + encodeURIComponent(message.account_id) + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id, action }) });
      if (!response.ok) throw new Error(await response.text());
      setSelected(null); setDetail(null); setMobileReading(false);
      if (await loadInbox()) warn('Perubahan pesan tersimpan di Gmail');
      else warn('Gmail menerima perubahan, tetapi daftar gagal dimuat ulang.');
    } catch (cause) { setError('Gagal mengubah pesan: ' + String(cause)); }
    finally { actionPending.current = false; setActing(false); }
  }
  async function disconnect(account: Account) {
    if (!confirm('Putuskan ' + account.email + '? Email di penyedia tidak dihapus.')) return;
    try {
      const response = await fetch('/api/accounts/' + encodeURIComponent(account.id), { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      const list = await loadAccounts();
      if (list && !list.some(a => a.id === selectedAccount)) setSelectedAccount('all');
      if (list) warn('Akun diputuskan');
    } catch (cause) { setError('Gagal memutuskan akun: ' + String(cause)); }
  }
  const count = messages.filter(m => m.unread).length;
  const title = folders.find(f => f.id === folder)?.label || 'Semua inbox';
  const initials = (email: string) => email.slice(0, 2).toUpperCase();
  return <div className={`aurora-app au-density-${density} ${theme === 'light' ? 'au-theme-light' : ''}`}>
    <div className="au-app-grid">
      <aside className="au-rail" aria-label="Akun dan tampilan">
        <div className="au-logo-mark"><img src={brandIcon} width="42" height="42" alt="Sela Aurora" /></div>
        <button className={`au-rail-icon ${selectedAccount === 'all' && view === 'mail' ? 'selected' : ''}`} title="Semua akun" aria-label="Semua akun" aria-current={selectedAccount === 'all' && view === 'mail' ? 'page' : undefined} onClick={() => view === 'settings' ? setView('mail') : navigate('inbox', 'all')}><Icon name="Inbox" size={22} /></button>
        {accounts.map(a => <button key={a.id} className={`au-rail-account ${selectedAccount === a.id && view === 'mail' ? 'selected' : ''}`} title={a.email} aria-label={a.email} aria-current={selectedAccount === a.id && view === 'mail' ? 'page' : undefined} onClick={() => navigate('inbox', a.id)}>{initials(a.email)}<span className={`au-rail-status ${a.reconnect ? 'error' : 'live'}`} /></button>)}
        <div className="au-rail-bottom"><button className={`au-rail-icon ${view === 'settings' ? 'selected' : ''}`} title="Pengaturan" aria-label="Pengaturan" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => { setMenuOpen(false); setView(view === 'settings' ? 'mail' : 'settings'); }}><Icon name="Settings2" size={22} /></button></div>
      </aside>
      <aside className={`au-sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Navigasi email">
        <div className="au-brand"><div><div className="au-brand-word">sela</div><div className="au-brand-tag">AURORA MAIL EXPERIENCE</div></div><button className="au-sidebar-close" title="Tutup menu" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}><Icon name="X" /></button></div>
        <button className="au-compose-trigger" onClick={() => openCompose()}><Icon name="SquarePen" /><span>Tulis email</span><span className="au-keycap">C</span></button>
        <div className="au-sidebar-scroll"><div className="au-section-label">MAILBOX</div><nav className="au-nav-list" aria-label="Folder email">{folders.map(f => <button key={f.id} className={`au-nav-item ${view === 'mail' && folder === f.id ? 'active' : ''}`} aria-current={view === 'mail' && folder === f.id ? 'page' : undefined} onClick={() => navigate(f.id)}><Icon name={f.icon} /><span>{f.label}</span></button>)}</nav>
          <div className="au-section-label"><Icon name="UsersRound" size={14} /> AKUN TERHUBUNG</div><div className="au-account-sidebar">{accounts.map(a => <button key={a.id} className="au-sidebar-account" aria-current={selectedAccount === a.id && view === 'mail' ? 'page' : undefined} onClick={() => navigate('inbox', a.id)}><span className="au-provider-symbol">{a.provider === 'google' ? 'G' : 'M'}</span><span><strong>{a.email.split('@')[0]}</strong><small>{a.email}</small></span><span className="au-sm-dot" /></button>)}</div></div>
      </aside>
      <div className="au-main-shell"><header className="au-topbar"><button className="au-topbar-menu" title="Buka menu" aria-label="Buka menu" onClick={() => setMenuOpen(true)}><Icon name="Menu" /></button><form className="au-search-box" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setView('mail'); }}><Icon name="Search" /><input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari di semua akun..." aria-label="Cari email" maxLength={200} /><button title="Cari" aria-label="Cari" type="submit"><Icon name="Search" size={16} /></button></form><div className="au-topbar-gap" /><button className="au-sync-status" onClick={() => void loadInbox()} title="Sinkronkan"><span className="au-sm-dot" />{accounts.length} akun terhubung <Icon name="RefreshCw" size={16} /></button></header>
        {view === 'mail' ? <div className={`au-mail-layout ${mobileReading ? 'au-mobile-reading' : ''}`}>
          <section className="au-message-column" aria-label="Daftar email"><div className="au-mail-header"><div className="au-heading-eyebrow"><Icon name="Inbox" size={14} />{currentAccount?.email || 'SEMUA AKUN'}</div><div className="au-heading-row"><div><h1>{query ? 'Hasil pencarian' : title}</h1><p>{messages.length} pesan dimuat · {count} belum dibaca dari pesan dimuat</p></div><button className="au-round-button" title="Sinkronkan" aria-label="Sinkronkan" onClick={() => void loadInbox()}><Icon name="RefreshCw" /></button></div></div>
            {folder === 'inbox' && !query && <nav className="au-categories" aria-label="Kategori email">{categories.map(c => <button key={c.id} className={category === c.id ? 'active' : ''} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}><Icon name={c.icon} size={14} />{c.label}</button>)}</nav>}
            <div className="au-list-toolbar"><span>Pesan terbaru</span><div className="au-spacer" /><span>30 per halaman akun</span></div>
            {loading ? <div className="au-empty" role="status"><img className="au-loading-logo" src={brandIcon} width="48" height="48" alt="" />Memuat email…</div> : messages.length ? <div className="au-messages-scroll">{messages.map(m => <div key={m.account_id + '/' + m.id} className={`au-mail-row ${selected?.id === m.id && selected.account_id === m.account_id ? 'is-current' : ''} ${m.unread ? 'is-unread' : ''}`} role="button" tabIndex={0} aria-label={`Buka email ${m.subject} dari ${m.sender}`} onClick={() => void openMail(m)} onKeyDown={e => { if (e.key === 'Enter') void openMail(m); }}><div className="au-mail-top"><div className="au-avatar">{sender(m.sender).name.slice(0, 2).toUpperCase()}</div><div className="au-mail-ident"><span className="au-sender">{sender(folder === 'sent' ? m.recipient : m.sender).name}</span><span className="au-mail-address">{sender(folder === 'sent' ? m.recipient : m.sender).address}</span></div><span className="au-mail-time">{m.received ? new Date(m.received).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div><div className="au-subject">{m.unread && <span className="au-unread-dot" />}{m.subject || '(Tanpa judul)'}</div><div className="au-mail-snippet">{m.snippet}</div><div className="au-mail-bottom"><span className="au-account-pill">{accounts.find(a => a.id === m.account_id)?.email || m.recipient}</span><span className="au-category-dot">{folder === 'inbox' ? categories.find(c => c.id === category)?.label : title}</span></div></div>)}<div className="au-list-end">{Object.keys(nextCursors).length ? <button className="au-btn au-btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Memuat…' : 'Muat lagi'}</button> : limitedAccounts.length ? 'Hanya 30 pesan Outlook pertama; pagination belum tersedia.' : 'Akhir pesan yang dimuat'}</div></div> : <div className="au-empty"><span className="au-empty-illustration"><Icon name="Inbox" size={28} /></span><h3>{error ? 'Email belum dapat dimuat' : 'Tidak ada pesan di sini'}</h3><p>{accounts.length ? 'Coba folder lain atau sinkronkan ulang.' : 'Hubungkan akun untuk melihat email.'}</p>{Object.keys(nextCursors).length > 0 && <button className="au-btn au-btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Memuat…' : 'Muat lagi'}</button>}</div>}
          </section><section className="au-reading-column" aria-label="Pembaca email">{selected ? <><div className="au-reader-toolbar"><button className="au-back-mobile" title="Kembali ke inbox" onClick={() => setMobileReading(false)}><Icon name="ChevronLeft" />Inbox</button>{accounts.find(a => a.id === selected.account_id)?.gmail_modify === true ? <div className="au-reader-tools"><button disabled={acting} onClick={() => void act(selected, selected.starred ? 'unstar' : 'star')} title={selected.starred ? 'Hapus bintang' : 'Beri bintang'}><Icon name="Star" filled={selected.starred} /><span>Bintang</span></button><button disabled={acting} onClick={() => void act(selected, 'archive')} title="Arsipkan pesan"><Icon name="Archive" /><span>Arsipkan</span></button><button disabled={acting} onClick={() => void act(selected, 'unread')} title="Tandai belum dibaca"><Icon name="Mail" /><span>Belum dibaca</span></button><button disabled={acting} onClick={() => void act(selected, folder === 'trash' ? 'restore' : 'trash')} title={folder === 'trash' ? 'Pulihkan pesan' : 'Pindahkan ke Sampah'}><Icon name={folder === 'trash' ? 'Undo2' : 'Trash2'} /><span>{folder === 'trash' ? 'Pulihkan' : 'Sampah'}</span></button><button disabled={acting} onClick={() => void act(selected, folder === 'spam' ? 'notSpam' : 'spam')} title={folder === 'spam' ? 'Bukan spam' : 'Tandai spam'}><Icon name={folder === 'spam' ? 'Check' : 'ShieldAlert'} /><span>{folder === 'spam' ? 'Bukan spam' : 'Spam'}</span></button></div> : <span className="au-toolbar-note">Aksi pesan menunggu verifikasi izin gmail.modify.</span>}<div className="au-spacer" /><span className="au-message-pos">{messages.findIndex(m => m.id === selected.id && m.account_id === selected.account_id) + 1} dari {messages.length}</span></div><div className="au-reader-scroll"><article className="au-reader-content"><div className="au-reader-status"><span className="au-category-badge">{title}</span><span className="au-category-badge">{accounts.find(a => a.id === selected.account_id)?.email}</span></div><h2>{detail?.subject || selected.subject}</h2><div className="au-reader-person"><div className="au-avatar">{sender(selected.sender).name.slice(0, 2).toUpperCase()}</div><div className="au-person-details"><strong>{sender(detail?.sender || selected.sender).name}</strong><p>{sender(detail?.sender || selected.sender).address} · kepada {detail?.recipient || selected.recipient}</p></div></div>{!detail ? <p>Memuat isi email…</p> : <MessageContent key={JSON.stringify([selected.account_id, selected.id])} html={detail.html} body={detail.body} mode={readMode} files={detail.attachments || []} account={selected.account_id} message={selected.id} />}<div className="au-reply-actions">{folder === 'drafts' && <button className="au-btn au-btn-primary" disabled={composeBusy} onClick={() => void editDraft(selected)}><Icon name="FilePenLine" />Edit draf</button>}<button className="au-btn au-btn-primary" onClick={() => openCompose(selected, 'reply')}><Icon name="Reply" />Balas</button><button className="au-btn au-btn-secondary" disabled={!detail || composeBusy} onClick={() => openCompose(selected, 'replyAll')}><Icon name="ReplyAll" />Balas semua</button><button className="au-btn au-btn-secondary" onClick={() => openCompose(selected, 'forward')} disabled={!detail || !detail.body} title={!detail?.body ? 'Teruskan email HTML di penyedia agar format dan lampiran tidak hilang' : 'Teruskan isi teks email'}><Icon name="Forward" />Teruskan</button>{detail?.url && providerLink(detail.url) && <a className="au-btn au-btn-secondary" href={detail.url} target="_blank" rel="noopener noreferrer">Buka di penyedia <Icon name="ExternalLink" size={16} /></a>}</div></article></div></> : <div className="au-reader-placeholder"><div className="au-reader-blank-icon"><Icon name="Mail" size={32} /></div><h2>Pilih pesan</h2><p>Isi email akan muncul di sini tanpa meninggalkan daftar.</p></div>}</section></div> : <div className="au-page-scroll"><div className="au-page-heading"><h1>Pengaturan</h1><p>Atur tampilan, lihat akun terhubung, dan kelola akses Gmail.</p></div><div className="au-settings-layout"><nav className="au-settings-nav" aria-label="Bagian pengaturan">{settingsSections.map(section => <button key={section} className={tab === section ? 'active' : ''} aria-current={tab === section ? 'page' : undefined} onClick={() => setTab(section)}>{section}</button>)}</nav><div className="au-page-card au-settings-panel"><h2>{tab}</h2>{tab === 'Tampilan & Preferensi' ? <>
                <section className="au-settings-section"><h3>Tampilan</h3><div className="au-preference-actions">
                  <button className="au-btn au-btn-secondary" onClick={() => { const value = theme === 'dark' ? 'light' : 'dark'; setTheme(value); try { localStorage.setItem('aurora-theme', value); } catch {} }}>Tema: {theme === 'dark' ? 'Aurora Dark' : 'Light'}</button>
                  <button className="au-btn au-btn-secondary" onClick={() => { const value = density === 'comfortable' ? 'compact' : 'comfortable'; setDensity(value); try { localStorage.setItem('aurora-density', value); } catch {} }}>Kepadatan: {density === 'comfortable' ? 'Nyaman' : 'Ringkas'}</button>
                </div><div className="au-read-mode-settings"><h4>Mode baca email</h4><div role="group" aria-label="Mode baca email">{(['Adaptive', 'Original', 'Plain Text'] as const).map(mode => <button key={mode} className={`au-btn ${readMode === mode ? 'au-btn-primary' : 'au-btn-secondary'}`} aria-pressed={readMode === mode} onClick={() => { setReadMode(mode); try { localStorage.setItem('aurora-read-mode', mode); } catch {} }}>{mode}</button>)}</div><p>Adaptive mengikuti tampilan aplikasi; Original mempertahankan format HTML aman; Plain Text tanpa gambar.</p></div></section>
                <section className="au-settings-section"><h3>Aksesibilitas</h3><p>Navigasi keyboard dan indikator fokus tersedia. Gunakan tema dan kepadatan di atas untuk kenyamanan membaca.</p><p>Animasi mengikuti preferensi reduced motion sistem: <strong className="au-motion-reduced">dikurangi</strong><strong className="au-motion-normal">normal</strong>. Ubah melalui pengaturan aksesibilitas perangkat.</p></section>
                <section className="au-settings-section"><h3>Pintasan keyboard</h3><table className="au-shortcut-table" aria-label="Pintasan keyboard"><thead><tr><th>Pintasan</th><th>Tindakan</th></tr></thead><tbody><tr><td><kbd>C</kbd></td><td>Buka penulis pesan</td></tr><tr><td><kbd>/</kbd> atau <kbd>Ctrl / ⌘ + K</kbd></td><td>Fokus pencarian</td></tr><tr><td><kbd>Escape</kbd></td><td>Tutup penulis/menu/pembaca seluler; konfirmasi jika ada teks belum terkirim</td></tr><tr><td><kbd>Enter</kbd></td><td>Buka pesan yang difokuskan</td></tr></tbody></table><p>C dan pintasan pencarian berlaku di luar kolom input.</p></section>
              </> : tab === 'Akun & Sinkronisasi' ? <>
                <section className="au-settings-section"><h3>Akun terhubung</h3>{accounts.map(a => <div className="au-real-account" key={a.id}><div className="au-account-identity"><strong>{a.email.split('@')[0]}</strong><span>{a.email}</span><small>{a.provider === 'google' ? 'Gmail' : 'Outlook · belum diverifikasi'} · {a.reconnect ? 'Perlu sambung ulang' : 'Tersambung'}</small>{a.provider === 'google' && <small>{a.gmail_modify === true ? 'Izin gmail.modify terverifikasi' : a.gmail_modify === false ? 'Izin gmail.modify belum diberikan' : 'Izin belum dapat diverifikasi'}</small>}</div><div><a className="au-btn au-btn-secondary" href={`/auth/${a.provider}?login_hint=${encodeURIComponent(a.email)}`}>Perbarui izin</a><button className="au-btn au-btn-secondary" onClick={() => void disconnect(a)}>Putuskan</button></div></div>)}{!accounts.length && <p>Belum ada akun terhubung.</p>}<div className="au-settings-actions"><a className="au-btn au-btn-primary" href="/auth/google"><Icon name="Plus" size={16} />Tambah Gmail</a><span>Outlook belum dikonfigurasi atau diverifikasi.</span></div></section>
                <section className="au-settings-section"><h3>Sinkronisasi</h3><p>Inbox diperiksa setiap 30 detik saat tab aktif dan daftar inbox terbuka; dijeda ketika halaman tambahan sudah dimuat. Gunakan Sinkronkan pada toolbar mailbox untuk memuat ulang. Pengaturan jadwal dan waktu sinkronisasi terakhir belum tersedia.</p></section>
              </> : tab === 'Email & Notifikasi' ? <>
                <section className="au-settings-section"><h3>Tanda tangan email</h3><p>Tanda tangan otomatis belum tersedia. Tambahkan secara manual saat menulis email.</p></section>
                <section className="au-settings-section"><h3>Notifikasi</h3><p>Notifikasi desktop belum tersedia. Pesan baru terlihat setelah inbox diperbarui; hasil tindakan dan kesalahan ditampilkan di aplikasi.</p></section>
              </> : tab === 'Privasi & Keamanan' ? <>
                <section className="au-settings-section"><h3>Gambar email</h3><p>Gambar HTTPS eksternal memerlukan izin per pesan sebelum dimuat pada Adaptive dan Original. Memuat gambar dapat mengungkap alamat IP dan waktu pembukaan kepada pengirim; permintaan dikirim tanpa referrer. Izin hanya di memori dan dicabut saat pesan berganti atau Pengaturan dibuka.</p><p>Gambar raster data dan CID dari pesan yang sama dapat tampil tanpa permintaan eksternal. CID ambigu atau format aktif diblokir. Plain Text tidak memuat gambar.</p></section>
                <section className="au-settings-section"><h3>HTML yang aman</h3><p>Adaptive menggunakan HTML yang disanitasi dan elemen React. Original memakai iframe sandbox tanpa JavaScript, formulir, atau akses same-origin; kebijakan CSP membatasi sumber daya. Format berbahaya dan URL sumber daya yang tidak diizinkan dibuang.</p></section>
                <section className="au-settings-section"><h3>OAuth & penyimpanan kredensial</h3><p>Akses Gmail memakai OAuth; pengiriman dan pengelolaan pesan memerlukan izin gmail.modify terverifikasi. Lihat status dan perbarui izin di Akun & Sinkronisasi. Refresh token disimpan di keyring OS, access token di memori; token tidak ditampilkan di Pengaturan.</p></section>
              </> : <>
                <section className="au-settings-section"><div className="au-about-brand"><img src={brandIcon} width="48" height="48" alt="" /><div><h3>Sela Aurora</h3><p>Versi frontend {frontendVersion}</p></div></div><p>Klien email lokal berbasis Rust/Axum dengan antarmuka React.</p></section>
                <section className="au-settings-section"><h3>Dukungan penyedia</h3><p>Gmail terhubung melalui OAuth. Outlook belum dikonfigurasi atau diverifikasi; pagination Outlook belum didukung. Lampiran Gmail mendukung unduh, preview PDF/gambar/teks, upload dan edit draf. Office dan arsip hanya diunduh. Penjadwalan, label khusus, lampiran Outlook, dan fitur tulis Outlook belum tersedia.</p><p><a href="https://developers.google.com/gmail/api/guides" target="_blank" rel="noopener noreferrer">Dokumentasi Gmail API</a></p></section>
              </>}</div></div></div>}
        <nav className="au-mobile-bottom" aria-label="Navigasi seluler"><button className={view === 'mail' ? 'active' : ''} onClick={() => view === 'settings' ? setView('mail') : navigate('inbox', 'all')} title="Inbox"><Icon name="Inbox" size={22} />Inbox</button><button title="Tulis email" onClick={() => openCompose()}><Icon name="SquarePen" size={22} />Tulis</button><button className={view === 'settings' ? 'active' : ''} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')} title="Setelan"><Icon name="Settings2" size={22} />Setelan</button></nav>
        {(accountError || error) && <div className="au-real-error" role="alert">{accountError || error}</div>}
        {notice && <div className="au-toast au-toast-info" role="status">{notice}<button title="Tutup notifikasi" aria-label="Tutup notifikasi" onClick={() => setNotice('')}><Icon name="X" size={16} /></button></div>}
        <section ref={composeElement} hidden={!compose} className={`au-compose-window${expanded ? ' is-expanded' : ''}${minimized ? ' is-minimized' : ''}`} aria-label="Tulis pesan" aria-busy={composeBusy}>
          <header className="au-compose-title"><strong>{minimized && subject ? subject : 'Pesan baru'}</strong><div>
            <button disabled={composeBusy} title={minimized ? 'Pulihkan pesan' : 'Minimalkan pesan'} aria-label={minimized ? 'Pulihkan pesan' : 'Minimalkan pesan'} onClick={()=>setMinimized(!minimized)}><Icon name={minimized ? 'Maximize' : 'Minus'} /></button>
            {!minimized && <button disabled={composeBusy} title={expanded ? 'Pulihkan ukuran' : 'Perbesar pesan'} aria-label={expanded ? 'Pulihkan ukuran' : 'Perbesar pesan'} onClick={()=>setExpanded(!expanded)}><Icon name={expanded ? 'Minimize' : 'Maximize'} /></button>}
            <button disabled={composeBusy} title="Tutup penulis pesan" aria-label="Tutup penulis pesan" onClick={closeCompose}><Icon name="X" /></button>
          </div></header>
          <div className="au-compose-content" hidden={minimized} inert={minimized || !compose} onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();if(!composeBusy){dragDepth.current++;setDragging(true);}}}} onDragLeave={event=>{if(event.dataTransfer.types.includes('Files')){dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect=composeBusy?'none':'copy';}} onDrop={event=>{event.preventDefault();dragDepth.current=0;setDragging(false);addFiles(event.dataTransfer.files);}}>
            <fieldset disabled={composeBusy} className="au-compose-fields">
              {compose && <SenderSelector accounts={accounts} value={composeFrom} onChange={setComposeFrom} disabled={composeBusy || !!composeSource || minimized} />}
              <div className="au-compose-to-row"><label>Kepada<input name="to" autoComplete="off" value={to} aria-invalid={!!composeErrors.to} aria-describedby={composeErrors.to?'compose-to-error':undefined} onChange={event=>{setTo(event.target.value);setComposeErrors(errors=>({...errors,to:''}));}} placeholder="nama@contoh.com" /></label><div className="au-compose-optional"><button aria-expanded={showCc} aria-controls="compose-cc-row" onClick={()=>setShowCc(!showCc)}>CC</button><button aria-expanded={showBcc} aria-controls="compose-bcc-row" onClick={()=>setShowBcc(!showBcc)}>BCC</button></div></div>
              {composeErrors.to && <small id="compose-to-error" className="au-compose-error">{composeErrors.to}</small>}
              <div id="compose-cc-row" hidden={!showCc}><label>CC<input value={cc} aria-invalid={!!composeErrors.cc} aria-describedby={composeErrors.cc?'compose-cc-error':undefined} onChange={event=>{setCc(event.target.value);setComposeErrors(errors=>({...errors,cc:''}));}} placeholder="alamat dipisahkan koma" /></label>{composeErrors.cc && <small id="compose-cc-error" className="au-compose-error">{composeErrors.cc}</small>}</div>
              <div id="compose-bcc-row" hidden={!showBcc}><label>BCC<input value={bcc} aria-invalid={!!composeErrors.bcc} aria-describedby={composeErrors.bcc?'compose-bcc-error':undefined} onChange={event=>{setBcc(event.target.value);setComposeErrors(errors=>({...errors,bcc:''}));}} placeholder="alamat dipisahkan koma" /></label>{composeErrors.bcc && <small id="compose-bcc-error" className="au-compose-error">{composeErrors.bcc}</small>}</div>
              <label>Subjek<input value={subject} aria-invalid={!!composeErrors.subject} aria-describedby={composeErrors.subject?'compose-subject-error':undefined} onChange={event=>{setSubject(event.target.value);setComposeErrors(errors=>({...errors,subject:''}));}} placeholder="Tambahkan subjek" /></label>{composeErrors.subject && <small id="compose-subject-error" className="au-compose-error">{composeErrors.subject}</small>}
            </fieldset>
            <textarea disabled={composeBusy} aria-label="Isi pesan" aria-invalid={!!composeErrors.body} aria-describedby={composeErrors.body?'compose-body-error':undefined} className="au-compose-body" value={body} onChange={event=>{setBody(event.target.value);setComposeErrors(errors=>({...errors,body:''}));}} placeholder="Tulis pesan…" />
            {composeErrors.body && <small id="compose-body-error" className="au-compose-error">{composeErrors.body}</small>}
            <div className={`au-compose-attachments${dragging ? ' is-dragging' : ''}`}>
              {compose && <ComposeAttachments key={composeSession.current} files={composeFiles} retained={retainedFiles} disabled={composeBusy} removeFile={file=>{if(!composeBusy)setComposeFiles(files=>files.filter(item=>item!==file));}} removeRetained={part=>{if(!composeBusy)setRetainedFiles(files=>files.filter(item=>item.part!==part));}} />}
              <small>{dragging ? 'Lepaskan file untuk melampirkan' : composeFiles.length+retainedFiles.length ? `${composeFiles.length+retainedFiles.length} file · ${fileSize([...composeFiles,...retainedFiles].reduce((size,file)=>size+file.size,0))} dari 25 MB` : 'Seret file ke sini, atau pilih Lampirkan file'}</small><small>Maksimal 100 file · 25 MB. File tanpa pratinjau tetap dapat dikirim.</small>
            </div>
          </div>
          <div className="au-compose-bottom-area" hidden={minimized} inert={minimized || !compose}>
            <p className="au-compose-feedback" role="status">{composeBusy ? composeOperation==='send' ? 'Mengirim pesan…' : 'Menyimpan draf…' : sendUncertain ? 'Status belum pasti. Periksa folder Terkirim sebelum mencoba lagi.' : accounts.find(a=>a.id===composeFrom)?.gmail_modify!==true ? 'Izin Gmail belum terverifikasi. Salin teks sebelum menutup.' : 'Teks biasa · Draf disimpan hanya saat Anda memilih Simpan draf'}</p>
            <footer className="au-compose-actions">
              <button className="au-btn au-btn-primary" disabled={composeBusy || sendUncertain || accounts.find(a=>a.id===composeFrom)?.gmail_modify!==true} title={sendUncertain?'Periksa folder Terkirim sebelum membuat pesan baru':'Kirim melalui Gmail'} onClick={()=>void submitCompose('send')}><Icon name="Send" size={16} />Kirim</button>
              <input ref={fileInput} hidden disabled={composeBusy} aria-label="Lampirkan file" type="file" multiple onChange={event=>{if(event.target.files)addFiles(event.target.files);event.target.value='';}} />
              <button className="au-btn au-compose-attach" disabled={composeBusy} onClick={()=>fileInput.current?.click()}><Icon name="Paperclip" size={17} /><span>Lampirkan file</span></button>
              <button className="au-btn au-compose-draft" disabled={composeBusy || accounts.find(a=>a.id===composeFrom)?.gmail_modify!==true} onClick={()=>void submitCompose('draft')}><Icon name="FilePenLine" size={16} /><span>Simpan draf</span></button>
            </footer>
          </div>
        </section>
      </div>
    </div>{menuOpen && <button className="au-sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} />}
  </div>;
}
