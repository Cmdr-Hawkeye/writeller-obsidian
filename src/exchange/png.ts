import { Inflate } from 'pako';

/** CRC-32/ISO-HDLC for PNG chunk integrity, independently tested with the standard vector. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Checks CRC and bounds inflated pixels before full decoding; strips unused ancillary metadata. */
export function boundedPng(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), retained = [bytes.subarray(0, 8)];
  const expected = scanlineBudget(view);
  const inflator = new Inflate({ chunkSize: 16 * 1024 });
  let output = 0, idats = 0, finished = false, inflated = false;
  inflator.onData = chunk => {
    output += chunk.byteLength;
    if (output > expected || output > 64 * 1024 ** 2) throw new Error('PNG inflation budget exceeded');
  };
  inflator.onEnd = status => { inflator.err = status; inflated = status === 0; };
  for (let pos = 8; pos + 12 <= bytes.length;) {
    const length = view.getUint32(pos), type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8)), end = pos + length + 12;
    if (end > bytes.length || crc32(bytes.subarray(pos + 4, end - 4)) !== view.getUint32(end - 4)) throw new Error('PNG CRC/framing');
    if (!['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type) && /^[A-Z]/.test(type)) throw new Error('Unknown critical PNG chunk');
    if (['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS'].includes(type)) retained.push(bytes.subarray(pos, end));
    if (type === 'IDAT') { idats++; inflator.push(bytes.subarray(pos + 8, end - 4)); if (inflator.err) throw new Error('PNG inflate'); }
    if (type === 'IEND') { finished = true; break; }
    pos = end;
  }
  if (!idats || !finished || !inflated || inflator.err || output !== expected) throw new Error('Incomplete PNG');
  const result = new Uint8Array(retained.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of retained) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
/** Exact decompressed PNG scanline size, including Adam7 pass filter bytes. */
function scanlineBudget(view: DataView): number {
  const width = view.getUint32(16), height = view.getUint32(20), depth = view.getUint8(24), color = view.getUint8(25);
  const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(color);
  if (!channels || ![1, 2, 4, 8, 16].includes(depth) || color === 3 && depth === 16 || color !== 0 && color !== 3 && depth < 8) throw new Error('PNG color/depth');
  if (view.getUint8(28) === 0) return (Math.ceil(width * channels * depth / 8) + 1) * height;
  if (view.getUint8(28) !== 1) throw new Error('PNG interlace');
  let size = 0;
  for (const [x, y, dx, dy] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] as const) {
    const w = Math.max(0, Math.ceil((width - x) / dx)), h = Math.max(0, Math.ceil((height - y) / dy));
    if (w && h) size += (Math.ceil(w * channels * depth / 8) + 1) * h;
  }
  return size;
}
