// Keep base styles before feature styles; equal-specificity gallery rules depend on this order.
import './AuroraFullyInteractiveEmailClient.css';
import './compose.css';
import { ComposeEditor } from './ComposeEditor';
import { AssistantPanel } from './AssistantPanel';
import { SettingsPanel } from './SettingsPanel';
import { MailboxView } from './MailboxView';
import { useSettings } from './useSettings';
import { useMailbox } from './useMailbox';
import { useCompose } from './useCompose';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
const brandIcon = '/icon/sela_aurora_app_icon.svg';
type Folder = {
    id: string;
    label: string;
    icon: React.ComponentProps<typeof Icon>['name'];
};
const folders: Folder[] = [
    { id: 'inbox', label: 'Semua inbox', icon: 'Inbox' }, { id: 'starred', label: 'Berbintang', icon: 'Star' }, { id: 'important', label: 'Penting', icon: 'Flag' },
    { id: 'sent', label: 'Terkirim', icon: 'Send' }, { id: 'drafts', label: 'Draf', icon: 'FilePenLine' },
    { id: 'archive', label: 'Arsip', icon: 'Archive' }, { id: 'spam', label: 'Spam', icon: 'ShieldAlert' },
    { id: 'trash', label: 'Sampah', icon: 'Trash2' }, { id: 'allmail', label: 'Semua email', icon: 'Mails' }
];
const settingsSections = ['Tampilan & Preferensi', 'Akun & Sinkronisasi', 'Email & Notifikasi', 'AI & Penulisan', 'Privasi & Keamanan', 'Tentang Aurora'] as const;
const unsupported = 'Belum tersedia di aplikasi ini. Gunakan layanan email asal untuk tindakan ini.';
export function AuroraLive() {
    const [view, setView] = useState<'mail' | 'settings'>('mail');
    const [notice, setNotice] = useState('');
    const warn = (message = unsupported) => setNotice(message);
    const settings = useSettings();
    const { appSettings, density, theme, readMode, settingsError } = settings;
    const mailbox = useMailbox({ view, warn });
    const { setMobileReading, accounts, selectedAccount, setFolder, setSelectedAccount, setCategory, setSearch, setQuery, detail, setError, loadInbox, messages, folder, search, error, disconnect, accountError } = mailbox;
    const composer = useCompose({ accounts, selectedAccount, detail, appSettings, warn, setError, view, loadInbox });
    const { compose, minimized, closeCompose, openCompose, to, cc, bcc, subject, body, composeFiles, retainedFiles, composeBusy, editDraft } = composer;
    const [tab, setTab] = useState<(typeof settingsSections)[number]>('Tampilan & Preferensi');
    const [menuOpen, setMenuOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    useEffect(() => { if (!notice)
        return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (document.querySelector('dialog[open]'))
                return;
            if (event.key === 'Escape') {
                if (compose && !minimized)
                    closeCompose();
                setMenuOpen(false);
                setMobileReading(false);
            }
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
                return;
            if (event.key === '/' || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey))) {
                event.preventDefault();
                searchRef.current?.focus();
            }
            if (event.key.toLowerCase() === 'c' && !compose) {
                event.preventDefault();
                openCompose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [compose, minimized, to, cc, bcc, subject, body, composeFiles, retainedFiles, composeBusy, accounts, selectedAccount]);
    function navigate(nextFolder: string, nextAccount = selectedAccount) {
        setView('mail');
        setFolder(nextFolder);
        setSelectedAccount(nextAccount);
        setCategory('all');
        setSearch('');
        setQuery('');
        setMenuOpen(false);
    }
    const count = messages.filter(m => m.unread).length;
    const title = folders.find(f => f.id === folder)?.label || 'Semua inbox';
    const initials = (email: string) => email.slice(0, 2).toUpperCase();
    return <div className={`aurora-app au-density-${density} ${theme === 'light' ? 'au-theme-light' : ''}`}>
    <div className="au-app-grid">
      <aside className="au-rail" aria-label="Akun dan tampilan">
        <div className="au-logo-mark"><img src={brandIcon} width="42" height="42" alt="Sela Aurora"/></div>
        <button className={`au-rail-icon ${selectedAccount === 'all' && view === 'mail' ? 'selected' : ''}`} title="Semua akun" aria-label="Semua akun" aria-current={selectedAccount === 'all' && view === 'mail' ? 'page' : undefined} onClick={() => view === 'settings' ? setView('mail') : navigate('inbox', 'all')}><Icon name="Inbox" size={22}/></button>
        {accounts.map(a => <button key={a.id} className={`au-rail-account ${selectedAccount === a.id && view === 'mail' ? 'selected' : ''}`} title={a.email} aria-label={a.email} aria-current={selectedAccount === a.id && view === 'mail' ? 'page' : undefined} onClick={() => navigate('inbox', a.id)}>{initials(a.email)}<span className={`au-rail-status ${a.reconnect ? 'error' : 'live'}`}/></button>)}
        <div className="au-rail-bottom"><button className={`au-rail-icon ${view === 'settings' ? 'selected' : ''}`} title="Pengaturan" aria-label="Pengaturan" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => { setMenuOpen(false); setView(view === 'settings' ? 'mail' : 'settings'); }}><Icon name="Settings2" size={22}/></button></div>
      </aside>
      <aside className={`au-sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Navigasi email">
        <div className="au-brand"><div><div className="au-brand-word">sela</div><div className="au-brand-tag">AURORA MAIL EXPERIENCE</div></div><button className="au-sidebar-close" title="Tutup menu" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}><Icon name="X"/></button></div>
        <button className="au-compose-trigger" onClick={() => openCompose()}><Icon name="SquarePen"/><span>Tulis email</span><span className="au-keycap">C</span></button>
        <div className="au-sidebar-scroll"><div className="au-section-label">MAILBOX</div><nav className="au-nav-list" aria-label="Folder email">{folders.map(f => <button key={f.id} className={`au-nav-item ${view === 'mail' && folder === f.id ? 'active' : ''}`} aria-current={view === 'mail' && folder === f.id ? 'page' : undefined} onClick={() => navigate(f.id)}><Icon name={f.icon}/><span>{f.label}</span></button>)}</nav>
          <div className="au-section-label"><Icon name="UsersRound" size={14}/> AKUN TERHUBUNG</div><div className="au-account-sidebar">{accounts.map(a => <button key={a.id} className="au-sidebar-account" aria-current={selectedAccount === a.id && view === 'mail' ? 'page' : undefined} onClick={() => navigate('inbox', a.id)}><span className="au-provider-symbol">{a.provider === 'google' ? 'G' : 'M'}</span><span><strong>{a.email.split('@')[0]}</strong><small>{a.email}</small></span><span className="au-sm-dot"/></button>)}</div></div>
      </aside>
      <div className="au-main-shell"><header className="au-topbar"><button className="au-topbar-menu" title="Buka menu" aria-label="Buka menu" onClick={() => setMenuOpen(true)}><Icon name="Menu"/></button><form className="au-search-box" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setView('mail'); }}><Icon name="Search"/><input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari di semua akun..." aria-label="Cari email" maxLength={200}/><button title="Cari" aria-label="Cari" type="submit"><Icon name="Search" size={16}/></button></form><div className="au-topbar-gap"/><button className="au-sync-status" onClick={() => void loadInbox()} title="Sinkronkan"><span className="au-sm-dot"/>{accounts.length} akun terhubung <Icon name="RefreshCw" size={16}/></button></header>
        {view === 'mail' ? <MailboxView model={mailbox} title={title} count={count} readMode={readMode} composeBusy={composeBusy} editDraft={editDraft} openCompose={openCompose}/> : <SettingsPanel model={settings} tab={tab} setTab={setTab} accounts={accounts} disconnect={disconnect}/>}
        <nav className="au-mobile-bottom" aria-label="Navigasi seluler"><button className={view === 'mail' ? 'active' : ''} onClick={() => view === 'settings' ? setView('mail') : navigate('inbox', 'all')} title="Inbox"><Icon name="Inbox" size={22}/>Inbox</button><button title="Tulis email" onClick={() => openCompose()}><Icon name="SquarePen" size={22}/>Tulis</button><button className={view === 'settings' ? 'active' : ''} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')} title="Setelan"><Icon name="Settings2" size={22}/>Setelan</button></nav>
        {view === 'settings' && settingsError && <p className="au-real-error" role="alert">{settingsError}</p>}
        {(accountError || error) && <div className="au-real-error" role="alert">{accountError || error}</div>}
        {notice && <div className="au-toast au-toast-info" role="status">{notice}<button title="Tutup notifikasi" aria-label="Tutup notifikasi" onClick={() => setNotice('')}><Icon name="X" size={16}/></button></div>}
        <AssistantPanel accounts={accounts} settings={appSettings} settingsError={settingsError} openSettings={()=>{setMenuOpen(false);setTab('AI & Penulisan');setView('settings');}} composeOpen={compose} selected={mailbox.selected?{account_id:mailbox.selected.account_id,message_id:mailbox.selected.id}:undefined} importDraft={composer.importAssistantDraft}/>
        <ComposeEditor model={composer} accounts={accounts} appSettings={appSettings}/>
      </div>
    </div>{menuOpen && <button className="au-sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}/>}
  </div>;
}
