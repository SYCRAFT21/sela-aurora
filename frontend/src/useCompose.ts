import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type Account, type Mail, type Detail, type SettingsView, type ComposeInput } from './api';
import { Attachment } from './AttachmentGallery';
import { sender, mailboxes } from './mailPresentation';
export function useCompose({ accounts, selectedAccount, detail, appSettings, warn, setError, view, loadInbox }: {
    accounts: Account[];
    selectedAccount: string;
    detail: Detail | null;
    appSettings: SettingsView | null;
    warn: (message?: string) => void;
    setError: (message: string) => void;
    view: 'mail' | 'settings';
    loadInbox: (silent?: boolean) => Promise<boolean>;
}) {
    const assistantOrigin = useRef(false);
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
        if (!compose || minimized)
            return;
        const element = composeElement.current!;
        const media = matchMedia('(max-width:660px)');
        let restore: (() => void)[] = [];
        const update = () => {
            restore.forEach(fn => fn());
            restore = [];
            if (!media.matches)
                return;
            let child: HTMLElement = element;
            while (child.parentElement && !child.classList.contains('aurora-app')) {
                for (const sibling of child.parentElement.children)
                    if (sibling !== child && sibling instanceof HTMLElement && !sibling.matches('.au-real-error,.au-toast')) {
                        const previous = sibling.inert;
                        sibling.inert = true;
                        restore.push(() => { sibling.inert = previous; });
                    }
                child = child.parentElement;
            }
        };
        update();
        media.addEventListener('change', update);
        const frame = requestAnimationFrame(() => element.querySelector<HTMLInputElement>('input[name="to"]')?.focus());
        const trap = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || !media.matches)
                return;
            const controls = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')).filter(control => control.getClientRects().length && !control.closest('[hidden],[inert]'));
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        element.addEventListener('keydown', trap);
        return () => { cancelAnimationFrame(frame); restore.forEach(fn => fn()); media.removeEventListener('change', update); element.removeEventListener('keydown', trap); composeOpener.current?.focus(); };
    }, [compose, minimized]);
    const [composeErrors, setComposeErrors] = useState<Record<string, string>>({});
    const [composeOperation, setComposeOperation] = useState<'send' | 'draft' | null>(null);
    useEffect(() => {
        if (!compose)
            return;
        const viewport = window.visualViewport;
        const update = () => {
            composeElement.current?.style.setProperty('--compose-height', `${viewport?.height || innerHeight}px`);
            composeElement.current?.style.setProperty('--compose-top', `${viewport?.offsetTop || 0}px`);
        };
        update();
        viewport?.addEventListener('resize', update);
        viewport?.addEventListener('scroll', update);
        window.addEventListener('resize', update);
        return () => { viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
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
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiConsent, setAiConsent] = useState(false);
    const [aiBusy, setAiBusy] = useState(false);
    const [aiResult, setAiResult] = useState<{
        subject: string;
        body: string;
    } | null>(null);
    const [aiError, setAiError] = useState('');
    const aiRequest = useRef<AbortController | null>(null);
    const resetAi = () => { aiRequest.current?.abort(); aiRequest.current = null; setAiInstruction(''); setAiConsent(false); setAiBusy(false); setAiResult(null); setAiError(''); };
    useEffect(() => () => aiRequest.current?.abort(), []);
    const composeDirty = compose && Boolean(to || cc || bcc || subject || body || aiInstruction || composeFiles.length || retainedFiles.length);
    useEffect(() => {
        if (!composeDirty)
            return;
        // ponytail: native unload prompts cannot cover mobile process termination; save important drafts to Gmail.
        const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', protect);
        return () => window.removeEventListener('beforeunload', protect);
    }, [composeDirty]);
    const [editingDraft, setEditingDraft] = useState<{
        draft_id: string;
        message_id: string;
        html_only: boolean;
    } | null>(null);
    useEffect(() => { aiRequest.current?.abort(); aiRequest.current = null; setAiBusy(false); setAiConsent(false); setAiResult(null); setAiError(''); }, [appSettings?.ai.endpoint, appSettings?.ai.protocol, appSettings?.ai.model]);
    async function generateAi() {
        if (composeBusy || aiRequest.current || sendUncertain || !aiConsent)
            return;
        if (new TextEncoder().encode(aiInstruction).length > 8192) {
            setAiError('Instruksi maksimal 8 KiB.');
            return;
        }
        const controller = new AbortController(), session = composeSession.current;
        aiRequest.current = controller;
        setAiBusy(true);
        setAiError('');
        setAiResult(null);
        try {
            const result = await api.generateAi({ instruction: aiInstruction, consent: aiConsent }, controller.signal);
            if (controller.signal.aborted || session !== composeSession.current)
                return;
            if (typeof result.subject !== 'string' || typeof result.body !== 'string')
                throw new Error('Hasil AI tidak valid');
            setAiResult(result);
        }
        catch (cause) {
            if (!controller.signal.aborted && session === composeSession.current)
                setAiError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            if (aiRequest.current === controller) {
                aiRequest.current = null;
                setAiBusy(false);
            }
        }
    }
    function resetComposePresentation() { setMinimized(false); setExpanded(false); setShowCc(false); setShowBcc(false); setDragging(false); dragDepth.current = 0; setComposeErrors({}); }
    function addFiles(incoming: FileList | File[]) {
        if (composeBusy)
            return;
        // Match the server's filename/MIME boundary; reject the entire selection without losing prior files.
        if (Array.from(incoming).some(file => !file.name || [...file.name].length > 180 || /[/\\\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(file.name) || /^[ .]|[ .]$/.test(file.name))) {
            warn('Nama file tidak didukung. Ubah nama: maksimal 180 karakter, tanpa pemisah path, kontrol, atau titik/spasi di tepi.');
            return;
        }
        if (Array.from(incoming).some(file => file.type && (file.type.length > 127 || !/^[A-Za-z0-9!#$&^_.+\-]+\/[A-Za-z0-9!#$&^_.+\-]+$/.test(file.type)))) {
            warn('Tipe MIME file tidak valid. Pilih ulang file dengan tipe yang valid.');
            return;
        }
        const next = [...composeFiles, ...Array.from(incoming)];
        if (next.length + retainedFiles.length > 100 || next.reduce((size, file) => size + file.size, 0) + retainedFiles.reduce((size, file) => size + file.size, 0) > 25000000) {
            warn('Lampiran maksimal 100 file, total 25 MB.');
            return;
        }
        setComposeFiles(next);
    }
    function openCompose(message?: Mail, mode: 'reply' | 'replyAll' | 'forward' | 'new' = 'new') {
        if (composeBusy || mode === 'replyAll' && !detail)
            return;
        if (!compose)
            composeOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (composeDirty && !confirm('Ganti pesan yang belum dikirim? Teks dan lampiran akan hilang.'))
            return;
        resetAi();
        resetComposePresentation();
        setShowCc(mode === 'replyAll');
        composeSession.current++;
        setEditingDraft(null);
        setComposeFiles([]);
        setRetainedFiles(mode === 'forward' ? (detail?.attachments || []).filter(file => !file.inline) : []);
        setComposeFrom(message?.account_id || (selectedAccount !== 'all' ? selectedAccount : accounts[0]?.id || ''));
        const owner = accounts.find(account => account.id === message?.account_id);
        const seen = new Set<string>();
        const unique = (values: string[]) => values.filter(address => {
            const key = address.toLowerCase();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        const ownMessage = message && owner?.email.toLowerCase() === sender(message.sender).address.toLowerCase();
        const replyTo = unique(mailboxes(ownMessage ? detail?.recipient || message?.recipient || '' : message?.sender || ''));
        setTo((mode === 'reply' || mode === 'replyAll') && message ? replyTo.join(', ') : '');
        if (owner)
            seen.add(owner.email.toLowerCase());
        setCc(mode === 'replyAll' ? unique([...mailboxes(detail?.recipient || message?.recipient || ''), ...mailboxes(detail?.cc || '')]).join(', ') : '');
        setBcc('');
        setSubject(message ? (mode === 'forward' ? 'Fwd: ' : 'Re: ') + message.subject : '');
        setComposeMode(mode);
        submissionId.current = null;
        setSendUncertain(false);
        setComposeSource(message?.id || null);
        setBody(mode === 'forward' && message && detail ? `\n\n----- Pesan diteruskan -----\nDari: ${detail.sender}\nKepada: ${detail.recipient}\nSubjek: ${detail.subject}\n\n${detail.body || '[Pesan HTML: buka di penyedia untuk meneruskan format asli]'}` : '');
        setCompose(true);
    }
    async function editDraft(message: Mail) {
        if (composeBusy)
            return;
        if (compose && !confirm('Ganti pesan yang sedang ditulis? Teks dan lampiran akan hilang.'))
            return;
        if (!compose)
            composeOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        resetAi();
        const session = ++composeSession.current;
        setComposeBusy(true);
        try {
            const draft = await api.draft(message.account_id, message.id);
            if (session !== composeSession.current)
                return;
            if (draft.html_only && !confirm('Draf ini hanya HTML. Mengedit akan mengubah format menjadi teks biasa. Lanjutkan?'))
                return;
            resetComposePresentation();
            setShowCc(!!draft.cc);
            setShowBcc(!!draft.bcc);
            setEditingDraft(draft);
            setComposeFrom(message.account_id);
            setComposeSource(draft.message_id);
            setComposeMode('new');
            setTo(draft.to);
            setCc(draft.cc);
            setBcc(draft.bcc);
            setSubject(draft.subject);
            setBody(draft.body);
            setComposeFiles([]);
            setRetainedFiles(draft.attachments);
            setSendUncertain(false);
            submissionId.current = null;
            setCompose(true);
        }
        catch (cause) {
            setError('Draf belum dapat dibuka: ' + String(cause));
        }
        finally {
            setComposeBusy(false);
        }
    }
    function importAssistantDraft(draft: import('./api').AssistantDraft, accountId:string, source?:import('./api').MessageReference|null, mode:'new'|'reply'|'forward'='new'):boolean {
        if (composeBusy || aiBusy || sendUncertain || composeSource || !accounts.some(a=>a.id===accountId&&a.provider==='google')) {warn('Penulis sedang dipakai atau akun tidak tersedia.');return false;}
        if (composeDirty && !confirm('Ganti pesan yang belum dikirim? Teks dan lampiran akan hilang.')) return false;
        if(source&&source.account_id!==accountId){warn('Sumber pesan harus berasal dari akun pengirim.');return false;}
        resetAi();resetComposePresentation();composeSession.current++;setEditingDraft(null);setComposeFiles([]);setRetainedFiles([]);setComposeSource(source?.message_id||null);setComposeMode(source?mode:'new');submissionId.current=null;
        setComposeFrom(accountId);setTo(draft.to);setCc(draft.cc);setBcc(draft.bcc);setShowCc(!!draft.cc);setShowBcc(!!draft.bcc);setSubject(draft.subject);setBody(draft.body);setCompose(true);assistantOrigin.current=true;return true;
    }
    function closeCompose() {
        if (composeBusy)
            return;
        if (composeDirty && !confirm('Tutup pesan yang belum dikirim? Teks dan lampiran akan hilang.'))
            return;
        resetAi();
        composeSession.current++;
        setComposeFiles([]);
        setRetainedFiles([]);
        setCompose(false);
        setTo('');
        setCc('');
        setBcc('');
        setSubject('');
        setBody('');
    }
    async function submitCompose(mode: 'send' | 'draft') {
        const owner = accounts.find(account => account.id === composeFrom);
        if (!owner || owner.provider !== 'google' || owner.gmail_modify !== true) {
            warn('Izin gmail.modify belum terverifikasi untuk akun pengirim.');
            return;
        }
        if (composeBusy || aiRequest.current || sendUncertain && mode === 'send') {
            warn('Periksa folder Terkirim sebelum membuat pesan baru.');
            return;
        }
        const errors: Record<string, string> = {};
        const length = (value: string) => new TextEncoder().encode(value).length;
        for (const [field, value] of Object.entries({ to: to.trim(), cc: cc.trim(), bcc: bcc.trim() })) {
            if (!value && field !== 'to')
                continue;
            if (!value || length(value) > 1024 || /[\x00-\x1f\x7f]/.test(value) || value.split(',').length > 20 || !value.split(',').every(raw => {
                const address = raw.trim(), parts = address.split('@'), local = parts[0], domain = parts[1];
                return address.length <= 254 && /^[A-Za-z0-9@._+\-]+$/.test(address) && parts.length === 2 && !!local && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && !!domain && domain.includes('.') && domain.split('.').every(part => !!part && !part.startsWith('-') && !part.endsWith('-'));
            }))
                errors[field] = 'Gunakan maksimal 20 alamat email, dipisahkan koma (maks. 1024 byte).';
        }
        if (!subject.trim() || length(subject) > 512 || /[\x00-\x1f\x7f]/.test(subject))
            errors.subject = 'Isi subjek tanpa karakter kontrol, maksimal 512 byte.';
        if (length(body) > 1000000)
            errors.body = 'Isi pesan maksimal 1 MB.';
        setComposeErrors(errors);
        if (Object.keys(errors).length) {
            if (errors.cc)
                setShowCc(true);
            if (errors.bcc)
                setShowBcc(true);
            requestAnimationFrame(() => composeElement.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
            return;
        }
        if (mode === 'send' && !confirm(assistantOrigin.current ? `Kirim sekarang melalui ${owner.email}?\nKepada: ${to}\nCC: ${cc || '—'}\nBCC: ${bcc || '—'}\nSubjek: ${subject}\n\n${body}\n\nLampiran: ${[...composeFiles.map(f=>`${f.name} (${f.size} byte)`),...retainedFiles.map(f=>`${f.filename} (${f.size} byte)`)].join(', ') || 'Tidak ada'}\nWaktu: Kirim sekarang, bukan email terjadwal.` : 'Kirim email ke ' + to + '?'))
            return;
        setComposeBusy(true);
        setComposeOperation(mode);
        const session = composeSession.current;
        if (mode === 'send' && !submissionId.current)
            submissionId.current = crypto.randomUUID();
        try {
            const manifest: ComposeInput = { to: to.trim(), subject, body, ...(editingDraft ? { draft_id: editingDraft.draft_id, expected_message_id: editingDraft.message_id, convert_html: editingDraft.html_only } : {}), ...(cc.trim() ? { cc: cc.trim() } : {}), ...(bcc.trim() ? { bcc: bcc.trim() } : {}), mode: mode === 'draft' ? 'draft' : composeMode, ...(composeSource ? { message_id: composeSource } : {}), ...(mode === 'draft' && ['reply', 'replyAll'].includes(composeMode) ? { draft_reply: true } : {}), ...(mode === 'send' ? { submission_id: submissionId.current } : {}), ...(composeFiles.length ? { files: composeFiles.map((file, index) => ({ id: `file${index}`, filename: file.name, mime_type: file.type || 'application/octet-stream', size: file.size })) } : {}), ...(retainedFiles.length ? { retained: retainedFiles.map(file => ({ message_id: composeSource, part: file.part })) } : {}) };
            const form = new FormData();
            form.append('manifest', JSON.stringify(manifest));
            composeFiles.forEach((file, index) => form.append(`file${index}`, file));
            try {
                await api.compose(composeFrom, composeFiles.length ? form : manifest);
            }
            catch (cause) {
                if (session !== composeSession.current)
                    return;
                if (mode === 'send' && cause instanceof ApiError && [400, 413, 422, 424, 429].includes(cause.status)) {
                    submissionId.current = null;
                    setError('Perbaiki pesan sebelum mengirim ulang: ' + cause.message);
                    return;
                }
                throw cause;
            }
            if (session !== composeSession.current)
                return;
            resetAi();
            composeSession.current++;
            setComposeFiles([]);
            setRetainedFiles([]);
            setCompose(false);
            setTo('');
            setCc('');
            setBcc('');
            setSubject('');
            setBody('');
            warn(mode === 'draft' ? 'Draf tersimpan di Gmail' : 'Pesan terkirim melalui Gmail');
            if (view === 'mail')
                void loadInbox();
        }
        catch (cause) {
            if (mode === 'send') {
                setSendUncertain(true);
                setError('Status pengiriman tidak diketahui. Periksa folder Terkirim sebelum mencoba lagi. ' + String(cause));
            }
            else
                setError('Draf belum tersimpan: ' + String(cause));
        }
        finally {
            setComposeBusy(false);
            setComposeOperation(null);
        }
    }
    useEffect(() => { setComposeFrom(id => accounts.some(account => account.id === id) ? id : accounts[0]?.id || ''); }, [accounts]);
    return { importAssistantDraft, setComposeFrom, compose, minimized, closeCompose, openCompose, to, cc, bcc, subject, body, composeFiles, retainedFiles, composeBusy, editDraft, composeElement, expanded, aiBusy, setMinimized, setExpanded, dragDepth, setDragging, addFiles, composeFrom, composeSource, composeErrors, setTo, setComposeErrors, showCc, setShowCc, showBcc, setShowBcc, setCc, setBcc, setSubject, setBody, composeSession, aiInstruction, setAiInstruction, aiConsent, setAiConsent, sendUncertain, generateAi, aiError, aiResult, dragging, setComposeFiles, setRetainedFiles, composeOperation, submitCompose, fileInput };
}
