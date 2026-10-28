import { tr } from '../i18n/translate';
import { decode as decodePng } from 'fast-png';
import decodeJpeg from 'jpeg-js/lib/decoder';
import { boundedPng } from './png';
import type { Attachment } from '../domain/types';
import { fail } from '../domain/diagnostics';
import { sha256 } from './hash';

// A verified content hash and exact image metadata identify immutable decoded bytes.
// Retain only bounded keys, not manuscripts, image buffers or mutable validation objects.
const decodedImages = new Map<string, true>();

/** Inspects an explicitly selected local image and returns a complete validated public attachment. */
export async function createAttachment(bytes: Uint8Array, projectId: string): Promise<Attachment> {
  if (bytes.length > 2 * 1024 ** 2) fail('LIMIT_EXCEEDED', tr('Bild überschreitet 2 MiB. Vor Aufnahme bewusst vorbereiten.'));
  let header: { width: number; height: number }, mimeType: Attachment['mimeType'];
  try {
    mimeType = bytes[0] === 137 ? 'image/png' : 'image/jpeg';
    header = mimeType === 'image/png' ? pngHeader(bytes) : jpegHeader(bytes);
  } catch { fail('INVALID_ASSET', tr('Nur vollständig dekodierbare PNG-/JPEG-Bilder aufnehmen.')); }
  const image: Attachment = { id: await sha256(bytes), projectId, mimeType, ...header, data: encodeBase64(bytes) };
  await assertImages([image]); return image;
}

/** Strict RFC 4648 decoder rejects whitespace, missing padding and nonzero pad bits. */
export function decodeBase64(value: string): Uint8Array {
  if (value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail('INVALID_ASSET', tr('Ungültige Base64-Bilddaten.'));
  let binary: string;
  try { binary = atob(value); } catch { fail('INVALID_ASSET', tr('Ungültiges Base64-Padding.')); }
  if (btoa(binary) !== value) fail('INVALID_ASSET', tr('Nicht kanonische Base64-Paddingbits.'));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
/** Encodes bytes without Buffer or large apply/spread argument lists. */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
/** Checks image byte budgets, hash and full decoding before callers can store or display it. */
export async function assertImages(attachments: Attachment[]): Promise<void> {
  let total = 0;
  for (const image of attachments) {
    if (image.data.length > Math.ceil(2 * 1024 ** 2 / 3) * 4) fail('LIMIT_EXCEEDED', tr('Bild überschreitet 2 MiB.'));
    const bytes = decodeBase64(image.data);
    total += bytes.length;
    if (bytes.length > 2 * 1024 ** 2 || total > 64 * 1024 ** 2 || attachments.length > 256) fail('LIMIT_EXCEEDED', tr('Bildbudget überschritten.'));
    if (await sha256(bytes) !== image.id) fail('INVALID_ASSET', tr('Bildhash stimmt nicht mit den Bytes überein.'));
    const key = `${image.id}/${image.mimeType}/${image.width}/${image.height}`;
    if (!decodedImages.has(key)) {
      assertImageBytes(bytes, image); decodedImages.set(key, true);
      if (decodedImages.size > 256) decodedImages.delete(decodedImages.keys().next().value!);
    }
  }
}
/** Validates bounded headers first and then fully decodes PNG/JPEG using browser libraries. */
export function assertImageBytes(bytes: Uint8Array, image: Pick<Attachment, 'mimeType' | 'width' | 'height'>): void {
  try {
    const dimensions = image.mimeType === 'image/png' ? pngHeader(bytes) : jpegHeader(bytes);
    if (dimensions.width !== image.width || dimensions.height !== image.height ||
      dimensions.width < 1 || dimensions.width > 2400 || dimensions.height < 1 || dimensions.height > 2400) throw new Error();
    const decoded = image.mimeType === 'image/png' ? decodePng(boundedPng(bytes), { checkCrc: true }) : decodeJpeg(bytes, {
      useTArray: true, tolerantDecoding: false, maxResolutionInMP: 5.76, maxMemoryUsageInMB: 128
    });
    if (decoded.width !== image.width || decoded.height !== image.height || !decoded.data.length) throw new Error();
    if ('palette' in decoded && decoded.palette && decoded.data.some(v => v >= decoded.palette!.length)) throw new Error();
  } catch { fail('INVALID_ASSET', tr('Bild ist beschädigt, animiert oder hat unzulässige Dimensionen.')); }
}
/** PNG chunk framing rejects animation and trailing/polyglot data; CRC is checked by decoder. */
function pngHeader(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 45 || [137, 80, 78, 71, 13, 10, 26, 10].some((b, i) => bytes[i] !== b)) throw new Error();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8, end = false;
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos), type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (pos === 8 && (type !== 'IHDR' || length !== 13)) throw new Error();
    if (pos !== 8 && type === 'IHDR') throw new Error();
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT' || pos + 12 + length > bytes.length) throw new Error();
    pos += 12 + length;
    if (type === 'IEND') { if (length || pos !== bytes.length) throw new Error(); end = true; break; }
  }
  if (!end) throw new Error();
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
/** Scans bounded JPEG segments before allocating pixel memory; rejects multiple frames. */
function jpegHeader(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error();
  let pos = 2, width = 0, height = 0, frames = 0;
  while (pos + 3 < bytes.length) {
    if (bytes[pos++] !== 255) throw new Error();
    while (bytes[pos] === 255) pos++;
    const marker = bytes[pos++];
    if (marker === 218) break;
    const length = (bytes[pos] ?? 0) * 256 + (bytes[pos + 1] ?? 0);
    if (length < 2 || pos + length > bytes.length) throw new Error();
    if (marker !== undefined && [192, 193, 194].includes(marker)) {
      frames++; height = (bytes[pos + 3] ?? 0) * 256 + (bytes[pos + 4] ?? 0);
      width = (bytes[pos + 5] ?? 0) * 256 + (bytes[pos + 6] ?? 0);
    }
    pos += length;
  }
  if (frames !== 1) throw new Error();
  return { width, height };
}
