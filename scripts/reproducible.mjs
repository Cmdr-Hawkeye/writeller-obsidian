import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

/** Rebuilds twice in the current lockfile environment and compares exact bundle bytes. */
const hash = async () => createHash('sha256').update(await readFile('main.js')).digest('hex');
execFileSync(process.execPath, ['esbuild.config.mjs'], { stdio: 'inherit' });
const first = await hash();
execFileSync(process.execPath, ['esbuild.config.mjs'], { stdio: 'inherit' });
if (first !== await hash()) throw new Error('Build ist nicht reproduzierbar');
console.log(`Reproduzierbarer main.js SHA-256: ${first}`);
