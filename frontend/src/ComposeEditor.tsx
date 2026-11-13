import type { useCompose } from './useCompose';
import { destination } from './mailPresentation';
import { type Account, type SettingsView } from './api';
import { SenderSelector } from './SenderSelector';
import { ComposeAttachments, fileSize } from './ComposeAttachment';
import { Icon } from './Icon';
type Props = {
    model: Pick<ReturnType<typeof useCompose>, 'composeElement' | 'compose' | 'expanded' | 'minimized' | 'composeBusy' | 'aiBusy' | 'subject' | 'setMinimized' | 'setExpanded' | 'closeCompose' | 'dragDepth' | 'setDragging' | 'addFiles' | 'composeFrom' | 'setComposeFrom' | 'composeSource' | 'to' | 'composeErrors' | 'setTo' | 'setComposeErrors' | 'showCc' | 'setShowCc' | 'showBcc' | 'setShowBcc' | 'cc' | 'setCc' | 'bcc' | 'setBcc' | 'setSubject' | 'body' | 'setBody' | 'composeSession' | 'aiInstruction' | 'setAiInstruction' | 'aiConsent' | 'setAiConsent' | 'sendUncertain' | 'generateAi' | 'aiError' | 'aiResult' | 'dragging' | 'composeFiles' | 'retainedFiles' | 'setComposeFiles' | 'setRetainedFiles' | 'composeOperation' | 'submitCompose' | 'fileInput'>;
    accounts: Account[];
    appSettings: SettingsView | null;
};
export function ComposeEditor({ model, accounts, appSettings }: Props) {
    const { composeElement, compose, expanded, minimized, composeBusy, aiBusy, subject, setMinimized, setExpanded, closeCompose, dragDepth, setDragging, addFiles, composeFrom, setComposeFrom, composeSource, to, composeErrors, setTo, setComposeErrors, showCc, setShowCc, showBcc, setShowBcc, cc, setCc, bcc, setBcc, setSubject, body, setBody, composeSession, aiInstruction, setAiInstruction, aiConsent, setAiConsent, sendUncertain, generateAi, aiError, aiResult, dragging, composeFiles, retainedFiles, setComposeFiles, setRetainedFiles, composeOperation, submitCompose, fileInput } = model;
    return <section ref={composeElement} hidden={!compose} className={`au-compose-window${expanded ? ' is-expanded' : ''}${minimized ? ' is-minimized' : ''}`} aria-label="Tulis pesan" aria-busy={composeBusy || aiBusy}>
          <header className="au-compose-title"><strong>{minimized && subject ? subject : 'Pesan baru'}</strong><div>
            <button disabled={composeBusy} title={minimized ? 'Pulihkan pesan' : 'Minimalkan pesan'} aria-label={minimized ? 'Pulihkan pesan' : 'Minimalkan pesan'} onClick={() => setMinimized(!minimized)}><Icon name={minimized ? 'Maximize' : 'Minus'}/></button>
            {!minimized && <button disabled={composeBusy} title={expanded ? 'Pulihkan ukuran' : 'Perbesar pesan'} aria-label={expanded ? 'Pulihkan ukuran' : 'Perbesar pesan'} onClick={() => setExpanded(!expanded)}><Icon name={expanded ? 'Minimize' : 'Maximize'}/></button>}
            <button disabled={composeBusy} title="Tutup penulis pesan" aria-label="Tutup penulis pesan" onClick={closeCompose}><Icon name="X"/></button>
          </div></header>
          <div className="au-compose-content" hidden={minimized} inert={minimized || !compose} onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) {
        event.preventDefault();
        if (!composeBusy) {
            dragDepth.current++;
            setDragging(true);
        }
    } }} onDragLeave={event => { if (event.dataTransfer.types.includes('Files')) {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current)
            setDragging(false);
    } }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = composeBusy ? 'none' : 'copy'; }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); addFiles(event.dataTransfer.files); }}>
            <fieldset disabled={composeBusy} className="au-compose-fields">
              {compose && <SenderSelector accounts={accounts} value={composeFrom} onChange={setComposeFrom} disabled={composeBusy || !!composeSource || minimized}/>}
              <div className="au-compose-to-row"><label>Kepada<input name="to" autoComplete="off" value={to} aria-invalid={!!composeErrors.to} aria-describedby={composeErrors.to ? 'compose-to-error' : undefined} onChange={event => { setTo(event.target.value); setComposeErrors(errors => ({ ...errors, to: '' })); }} placeholder="nama@contoh.com"/></label><div className="au-compose-optional"><button aria-expanded={showCc} aria-controls="compose-cc-row" onClick={() => setShowCc(!showCc)}>CC</button><button aria-expanded={showBcc} aria-controls="compose-bcc-row" onClick={() => setShowBcc(!showBcc)}>BCC</button></div></div>
              {composeErrors.to && <small id="compose-to-error" className="au-compose-error">{composeErrors.to}</small>}
              <div id="compose-cc-row" hidden={!showCc}><label>CC<input value={cc} aria-invalid={!!composeErrors.cc} aria-describedby={composeErrors.cc ? 'compose-cc-error' : undefined} onChange={event => { setCc(event.target.value); setComposeErrors(errors => ({ ...errors, cc: '' })); }} placeholder="alamat dipisahkan koma"/></label>{composeErrors.cc && <small id="compose-cc-error" className="au-compose-error">{composeErrors.cc}</small>}</div>
              <div id="compose-bcc-row" hidden={!showBcc}><label>BCC<input value={bcc} aria-invalid={!!composeErrors.bcc} aria-describedby={composeErrors.bcc ? 'compose-bcc-error' : undefined} onChange={event => { setBcc(event.target.value); setComposeErrors(errors => ({ ...errors, bcc: '' })); }} placeholder="alamat dipisahkan koma"/></label>{composeErrors.bcc && <small id="compose-bcc-error" className="au-compose-error">{composeErrors.bcc}</small>}</div>
              <label>Subjek<input value={subject} aria-invalid={!!composeErrors.subject} aria-describedby={composeErrors.subject ? 'compose-subject-error' : undefined} onChange={event => { setSubject(event.target.value); setComposeErrors(errors => ({ ...errors, subject: '' })); }} placeholder="Tambahkan subjek"/></label>{composeErrors.subject && <small id="compose-subject-error" className="au-compose-error">{composeErrors.subject}</small>}
            </fieldset>
            <textarea disabled={composeBusy} aria-label="Isi pesan" aria-invalid={!!composeErrors.body} aria-describedby={composeErrors.body ? 'compose-body-error' : undefined} className="au-compose-body" value={body} onChange={event => { setBody(event.target.value); setComposeErrors(errors => ({ ...errors, body: '' })); }} placeholder="Tulis pesan…"/>
            {composeErrors.body && <small id="compose-body-error" className="au-compose-error">{composeErrors.body}</small>}
            {compose && <details className="au-compose-ai" key={composeSession.current}><summary>Bantu tulis</summary>
              <p>Tujuan API: {destination(appSettings?.ai.endpoint || 'https://api.anthropic.com/v1/messages')}. Hanya instruksi ini dikirim; inbox, penerima, dan lampiran tidak disertakan. {appSettings?.ai.protocol === 'anthropic' ? 'Fallback model aktif saat penolakan. ' : ''}Periksa hasil sebelum mengirim.</p>
              <label>Instruksi AI<textarea value={aiInstruction} maxLength={8192} disabled={composeBusy || aiBusy} onChange={e => setAiInstruction(e.target.value)}/></label>
              <label><input type="checkbox" checked={aiConsent} disabled={composeBusy || aiBusy} onChange={e => setAiConsent(e.target.checked)}/>Saya setuju instruksi dikirim ke penyedia yang dikonfigurasi dan dikenai biaya API.</label>
              <button className="au-btn au-btn-secondary" disabled={composeBusy || aiBusy || sendUncertain || !aiConsent || !aiInstruction.trim() || !appSettings?.ai.enabled || !appSettings.ai.key_configured} onClick={() => void generateAi()}>Buat teks</button>
              {!appSettings?.ai.enabled || !appSettings.ai.key_configured ? <p>Aktifkan AI dan isi API key di Pengaturan · AI & Penulisan.</p> : null}
              {aiBusy && <p role="status">Membuat teks…</p>}{aiError && <p role="alert">{aiError}</p>}
              {aiResult && <div className="au-ai-result"><strong>{aiResult.subject}</strong><pre>{aiResult.body}</pre><button className="au-btn au-btn-secondary" disabled={composeBusy || aiBusy || sendUncertain} onClick={() => { if ((subject || body) && !confirm('Ganti subjek dan isi pesan dengan hasil AI?'))
            return; setSubject(aiResult.subject); setBody(aiResult.body); setComposeErrors({}); }}>Gunakan hasil</button></div>}
            </details>}
            <div className={`au-compose-attachments${dragging ? ' is-dragging' : ''}`}>
              {compose && <ComposeAttachments key={composeSession.current} files={composeFiles} retained={retainedFiles} disabled={composeBusy} removeFile={file => { if (!composeBusy)
        setComposeFiles(files => files.filter(item => item !== file)); }} removeRetained={part => { if (!composeBusy)
        setRetainedFiles(files => files.filter(item => item.part !== part)); }}/>}
              <small>{dragging ? 'Lepaskan file untuk melampirkan' : composeFiles.length + retainedFiles.length ? `${composeFiles.length + retainedFiles.length} file · ${fileSize([...composeFiles, ...retainedFiles].reduce((size, file) => size + file.size, 0))} dari 25 MB` : 'Seret file ke sini, atau pilih Lampirkan file'}</small><small>Maksimal 100 file · 25 MB. File tanpa pratinjau tetap dapat dikirim.</small>
            </div>
          </div>
          <div className="au-compose-bottom-area" hidden={minimized} inert={minimized || !compose}>
            <p className="au-compose-feedback" role="status">{composeBusy ? composeOperation === 'send' ? 'Mengirim pesan…' : 'Menyimpan draf…' : sendUncertain ? 'Status belum pasti. Periksa folder Terkirim sebelum mencoba lagi.' : accounts.find(a => a.id === composeFrom)?.gmail_modify !== true ? 'Izin Gmail belum terverifikasi. Salin teks sebelum menutup.' : 'Teks biasa · Draf disimpan hanya saat Anda memilih Simpan draf'}</p>
            <footer className="au-compose-actions">
              <button className="au-btn au-btn-primary" disabled={composeBusy || aiBusy || sendUncertain || accounts.find(a => a.id === composeFrom)?.gmail_modify !== true} title={sendUncertain ? 'Periksa folder Terkirim sebelum membuat pesan baru' : 'Kirim melalui Gmail'} onClick={() => void submitCompose('send')}><Icon name="Send" size={16}/>Kirim</button>
              <input ref={fileInput} hidden disabled={composeBusy} aria-label="Lampirkan file" type="file" multiple onChange={event => { if (event.target.files)
        addFiles(event.target.files); event.target.value = ''; }}/>
              <button className="au-btn au-compose-attach" disabled={composeBusy} onClick={() => fileInput.current?.click()}><Icon name="Paperclip" size={17}/><span>Lampirkan file</span></button>
              <button className="au-btn au-compose-draft" disabled={composeBusy || aiBusy || accounts.find(a => a.id === composeFrom)?.gmail_modify !== true} onClick={() => void submitCompose('draft')}><Icon name="FilePenLine" size={16}/><span>Simpan draf</span></button>
            </footer>
          </div>
        </section>;
}
