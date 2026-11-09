import { useEffect, useRef, useState } from 'react';
import { type Attachment } from './AttachmentGallery';
import { Icon } from './Icon';
import { rasterBlob, rasterMime } from './raster';

export const fileSize = (size: number) => size < 1000 ? `${size} B` : size < 1_000_000 ? `${(size / 1000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(1)} MB`;
let previewQueue = Promise.resolve();
const ids = new WeakMap<File, number>();
let nextId = 0;
function fileId(file: File) { if (!ids.has(file)) ids.set(file, ++nextId); return ids.get(file)!; }

function Card({name, mime, size, url, retained, disabled, remove}: {name:string;mime:string;size:number;url?:string;retained?:boolean;disabled:boolean;remove:()=>void}) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {if(disabled){clearTimeout(timer.current);setLeaving(false);}}, [disabled]);
  return <div className={`au-compose-file${leaving ? ' is-removing' : ''}`}>
    <div className={`au-compose-file-icon${mime === 'application/pdf' ? ' is-pdf' : ''}`}>{url ? <img src={url} alt={`Pratinjau ${name}`} /> : <Icon name="File" size={22} />}</div>
    <div className="au-compose-file-info"><strong title={name}>{name}</strong><small>{mime === 'application/pdf' ? 'PDF' : mime || 'application/octet-stream'} · {fileSize(size)}</small><small>{retained ? 'Dipertahankan dari Gmail' : 'Siap dilampirkan'}{!url && ' · Tanpa pratinjau'}</small></div>
    <button type="button" disabled={disabled || leaving} aria-label={`Hapus ${name}`} onClick={() => {setLeaving(true); timer.current=setTimeout(remove, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140);}}><Icon name="X" size={16} /></button>
  </div>;
}

export function ComposeAttachments({files, retained, disabled, removeFile, removeRetained}: {files:File[];retained:Attachment[];disabled:boolean;removeFile:(file:File)=>void;removeRetained:(part:string)=>void}) {
  const [urls, setUrls] = useState<Map<File,string>>(new Map());
  useEffect(() => {
    let cancelled=false;
    const owned: string[]=[];
    setUrls(new Map());
    // ponytail: four 5MB/4M-pixel previews bound input to20MB and decoded frames to16M pixels; increase only with a measured memory budget.
    for (const file of files.filter(file => rasterMime(file.type) && file.size <= 5_000_000).slice(0,4)) {
      previewQueue=previewQueue.then(async () => {
        if (cancelled) return;
        try {
          const bytes=new Uint8Array(await file.arrayBuffer());
          if (cancelled) return;
          const blob=rasterBlob(bytes,file.type,4_000_000);
          const url=URL.createObjectURL(blob); owned.push(url);
          setUrls(previous => new Map(previous).set(file,url));
        } catch { /* Unpreviewable files remain sendable attachments. */ }
      });
    }
    return () => {cancelled=true;owned.forEach(url=>URL.revokeObjectURL(url));};
  }, [files]);
  return <div className="au-compose-file-grid">{files.map(file => <Card key={fileId(file)} name={file.name} mime={file.type} size={file.size} url={urls.get(file)} disabled={disabled} remove={()=>removeFile(file)} />)}{retained.map(file => <Card key={`retained-${file.part}`} name={file.filename} mime={file.mime_type} size={file.size} retained disabled={disabled} remove={()=>removeRetained(file.part)} />)}</div>;
}
