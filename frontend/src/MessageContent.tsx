import { useEffect, useMemo, useState } from 'react';
import { AttachmentGallery, attachmentBytes, attachmentUrl, type Attachment } from './AttachmentGallery';
import { EmailBody, type ReadMode, type InlineImage } from './EmailBody';
import { rasterPixels, rasterMime } from './raster';

export function MessageContent({ html, body, mode, files, account, message }: { html?: string; body: string; mode: ReadMode; files: Attachment[]; account: string; message: string }) {
  const [cid, setCid] = useState<Record<string,InlineImage>>({});
  const [cidSettled, setCidSettled] = useState(false);
  const referenced = useMemo(() => {
    const template = document.createElement('template'); template.innerHTML = html || '';
    const ids = new Set(Array.from(template.content.querySelectorAll('img')).map(img => img.getAttribute('src') || '').filter(src => /^cid:/i.test(src)).map(src => src.slice(4)));
    return files.filter(file => file.inline && file.content_id && ids.has(file.content_id) && files.filter(other => other.content_id === file.content_id).length === 1 && rasterMime(file.mime_type) && file.available);
  }, [html,files]);
  useEffect(() => {
    setCid({}); setCidSettled(false); if (mode === 'Plain Text') return;
    const controller = new AbortController(); const urls: string[] = [];
    void (async () => {
      let remaining = 20_000_000, remainingPixels = 40_000_000;
      for (const file of referenced) {
        if (controller.signal.aborted) break;
        if (file.size > remaining) continue;
        try {
          const bytes = await attachmentBytes(attachmentUrl(account,message,file.part),controller.signal,remaining);
          remaining -= bytes.length;
          const pixels = rasterPixels(bytes,file.mime_type,remainingPixels);
          remainingPixels -= pixels;
          const blob = new Blob([bytes.slice()], {type:file.mime_type});
          if (controller.signal.aborted) break;
          const url = URL.createObjectURL(blob); urls.push(url);
          // Opaque sandbox origins cannot fetch parent blob URLs; only verified raster bytes become data URLs there.
          let source = url;
          if (mode==='Original') {
            let binary=''; for (let at=0;at<bytes.length;at+=8192) binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
            source=`data:${file.mime_type};base64,${btoa(binary)}`;
          }
          setCid(previous => ({...previous,[file.content_id!]:{src:source,bytes:bytes.length,pixels}}));
        } catch { /* Failed inline resources never prevent reading. */ }
      }
      if (!controller.signal.aborted) setCidSettled(true);
    })();
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [referenced,account,message,mode]);
  const gallery = files.filter(file => !file.content_id || !cid[file.content_id]);
  return <><div className="au-message-body"><EmailBody html={html} body={body} mode={mode} cid={cid} /></div>{gallery.length ? <AttachmentGallery files={gallery} account={account} message={message} thumbnails={mode!=='Plain Text' && cidSettled} /> : null}</>;
}
