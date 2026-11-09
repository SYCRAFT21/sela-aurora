// Only these raster containers reach the browser decoder; active SVG/HTML never do.
export function rasterPixels(bytes: Uint8Array, mime: string, maxPixels = 40_000_000): number {
  if (bytes.length > 20_000_000) throw new Error('Gambar melebihi 20 MB');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number, size: number) => String.fromCharCode(...bytes.subarray(at, at + size));
  let width = 0, height = 0;
  if (mime === 'image/png' && bytes.length >= 24 && text(0,8) === '\x89PNG\r\n\x1a\n' && text(12,4) === 'IHDR') {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (mime === 'image/gif' && bytes.length >= 10 && /^GIF8[79]a$/.test(text(0,6))) {
    width = view.getUint16(6,true); height = view.getUint16(8,true);
  } else if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) break;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && size >= 7) {
        height = view.getUint16(offset+3); width = view.getUint16(offset+5); break;
      }
      offset += size;
    }
  } else if (mime === 'image/webp' && bytes.length >= 30 && text(0,4) === 'RIFF' && text(8,4) === 'WEBP') {
    const format = text(12,4);
    if (format === 'VP8X') {
      width = 1 + bytes[24] + (bytes[25]<<8) + (bytes[26]<<16);
      height = 1 + bytes[27] + (bytes[28]<<8) + (bytes[29]<<16);
    } else if (format === 'VP8 ' && text(23,3) === '\x9d\x01\x2a') {
      width = view.getUint16(26,true) & 16383; height = view.getUint16(28,true) & 16383;
    } else if (format === 'VP8L' && bytes[20] === 47) {
      const packed = view.getUint32(21,true); width = (packed & 16383)+1; height = ((packed>>>14)&16383)+1;
    }
  }
  if (!width || !height || width * height > maxPixels || width > 32768 || height > 32768) throw new Error('Format atau dimensi gambar tidak aman untuk pratinjau');
  return width * height;
}
export function rasterBlob(bytes: Uint8Array, mime: string, maxPixels = 40_000_000): Blob {
  rasterPixels(bytes, mime, maxPixels);
  return new Blob([bytes.slice()], { type: mime });
}
export const rasterMime = (mime: string) => /^image\/(png|jpeg|gif|webp)$/.test(mime);
