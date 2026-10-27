import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readExchange, validateExchange } from '../../src/exchange/codec';
import type { Exchange, JsonObject } from '../../src/domain/types';
import { entries } from '../../src/domain/records';
import { decodeBase64, assertImages, createAttachment } from '../../src/exchange/images';
import { crc32 } from '../../src/exchange/png';
import { encode } from 'fast-png';
import jpeg from 'jpeg-js';
import { parseManaged, splitNote } from '../../src/mapping/frontmatter';
import { safePath, collisionKey } from '../../src/storage/paths';
import { manuscriptOrder } from '../../src/domain/order';

const original: Exchange = JSON.parse(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url), 'utf8'));
/** Mutates synthetic JSON without touching source fixtures or a vault. */
const copy = () => structuredClone(original);

describe('vollständige Schemafelder', () => {
  for (const entry of entries(original)) for (const key of Object.keys(entry.record)) {
    it(`Pflichtfeld ${entry.collection}/${entry.record.id}/${key}`, async () => {
      const pkg = copy(), e = entries(pkg).find(e => e.collection === entry.collection && e.record.id === entry.record.id)!;
      Reflect.deleteProperty(e.record, key);
      await expect(validateExchange(pkg)).rejects.toThrow('INVALID_FIELD');
    });
  }
  it('erhält tiefes unbekanntes JSON, Typen, Status und Mikrosekunden', async () => {
    const pkg = copy(); pkg.project.updatedAt = '2026-10-26T09:00:00.123456Z'; pkg.project.status = 'eigenerStatus';
    pkg.catalogItems[0]!.fields = JSON.parse('{"__proto__":{"sicher":true},"mixed":[1,false,null,{"x":"😀\\r\\n"}]}') as JsonObject;
    expect((await validateExchange(pkg)).catalogItems[0]!.fields).toEqual(pkg.catalogItems[0]!.fields);
    expect((await validateExchange(pkg)).project.updatedAt).toBe('2026-10-26T09:00:00.123456Z');
  });
  it('weist unbekannte Kernfelder und unbekannte Versionen zurück', async () => {
    const pkg = copy(); Object.defineProperty(pkg.scenes[0], 'unbekannt', { value: 1, enumerable: true });
    await expect(validateExchange(pkg)).rejects.toThrow('INVALID_FIELD');
    await expect(readExchange(JSON.stringify({ ...original, version: '1.1.0' }))).rejects.toThrow('UNSUPPORTED_VERSION');
    await expect(readExchange('{"format":"writeller.project.v5"}')).rejects.toThrow('Dieses Projektarchiv benötigt');
  });
});
describe('semantische Mutationen', () => {
  const cases: [string, string, (p: Exchange) => void][] = [
    ['scope', 'PROJECT_MISMATCH', p => { p.scope.projectId = 'fremd'; }],
    ['attachment owner', 'PROJECT_MISMATCH', p => { p.attachments[0]!.projectId = 'fremd'; }],
    ['duplicate', 'DUPLICATE_ID', p => { p.scenes.push(structuredClone(p.scenes[0]!)); }],
    ['self cycle', 'HIERARCHY_CYCLE', p => { p.scenes[0]!.parentSceneId = p.scenes[0]!.id; }],
    ['cycle', 'HIERARCHY_CYCLE', p => { p.scenes[0]!.parentSceneId = p.scenes[1]!.id; }],
    ['POV', 'INVALID_FIELD', p => { p.scenes[0]!.povCharacterId = p.catalogItems[1]!.id; }],
    ['chapter mismatch', 'INVALID_FIELD', p => { p.scenes[1]!.chapterId = null; }],
    ['relation target', 'INVALID_FIELD', p => { p.relationships[0]!.target = { collection: 'relationships', id: p.relationships[1]!.id }; }],
    ['note target', 'MISSING_REFERENCE', p => { p.notes[0]!.target = { collection: 'scenes', id: 'fehlt' }; }],
    ['time', 'INVALID_FIELD', p => { p.project.updatedAt = '2026-10-25T00:00:00.000000Z'; }],
    ['calendar', 'INVALID_FIELD', p => { p.project.updatedAt = '2026-02-30T00:00:00.000000Z'; }],
    ['title', 'INVALID_FIELD', p => { p.project.title = ' \t'; }],
    ['entity', 'MISSING_REFERENCE', p => { p.scenes[0]!.content.text += '\n[x](entity:scenes/fehlt)'; }],
    ['asset layout', 'INVALID_ASSET', p => { p.scenes[0]!.content.text = `![x](asset:${p.attachments[0]!.id}?align=center&width=70)`; }],
    ['asset paragraph', 'INVALID_ASSET', p => { p.scenes[0]!.content.text = `Text ![x](asset:${p.attachments[0]!.id}?width=70&align=center)`; }]
  ];
  it.each(cases)('%s → %s', async (_name, code, mutate) => { const pkg = copy(); mutate(pkg); await expect(validateExchange(pkg)).rejects.toThrow(code); });
  it('sortiert Eltern vor Kindern und kapitellose Szenen zuletzt', () => {
    const pkg = copy(); pkg.scenes.reverse();
    expect(manuscriptOrder(pkg).map(s => s.id)).toEqual(['scene-ankunft', 'scene-nachhall', 'scene-entscheidung']);
  });
});
describe('Bildkonformität ohne Browserbild-Request', () => {
  it('PNG und JPEG werden vollständig geprüft', async () => {
    const png = encode({ width: 2, height: 1, data: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]), channels: 4, depth: 8 });
    const jpg = jpeg.encode({ width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]) }).data;
    expect((await createAttachment(png, 'p')).width).toBe(2);
    expect((await createAttachment(jpg, 'p')).mimeType).toBe('image/jpeg');
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it.each(['AA', 'A===', 'AA= ', 'AB==', 'AAB=', 'data:image/png;base64,AAAA'])('Base64 %s', value => expect(() => decodeBase64(value)).toThrow('INVALID_ASSET'));
  it('prüft Hash, Header, Pixelmaße und Dekodierbarkeit', async () => {
    const asset = structuredClone(original.attachments[0]!);
    await expect(assertImages([{ ...asset, id: '0'.repeat(64) }])).rejects.toThrow('INVALID_ASSET');
    await expect(assertImages([{ ...asset, width: asset.width + 1 }])).rejects.toThrow('INVALID_ASSET');
    await expect(createAttachment(new Uint8Array([137, 80, 78, 71]), 'p')).rejects.toThrow('INVALID_ASSET');
  });
});
describe('Metadaten und portable Pfade', () => {
  it('liest normale Obsidian-YAML-Properties und exakten CRLF-Körper', () => {
    const source = '---\r\nwriteller-schema: 1\r\nwriteller-project-id: p\r\nwriteller-id: s\r\nwriteller-collection: scenes\r\nwriteller-title: Ankunft\r\n---\r\n😀\r\n\r\nText\r\n';
    expect(parseManaged('Verschoben.md', source)?.body).toBe('😀\r\n\r\nText\r\n');
    expect(() => splitNote('---\nx: 1\nx: 2\n---\n')).toThrow();
  });
  it.each(['../a', '/a', 'C:/a', 'a\\..\\b', '\\\\server\\x', 'a/CON.txt', 'a/LPT1', 'a/../b', 'a/.obsidian/x', 'a/b.', 'a/b ', 'a\u0000b', 'Cafe\u0301/x'])('weist %s ab', value => expect(() => safePath(value)).toThrow());
  it('normalisiert Kollisionen, keine Identitäten', () => expect(collisionKey('A/É.md')).toBe(collisionKey('a/E\u0301.md')));
});
