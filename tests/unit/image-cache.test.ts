import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Attachment } from '../../src/domain/types';
import { decode } from 'fast-png';
import { assertImages } from '../../src/exchange/images';

vi.mock('fast-png', async importOriginal => {
  const actual = await importOriginal<typeof import('fast-png')>(); return { ...actual, decode: vi.fn(actual.decode) };
});
describe('content-addressed image validation reuse', () => {
  it('reuses only a fully verified image with matching metadata and rejects changed bytes or dimensions', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url), 'utf8')) as { attachments: Attachment[] };
    const image = pkg.attachments.find(image => image.mimeType === 'image/png')!;
    await assertImages([image]); expect(decode).toHaveBeenCalledOnce();
    await assertImages([structuredClone(image)]); await assertImages([image]); expect(decode).toHaveBeenCalledOnce();
    const bytes = atob(image.data), changed = { ...image, data: btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1)) };
    await expect(assertImages([changed])).rejects.toThrow('INVALID_ASSET'); expect(decode).toHaveBeenCalledOnce();
    await expect(assertImages([{ ...image, width: image.width + 1 }])).rejects.toThrow('INVALID_ASSET');
    await expect(assertImages([{ ...image, mimeType: 'image/jpeg' }])).rejects.toThrow('INVALID_ASSET');
  });
});
