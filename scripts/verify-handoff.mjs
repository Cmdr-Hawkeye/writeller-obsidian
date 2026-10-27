import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Verify only the public contract artifacts copied from the explicitly supplied archive.
const sums = await readFile('tests/fixtures/HANDOFF-SHA256SUMS.txt', 'utf8');
let count = 0;
for (const line of sums.trim().split(/\r?\n/)) {
  const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line);
  if (!match) throw new Error('Ungültige Handoff-Prüfsummenliste');
  const [, expected, name] = match;
  const path = name === 'WRITELLER-EXCHANGE-SPEC.md' ? `docs/${name}` : name === 'writeller-exchange.schema.json' ? `src/exchange/${name}` : /^fixtures\/[a-z-]+(?:\.writeller-exchange)?\.json$/.test(name) ? `tests/${name}` : null;
  if (!path) continue;
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual !== expected) throw new Error(`Handoff-Datei wurde verändert: ${path}`);
  count++;
}
if (count !== 9) throw new Error(`Erwartet: 9 unveränderte Prüfartefakte, erhalten: ${count}`);
console.log('9 öffentliche Handoff-Artefakte byteidentisch.');
