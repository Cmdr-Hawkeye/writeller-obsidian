import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import { utf8 } from '../../src/storage/vault-port';
import { parseJson, limits } from '../../src/exchange/parser';
import { readExchange } from '../../src/exchange/codec';
import type * as BrowserApi from '../browser/entry';

describe('Browserbundle ohne Node, Obsidian oder Netzwerk', () => {
  it('validiert alle Fixtures und PNG/JPEG, externe Embeds erzeugen keinen Request', async () => {
    execFileSync(process.execPath, ['scripts/browser-test-bundle.mjs']);
    const source = readFileSync('test-results/browser-contract.cjs', 'utf8');
    let requests = 0;
    const block = (): never => { requests++; throw new Error('network forbidden'); };
    const module = { exports: {} };
    const context = { module, exports: module.exports, crypto: globalThis.crypto, TextEncoder, TextDecoder,
      Uint8Array, Uint16Array, Uint32Array, Int32Array, ArrayBuffer, DataView, atob, btoa, structuredClone,
      fetch: block, XMLHttpRequest: block, WebSocket: block, requestUrl: block };
    runInNewContext(source, context, { timeout: 10000 });
    const api = module.exports as typeof BrowserApi;
    for (const name of ['readExchange', 'createAttachment', 'projectRecord']) expect(typeof Reflect.get(api, name)).toBe('function');
    const fixture = readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url), 'utf8');
    const pkg = await api.readExchange(fixture);
    expect(await api.recordHash(pkg.project)).toBe('8ab2535516e8c864cdf8cff429c5043f7899e65baba40649a3ca7c8921c1b5da');
    const image = jpeg.encode({ width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) }).data;
    expect((await api.createAttachment(image, pkg.project.id)).mimeType).toBe('image/jpeg');
    pkg.scenes[0]!.content.text = '![Extern](https://invalid.example/private.png)\n\n<iframe src="https://invalid.example"></iframe>';
    const result = api.projectRecord({ collection: 'scenes', record: pkg.scenes[0]! }, { entityPath: () => undefined, assetPath: () => undefined });
    expect(result.projection.protected).toBe(true); expect(result.projection.body.startsWith('```text')).toBe(true);
    expect(requests).toBe(0);
    expect(/new XMLHttpRequest|new WebSocket|\bBuffer\.(?:alloc|from)\(/.test(source)).toBe(false);
    // Buffer, process, require, fs and Electron were never supplied to this context.
  }, 20000);
  it('erzwingt Byte-, String- und Tiefenbudgets vor Feldabbildung', () => {
    expect(() => parseJson(new Uint8Array(limits.bytes + 1))).toThrow('LIMIT_EXCEEDED');
    expect(() => parseJson(JSON.stringify('a'.repeat(limits.string + 1)))).toThrow('LIMIT_EXCEEDED');
    expect(() => parseJson(JSON.stringify(Array(4).fill('a'.repeat(7 * 1024 ** 2))))).toThrow('LIMIT_EXCEEDED');
    expect(parseJson(utf8('\uFEFF{"unicode":"🌊\\r\\n"}'))).toMatchObject({ unicode: '🌊\r\n' });
  });
  it('ignoriert literale Tokens in Code und erkennt echte Zieländerungen', async () => {
    const pkg = await readExchange(readFileSync(new URL('../fixtures/minimal.writeller-exchange.json', import.meta.url), 'utf8'));
    pkg.scenes[0]!.content = { format: 'markdown', text: '``\n[Wörtlich](entity:scenes/fehlt)\n``\n\n[Echt](entity:scenes/scene-ankunft)\r\n' };
    await expect(readExchange(JSON.stringify(pkg))).resolves.toBeDefined();
  });
});
