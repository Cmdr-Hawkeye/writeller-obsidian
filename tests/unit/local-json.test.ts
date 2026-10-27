import { describe, expect, it } from 'vitest';
import { parseJson } from '../../src/exchange/parser';
import { parseLocalJson } from '../../src/storage/local-json';

describe('getrennte lokale Erhaltungsbudgets', () => {
  it('erlaubt zusätzliche Wrapper-Tiefe ohne den öffentlichen Vertrag zu lockern', () => {
    const source = '['.repeat(66) + '0' + ']'.repeat(66);
    expect(() => parseJson(source)).toThrow('LIMIT_EXCEEDED');
    expect(() => parseLocalJson(source)).not.toThrow();
    expect(() => parseLocalJson('['.repeat(73) + '0' + ']'.repeat(73))).toThrow('LIMIT_EXCEEDED');
  });
  it('erlaubt größere sichere Quelltextprojektionen für gültige Fremdtexte', () => {
    const source = JSON.stringify({ projection: { body: 'x'.repeat(9 * 1024 ** 2) } });
    expect(() => parseJson(source)).toThrow('LIMIT_EXCEEDED');
    expect(() => parseLocalJson(source)).not.toThrow();
  });
  it('zählt wiederholte Partnerrecords unter einem eigenen lokalen Gesamtbudget', () => {
    const source = JSON.stringify(Array(4).fill('x'.repeat(7 * 1024 ** 2)));
    expect(() => parseJson(source)).toThrow('LIMIT_EXCEEDED');
    expect(() => parseLocalJson(source)).not.toThrow();
  });
});
