import { createElement, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import './EmailBody.css';
import { rasterPixels } from './raster';

export type InlineImage = { src: string; bytes: number; pixels: number };

export type ReadMode = 'Adaptive' | 'Original' | 'Plain Text';
const safeStyles = new Set(['color', 'background', 'background-color', 'border', 'border-color', 'border-style', 'border-width', 'border-radius', 'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'text-align', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'width', 'max-width', 'height', 'vertical-align', 'display']);
const cleanStyle = (style: string) => style.split(';').map(part => {
  const colon = part.indexOf(':');
  if (colon < 0) return '';
  const name = part.slice(0, colon).trim().toLowerCase();
  const value = part.slice(colon + 1).trim();
  return safeStyles.has(name) && !/url\s*\(|@import|expression\s*\(|[{}<>\\]/i.test(value) ? `${name}:${value}` : '';
}).filter(Boolean).join(';');

function prepare(html: string, allowRemote: boolean, cid: Record<string,InlineImage>) {
  // Parse in template content so neither parsing nor sanitizing can load email resources.
  const template = document.createElement('template');
  template.innerHTML = html;
  const trusted = new Map(Object.values(cid).map(image => [image.src, image]));
  for (const image of Array.from(template.content.querySelectorAll('img'))) {
    const source = image.getAttribute('src') || '';
    if (/^cid:/i.test(source) && cid[source.slice(4)]) image.setAttribute('src', cid[source.slice(4)].src);
    else if (/^blob:/i.test(source)) image.removeAttribute('src');
  }
  let remainingBytes = 20_000_000, remainingPixels = 40_000_000;
  const validated = new Map<string, { bytes: number; pixels: number }>();
  const clean = DOMPurify.sanitize(template.content, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'img', 'a', 'hr', 'center', 'sub', 'sup'],
    ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'width', 'height', 'align'],
    ALLOW_DATA_ATTR: false,
    ADD_URI_SAFE_ATTR: ['src'], // Every surviving img src is checked against HTTPS/data/trusted CID below.
  });
  let hasRemote = false;
  for (const element of Array.from(clean.querySelectorAll('*'))) {
    if (element.hasAttribute('style')) {
      const style = cleanStyle(element.getAttribute('style') || '');
      if (style) element.setAttribute('style', style); else element.removeAttribute('style');
    }
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') || '';
      if (!/^https:\/\//i.test(href) && !/^mailto:/i.test(href)) element.removeAttribute('href');
      else { element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer'); }
    }
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') || '';
      if (/^https:\/\//i.test(src)) {
        hasRemote = true;
        if (!allowRemote) element.removeAttribute('src');
      } else {
        try {
          let image = trusted.get(src) || validated.get(src);
          if (!image) {
            const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]*={0,2})$/i.exec(src);
            if (!match || match[2].length > Math.ceil(remainingBytes / 3) * 4) throw new Error('Batas gambar');
            const binary = atob(match[2]);
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            image = { bytes: bytes.length, pixels: rasterPixels(bytes, match[1].toLowerCase()) };
            validated.set(src, image);
          }
          // Charge every rendered occurrence, including repeated CID references.
          if (image.bytes > remainingBytes || image.pixels > remainingPixels) throw new Error('Batas gambar');
          remainingBytes -= image.bytes; remainingPixels -= image.pixels;
        } catch { element.removeAttribute('src'); }
      }
    }
  }
  template.content.replaceChildren(clean);
  return {
    markup: template.innerHTML,
    text: template.content.textContent || '',
    nodes: Array.from(template.content.childNodes, renderNode),
    hasRemote,
  };
}

// ponytail: React receives text and a small tag/attribute allowlist, never executable email HTML; Original stays sandboxed.
function renderNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof HTMLElement)) return null;
  const tag = node.tagName.toLowerCase();
  const props: Record<string, string | number> = { key };
  if (tag === 'img') {
    const src = node.getAttribute('src');
    if (!src) return null;
    props.src = src;
    props.alt = node.getAttribute('alt') || 'Gambar email';
    props.referrerPolicy = 'no-referrer';
    // ponytail: only pixel dimensions for images; other email inline CSS stays disabled in Adaptive.
    const style = node.getAttribute('style') || '';
    const width = /(?:^|;)\s*width\s*:\s*(\d+)px(?:\s*;|$)/i.exec(style)?.[1] || node.getAttribute('width');
    const height = /(?:^|;)\s*height\s*:\s*(\d+)px(?:\s*;|$)/i.exec(style)?.[1] || node.getAttribute('height');
    if (width && /^\d+$/.test(width)) props.width = Math.min(Number(width), 2000);
    if (height && /^\d+$/.test(height)) props.height = Math.min(Number(height), 2000);
  }
  if (tag === 'a') {
    const href = node.getAttribute('href');
    if (href) { props.href = href; props.target = '_blank'; props.rel = 'noopener noreferrer'; }
  }
  if (tag === 'td' || tag === 'th') {
    const colspan = Number(node.getAttribute('colspan'));
    const rowspan = Number(node.getAttribute('rowspan'));
    if (colspan > 1 && colspan <= 20) props.colSpan = colspan;
    if (rowspan > 1 && rowspan <= 20) props.rowSpan = rowspan;
  }
  // ponytail: retain only numeric spacing and alignment; colors/backgrounds remain controlled by the app theme.
  const style: CSSProperties = {};
  const inline = node.getAttribute('style') || '';
  const align = /(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)(?:\s*;|$)/i.exec(inline)?.[1] || node.getAttribute('align');
  if (align && /^(left|right|center|justify)$/i.test(align)) style.textAlign = align.toLowerCase() as CSSProperties['textAlign'];
  const padding = /(?:^|;)\s*padding\s*:\s*(\d+(?:\.\d+)?)px(?:\s*;|$)/i.exec(inline)?.[1];
  if (padding) style.padding = `${Math.min(Number(padding), 40)}px`;
  return createElement(tag, { ...props, style }, ...Array.from(node.childNodes, renderNode));
}

const noCid: Record<string,InlineImage> = {};
export function EmailBody({ html, body, mode, cid = noCid }: { html?: string; body: string; mode: ReadMode; cid?: Record<string,InlineImage> }) {
  const [allowRemote, setAllowRemote] = useState(false);
  const prepared = useMemo(() => html ? prepare(html, allowRemote, cid) : null, [html, allowRemote, cid]);
  const text = body || prepared?.text || '(Email kosong)';
  return <div className="au-email-viewer">{mode !== 'Plain Text' && prepared?.hasRemote && !allowRemote && <div className="au-email-remote"><span>Gambar eksternal diblokir untuk melindungi privasi.</span> <button type="button" className="au-btn au-btn-secondary" onClick={() => setAllowRemote(true)}>Muat gambar eksternal</button></div>}{mode === 'Original' && prepared
    ? <iframe title="Isi HTML email terisolasi" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:${Object.keys(cid).length ? ' blob:' : ''}${allowRemote ? ' https:' : ''}; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'; connect-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;max-width:100%;overflow-wrap:anywhere;background:#fff;color:#182131;font:15px/1.65 system-ui,sans-serif}body{padding:20px}*,*:before,*:after{box-sizing:border-box}table,img{max-width:100%!important}img{height:auto!important}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#7653b5}</style>${prepared.markup}`} />
    : mode === 'Adaptive' && prepared ? <div className="au-email-adaptive">{prepared.nodes}</div>
      : <div className="au-email-plain">{text}</div>}
  </div>;
}
