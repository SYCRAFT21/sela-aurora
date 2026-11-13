import { useEffect, useRef, useState } from 'react';
import { api, type Account, type Mail, type Detail } from './api';
export function useMailbox({ view, warn }: {
    view: 'mail' | 'settings';
    warn: (message?: string) => void;
}) {
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
    const [mobileReading, setMobileReading] = useState(false);
    const [error, setError] = useState('');
    const [accountError, setAccountError] = useState('');
    const [accountsReady, setAccountsReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const listRequest = useRef(0);
    const loadedExtraPages = useRef(false);
    const detailRequest = useRef(0);
    const currentAccount = accounts.find(a => a.id === selectedAccount);
    const microsoftUnsupported = accounts.some(a => a.provider === 'microsoft' && (selectedAccount === 'all' || selectedAccount === a.id)) && (Boolean(query) || ['starred', 'allmail'].includes(folder) || (folder === 'inbox' && !['all', 'primary'].includes(category)));
    async function loadAccounts(): Promise<Account[] | null> {
        try {
            const list = await api.accounts();
            setAccounts(list);
            setAccountError('');
            setAccountsReady(true);
            return list;
        }
        catch (cause) {
            setAccountError('Gagal memuat akun: ' + String(cause));
            setLoading(false);
            return null;
        }
    }
    async function loadInbox(silent = false): Promise<boolean> {
        if (!accountsReady || (silent && (document.hidden || selected || loading || loadedExtraPages.current || Object.keys(nextCursors).length > 0 || messages.length > 30)))
            return false;
        const current = ++listRequest.current;
        if (!silent) {
            loadedExtraPages.current = false;
            setLoading(true);
            setError('');
            setMessages([]);
            setNextCursors({});
            setLimitedAccounts([]);
            setSelected(null);
            setDetail(null);
            setMobileReading(false);
            ++detailRequest.current;
        }
        try {
            const params = new URLSearchParams({ mailbox: folder, category, search: query.trim() });
            const result = await api.inbox(selectedAccount, params);
            if (current !== listRequest.current)
                return false;
            setMessages(result.messages);
            setNextCursors(result.next_cursors || {});
            setLimitedAccounts(result.limited_accounts || []);
            if (!silent && accounts.some(account => account.provider === 'google' && account.gmail_modify == null))
                void loadAccounts();
            setError([...(microsoftUnsupported ? ['Pencarian, kategori Gmail, Berbintang, dan Semua email Outlook belum didukung pada tampilan ini.'] : []), ...result.errors].join('\n'));
            return result.errors.length === 0;
        }
        catch (cause) {
            if (current === listRequest.current)
                setError('Gagal memuat email: ' + String(cause));
            return false;
        }
        finally {
            if (current === listRequest.current)
                setLoading(false);
        }
    }
    async function loadMore() {
        if (!Object.keys(nextCursors).length || loadingMore)
            return;
        const current = listRequest.current;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams({ mailbox: folder, category, search: query.trim(), cursors: JSON.stringify(nextCursors) });
            const result = await api.inbox(selectedAccount, params);
            if (current !== listRequest.current)
                return;
            loadedExtraPages.current = true;
            setMessages(previous => {
                const seen = new Set(previous.map(message => message.account_id + '/' + message.id));
                const merged = [...previous];
                for (const message of result.messages) {
                    if (!seen.has(message.account_id + '/' + message.id)) {
                        merged.push(message);
                        seen.add(message.account_id + '/' + message.id);
                    }
                }
                return merged.sort((a, b) => b.received.localeCompare(a.received) || a.account_id.localeCompare(b.account_id) || a.id.localeCompare(b.id));
            });
            setNextCursors(result.next_cursors || {});
            setError(result.errors.join('\n'));
        }
        catch (cause) {
            if (current === listRequest.current)
                setError('Gagal memuat halaman berikutnya: ' + String(cause));
        }
        finally {
            setLoadingMore(false);
        }
    }
    async function openMail(message: Mail) {
        const current = ++detailRequest.current;
        setSelected(message);
        setDetail(null);
        setMobileReading(true);
        setError('');
        try {
            const value = await api.detail(message.account_id, message.id);
            if (current !== detailRequest.current)
                return;
            setDetail(value);
            if (message.unread) {
                try {
                    await api.markRead(message.account_id, message.id);
                }
                catch (cause) {
                    throw new Error('Status dibaca gagal disinkronkan: ' + (cause instanceof Error ? cause.message : String(cause)));
                }
                if (current === detailRequest.current)
                    setMessages(list => list.map(m => m.id === message.id && m.account_id === message.account_id ? { ...m, unread: false } : m));
            }
        }
        catch (cause) {
            if (current === detailRequest.current)
                setError('Gagal memuat email: ' + String(cause));
        }
    }
    async function act(message: Mail, action: string) {
        const owner = accounts.find(account => account.id === message.account_id);
        if (!owner || owner.provider !== 'google' || owner.gmail_modify !== true) {
            warn('Izin gmail.modify belum terverifikasi untuk akun ini. Perbarui izin di Kelola akun.');
            return;
        }
        if (actionPending.current)
            return;
        actionPending.current = true;
        setActing(true);
        try {
            await api.action(message.account_id, message.id, action);
            setSelected(null);
            setDetail(null);
            setMobileReading(false);
            if (await loadInbox())
                warn('Perubahan pesan tersimpan di Gmail');
            else
                warn('Gmail menerima perubahan, tetapi daftar gagal dimuat ulang.');
        }
        catch (cause) {
            setError('Gagal mengubah pesan: ' + String(cause));
        }
        finally {
            actionPending.current = false;
            setActing(false);
        }
    }
    async function disconnect(account: Account) {
        if (!confirm('Putuskan ' + account.email + '? Email di penyedia tidak dihapus.'))
            return;
        try {
            await api.disconnect(account.id);
            const list = await loadAccounts();
            if (list && !list.some(a => a.id === selectedAccount))
                setSelectedAccount('all');
            if (list)
                warn('Akun diputuskan');
        }
        catch (cause) {
            setError('Gagal memutuskan akun: ' + String(cause));
        }
    }
    useEffect(() => { void loadAccounts(); }, []);
    useEffect(() => { if (accountsReady)
        void loadInbox(); }, [accountsReady, selectedAccount, folder, category, query]);
    useEffect(() => { const timer = setInterval(() => { if (view === 'mail')
        void loadInbox(true); }, 30000); const visible = () => { if (!document.hidden && view === 'mail')
        void loadInbox(true); }; document.addEventListener('visibilitychange', visible); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); }; }, [accountsReady, loading, selectedAccount, folder, category, query, selected, view]);
    return { setMobileReading, accounts, selectedAccount, setFolder, setSelectedAccount, setCategory, setSearch, setQuery, detail, setError, loadInbox, messages, folder, search, mobileReading, currentAccount, query, category, loading, selected, openMail, nextCursors, loadingMore, loadMore, limitedAccounts, error, acting, act, disconnect, accountError };
}
