import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { assertSchema } from '../../src/exchange/schema';
import type { Exchange } from '../../src/domain/types';
import { decodeBase64 } from '../../src/exchange/images';

it('prüft große gültige Base64-Strings ohne Regexp-Stacküberlauf', () => {
  const pkg: Exchange = JSON.parse(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url), 'utf8'));
  const data = 'AAAA'.repeat(600000); pkg.attachments[0]!.data = data;
  expect(() => assertSchema(pkg)).not.toThrow();
  expect(decodeBase64(data)).toHaveLength(1800000);
});
