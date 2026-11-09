import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';
import './sender-selector.css';

type Account = { id: string; email: string; provider: string; reconnect: boolean; gmail_modify?: boolean | null };
function ProviderIcon({ provider }: { provider: string }) {
  return <span className="au-sender-icon" aria-hidden="true">{provider === 'google' ? <svg viewBox="0 0 24 24" width="19" height="19" fill="none" strokeWidth="3.2" strokeLinejoin="round"><path stroke="#82aaff" d="M4 19V7" /><path stroke="#83d4b4" d="M20 19V7" /><path stroke="#e8bb76" d="m17 9 3-2v5" /><path stroke="#ed969f" d="M4 7v-1l8 6 8-6v1M4 7l8 6 5-4" /></svg> : <Icon name="Mail" size={19} />}</span>;
}
export function SenderSelector({ accounts, value, onChange, disabled }: { accounts: Account[]; value: string; onChange: (id: string) => void; disabled: boolean }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = accounts.filter(account => account.provider === 'google');
  const selected = accounts.find(account => account.id === value);
  function close() { popup.current?.hidePopover(); setOpen(false); }
  function position() {
    const button = trigger.current, menu = popup.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    const below = Math.max(0, top + height - rect.bottom - 14), above = Math.max(0, rect.top - top - 14);
    const desired = Math.min(280, options.length * 48 + 12);
    const upward = below < desired && above > below;
    const menuHeight = Math.min(desired, upward ? above : below);
    const menuWidth = Math.min(Math.max(rect.width, 280), width - 16);
    Object.assign(menu.style, {left:`${Math.max(left+8,Math.min(rect.left,left+width-menuWidth-8))}px`,top:`${upward ? rect.top-menuHeight-6 : rect.bottom+6}px`,width:`${menuWidth}px`,maxHeight:`${menuHeight}px`});
  }
  function show(index = options.findIndex(account => account.id === value)) {
    if (disabled || !options.length) return;
    setActive(Math.max(0,index)); position(); popup.current?.showPopover(); setOpen(true);
  }
  function choose(index: number) {
    const account = options[index]; if (!account || disabled) return;
    onChange(account.id); close(); trigger.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {event.preventDefault(); event.stopPropagation(); close(); return;}
    if (event.key === 'Tab') {close(); return;}
    if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!open) {show(event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1 : undefined); return;}
      if (event.key === 'Enter' || event.key === ' ') choose(active);
      else setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1 : (index+(event.key === 'ArrowDown' ? 1 : -1)+options.length)%options.length);
    }
  }
  useEffect(() => { if (disabled) close(); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const update = () => position();
    window.addEventListener('resize',update); window.addEventListener('scroll',update,true);
    window.visualViewport?.addEventListener('resize',update); window.visualViewport?.addEventListener('scroll',update);
    return () => {window.removeEventListener('resize',update); window.removeEventListener('scroll',update,true); window.visualViewport?.removeEventListener('resize',update); window.visualViewport?.removeEventListener('scroll',update);};
  }, [open,options.length]);
  useEffect(() => { if (open) popup.current?.querySelector(`#${CSS.escape(id)}-${active}`)?.scrollIntoView({block:'nearest'}); }, [active,open,id]);
  return <div className="au-sender-field"><span id={`${id}-label`}>Dari</span><button type="button" className="au-sender-trigger" ref={trigger} role="combobox" aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length} onClick={() => open ? close() : show()} onKeyDown={keyDown} title={selected?.email}>
    <ProviderIcon provider={selected?.provider || 'google'} /><span className="au-sender-email" key={value}>{selected?.email || 'Pilih akun Gmail'}</span><svg className="au-sender-chevron" data-open={open} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
  </button><div id={`${id}-list`} ref={popup} popover="auto" className="au-sender-popup" role="listbox" aria-label="Akun pengirim" onToggle={event => setOpen(event.newState === 'open')} onKeyDown={event => {if (event.key === 'Escape') {event.stopPropagation(); close();}}}>
    {options.map((account,index) => <div key={account.id} id={`${id}-${index}`} role="option" aria-selected={account.id === value} className={`au-sender-option${active === index ? ' is-active' : ''}`} title={account.email} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><ProviderIcon provider={account.provider} /><span className="au-sender-email">{account.email}</span>{!account.reconnect && account.gmail_modify === true && <span className="au-sender-connected" role="img" aria-label="Izin Gmail terverifikasi" />}<span className="au-sender-check" aria-hidden="true">{account.id === value && <Icon name="Check" size={16} />}</span></div>)}
  </div></div>;
}
