import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readExchange } from '../../src/exchange/codec';
import { recordHash, jcs, sha256, now } from '../../src/exchange/hash';
import { entries } from '../../src/domain/records';
import { parseJson } from '../../src/exchange/parser';
import { isInstant } from '../../src/exchange/schema';
import { markdownInfo } from '../../src/mapping/markdown';
import expected from '../fixtures/expected-results.json';

describe('unabhängige Handoff-Fixtures', () => {
  for (const [name, result] of Object.entries(expected.files)) {
    it(name, async () => {
      const bytes = readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
      if (!result.valid) {
        await expect(readExchange(bytes)).rejects.toMatchObject({ diagnostics: expect.arrayContaining([expect.objectContaining(result.expectedError!)]) });
        return;
      }
      const pkg = await readExchange(bytes);
      expect(await sha256(jcs(pkg))).toBe(result.packageHash);
      for (const { collection, record } of entries(pkg)) {
        const hashes = result.records[collection] as Record<string, string>;
        expect(await recordHash(record)).toBe(hashes[record.id]);
      }
    });
  }
});
describe('RFC 8785 und Eingabegrenzen', () => {
  it('RFC-Zahlen, negative Null und UTF-16-Sortierung', () => {
    expect(jcs({ numbers: [Number('333333333.33333329'), 1e30, 4.50, 2e-3, 1e-27, -0] }))
      .toBe('{"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27,0]}');
    expect(jcs({ '\u20ac': 1, '\r': 2, '\ufb33': 3, '1': 4, '😀': 5, '\u0080': 6, 'ö': 7 }))
      .toBe('{"\\r":2,"1":4,"\u0080":6,"ö":7,"€":1,"😀":5,"דּ":3}');
  });
  it.each(['{"a":1,"a":2}', '{"\\u0061":1,"a":2}', '{"x":"\\ud800"}', '[1,]', '1e999', '9007199254740992', '\uFEFF\uFEFF{}'])('weist %s ab', input => {
    expect(() => parseJson(input)).toThrow();
  });
  it('behandelt Prototype-Keys als Daten', () => {
    const value = parseJson('{"__proto__":{"polluted":true}}');
    expect(jcs(value)).toBe('{"__proto__":{"polluted":true}}');
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });
  it('prüft UTF-8 und Tiefe', () => {
    expect(() => parseJson(new Uint8Array([0xc0, 0xaf]))).toThrow();
    expect(() => parseJson('['.repeat(65) + '0' + ']'.repeat(65))).toThrow();
    expect(() => parseJson('['.repeat(64) + '0' + ']'.repeat(64))).not.toThrow();
  });
  it.each(['2026-02-29T12:00:00.000000Z', '0000-01-01T00:00:00.000000Z', '2024-01-01T24:00:00.000000Z'])('prüft Kalender %s', value => expect(isInstant(value)).toBe(false));
  it('behält Mikrosekunden und erzeugt gültige Zeiten', () => {
    expect(isInstant('2024-02-29T12:00:00.123456Z')).toBe(true); expect(isInstant(now())).toBe(true);
  });
  it('unterscheidet echte Links von Code und behält CRLF-Ranges', () => {
    const text = '`[x](entity:scenes/no)`\r\n\r\n[x](entity:scenes/yes)\r\n\r\n```\r\n[x](entity:scenes/no)\r\n```';
    const links = markdownInfo(text).links;
    expect(links.map(l => l.url)).toEqual(['entity:scenes/yes']);
    expect(text.slice(links[0]!.start, links[0]!.end)).toBe('[x](entity:scenes/yes)');
  });
});
