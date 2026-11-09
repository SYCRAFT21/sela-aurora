import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { Icon } from './Icon';
import './attachments.css';
import { rasterBlob, rasterMime } from './raster';

GlobalWorkerOptions.workerSrc = '/assets/pdf/pdf.worker.min.mjs';
export type Attachment = { part: string; filename: string; mime_type: string; size: number; inline: boolean; content_id?: string; available: boolean };
export const attachmentUrl = (account: string, message: string, part: string) => `/api/message/${encodeURIComponent(account)}/attachment?${new URLSearchParams({ message_id: message, part })}`;
export async function attachmentBytes(url: string, signal: AbortSignal, limit = 25_000_000) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Lampiran tidak dapat dimuat (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Data lampiran tidak tersedia');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('Lampiran melebihi batas ukuran'); chunks.push(value); }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
const sizeLabel = (size: number) => size < 1000 ? `${size} B` : size < 1_000_000 ? `${(size / 1000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(1)} MB`;
function PdfCanvas({ bytes, page = 1, zoom = 1, thumbnail = false, onPages }: { bytes: Uint8Array; page?: number; zoom?: number; thumbnail?: boolean; onPages?: (pages: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; let render: { cancel: () => void } | undefined;
    setError('');
    const task = getDocument({ data: bytes.slice(), enableXfa: false, maxImageSize: 16_000_000, disableFontFace: true, useSystemFonts: true, useWorkerFetch: false, cMapUrl: '/assets/pdf/cmaps/', cMapPacked: true, standardFontDataUrl: '/assets/pdf/standard_fonts/', wasmUrl: '/assets/pdf/wasm/', canvasMaxAreaInBytes: 64_000_000 });
    task.onPassword = () => { setError('PDF terenkripsi; unduh untuk membuka.'); void task.destroy(); };
    void (async () => {
      const pdf = await task.promise; if (cancelled) return;
      onPages?.(pdf.numPages);
      const documentPage = await pdf.getPage(Math.min(page, pdf.numPages));
      const base = documentPage.getViewport({ scale: 1 });
      const target = thumbnail ? 240 : Math.min(window.innerWidth - 48, 1000) * zoom;
      const scale = Math.min(target / base.width, Math.sqrt(16_000_000 / (base.width * base.height)));
      const viewport = documentPage.getViewport({ scale });
      if (cancelled || !canvas.current) return;
      const element = canvas.current; delete element.dataset.rendered;
      element.width = Math.ceil(viewport.width); element.height = Math.ceil(viewport.height);
      const rendering = documentPage.render({ canvas: element, viewport }); render = rendering;
      await rendering.promise;
      if (!cancelled) element.dataset.rendered = 'true';
    })().catch(() => { if (!cancelled) setError('PDF tidak dapat dipratinjau; unduh file.'); });
    return () => { cancelled = true; render?.cancel(); void task.destroy(); };
  }, [bytes, page, zoom, thumbnail, onPages]);
  return error ? <p role="status">{error}</p> : <canvas ref={canvas} aria-label={thumbnail ? 'Thumbnail PDF' : `Halaman PDF ${page}`} />;
}
function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/octet-stream' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let thumbnailQueue: Promise<void> = Promise.resolve();
function Thumbnail({ file, url, enabled }: { file: Attachment; url: string; enabled: boolean }) {
  const [bytes, setBytes] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      thumbnailQueue = thumbnailQueue.then(async () => {
        if (controller.signal.aborted) return;
        try { const value = await attachmentBytes(url, controller.signal, 20_000_000); if (!controller.signal.aborted) setBytes(value); }
        catch { if (!controller.signal.aborted) setFailed(true); }
      });
    });
    if (enabled && root.current && (file.mime_type === 'application/pdf' || rasterMime(file.mime_type)) && file.available && file.size <= 20_000_000) observer.observe(root.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [file.mime_type, file.size, url, enabled]);
  return <div className="au-attachment-thumb" ref={root}>{bytes ? file.mime_type === 'application/pdf' ? <PdfCanvas bytes={bytes} thumbnail /> : <RasterImage bytes={bytes} file={file} thumbnail /> : <><Icon name="FilePenLine" size={24} /><span>{failed ? 'Thumbnail tidak tersedia' : file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}</span></>}</div>;
}
export function AttachmentGallery({ files, account, message, thumbnails = true }: { files: Attachment[]; account: string; message: string; thumbnails?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [bytes, setBytes] = useState<Uint8Array>();
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1); const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | undefined>(undefined);
  const file = selected === null ? undefined : files[selected];
  useEffect(() => { if (file) dialog.current?.showModal(); else dialog.current?.close(); }, [file]);
  useEffect(() => () => controller.current?.abort(), []);
  async function open(index: number) {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setSelected(index); setBytes(undefined); setError(''); setZoom(1); setPage(1); setPages(1);
    try { const data = await attachmentBytes(attachmentUrl(account, message, files[index].part), request.signal); if (!request.signal.aborted) setBytes(data); }
    catch (cause) { if (!request.signal.aborted) setError(String(cause)); }
  }
  function close() { controller.current?.abort(); setSelected(null); setBytes(undefined); }
  return <section className="au-attachments" role="region" aria-label="Lampiran email"><h3>{files.length} lampiran</h3><div className="au-attachment-grid">{files.map((item, index) => <article className="au-attachment-card" key={item.part}><button disabled={!item.available} aria-label={`Pratinjau ${item.filename}`} onClick={() => void open(index)}><Thumbnail enabled={thumbnails && index<10} file={item} url={attachmentUrl(account, message, item.part)} /><strong title={item.filename}>{item.filename}</strong><small>{sizeLabel(item.size)}{!item.available && ' · Tidak tersedia'}</small></button></article>)}</div>
    <dialog ref={dialog} className="au-attachment-dialog" aria-label={file?.filename || 'Pratinjau lampiran'} onCancel={close} onClose={close}>
      <header><strong>{file?.filename}</strong><button className="au-btn" aria-label="Tutup pratinjau" onClick={close}><Icon name="X" /></button></header>
      <div className="au-attachment-controls"><button className="au-btn" disabled={!selected} onClick={() => void open(selected! - 1)}>Sebelumnya</button><button className="au-btn" disabled={selected === null || selected >= files.length - 1} onClick={() => void open(selected! + 1)}>Berikutnya</button><button className="au-btn" aria-label="Perkecil" onClick={() => setZoom(z => Math.max(.25,z-.25))}>−</button><button className="au-btn" aria-label="Perbesar" onClick={() => setZoom(z => Math.min(4,z+.25))}>+</button><button className="au-btn" onClick={() => setZoom(1)}>Sesuaikan</button><button className="au-btn" disabled={!bytes} aria-label="Unduh file" onClick={() => bytes && file && download(bytes,file.filename)}>Unduh</button></div>
      <div className="au-attachment-preview">{error ? <p role="alert">{error}<button className="au-btn" onClick={() => selected !== null && void open(selected)}>Coba lagi</button></p> : !bytes ? <p role="status">Memuat lampiran…</p> : file?.mime_type === 'application/pdf' && bytes.length <= 20_000_000 ? <PdfCanvas bytes={bytes} page={page} zoom={zoom} onPages={setPages} /> : file && rasterMime(file.mime_type) ? <RasterImage bytes={bytes} file={file} zoom={zoom} /> : file && /^(text\/(plain|csv|markdown|json|xml)|application\/(json|xml))$/.test(file.mime_type) && bytes.length <= 1_000_000 ? <SafeText bytes={bytes} /> : <p>Pratinjau format ini belum tersedia. Unduh file untuk membukanya.</p>}</div>
      {file?.mime_type === 'application/pdf' && <footer><button className="au-btn" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Halaman sebelumnya</button><span>{page} / {pages}</span><button className="au-btn" disabled={page >= pages} onClick={() => setPage(p => p+1)}>Halaman berikutnya</button></footer>}
    </dialog>
  </section>;
}
function RasterImage({ bytes, file, zoom = 1, thumbnail = false }: { bytes: Uint8Array; file: Attachment; zoom?: number; thumbnail?: boolean }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let created = ''; setUrl(''); setError('');
    try { created = URL.createObjectURL(rasterBlob(bytes,file.mime_type)); setUrl(created); }
    catch { setError('Gambar tidak dapat dipratinjau. Unduh file.'); }
    return () => { if (created) URL.revokeObjectURL(created); };
  }, [bytes, file.mime_type]);
  return error ? <p role="status">{error}</p> : url ? <img src={url} alt={thumbnail ? `Thumbnail ${file.filename}` : file.filename} style={thumbnail ? { width:'100%',height:'100%',objectFit:'contain' } : { width:`${zoom*100}%`,maxWidth:'none',objectFit:'contain' }} onError={() => setError('Gambar rusak; unduh file.')} /> : <span role="status">Memuat gambar…</span>;
}
function SafeText({ bytes }: { bytes: Uint8Array }) {
  try { return <pre>{new TextDecoder('utf-8',{fatal:true}).decode(bytes)}</pre>; } catch { return <p>File bukan teks UTF-8 yang valid. Unduh file.</p>; }
}
