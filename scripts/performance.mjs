import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { unzipSync } from 'fflate';
import { browserLibraries } from './browser-libraries.mjs';
import { generateValidators } from './generate-validators.mjs';

/** Produces a bounded synthetic benchmark, keeping Node instrumentation out of the plugin. */
await generateValidators(); await mkdir('test-results/performance', { recursive: true });
const label = process.argv[2] ?? 'current';
if (!/^[a-z-]+$/.test(label)) throw new Error('Ungültige Benchmark-Bezeichnung');
let root = resolve('.');
if (process.argv[3]) {
  const ref = process.argv[3]; if (!/^[A-Za-z0-9][\w./-]*$/.test(ref)) throw new Error('Ungültige Git-Revision');
  const revision = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Ungültige Commit-ID');
  root = resolve(`test-results/performance/baseline-${revision}`); await mkdir(root, { recursive: true });
  // Extract only this public plugin's source; never copy node_modules or personal vaults.
  const archive = unzipSync(execFileSync('git', ['archive', '--format=zip', ref, 'src', 'tests/helpers', 'package.json'], { maxBuffer: 8 * 1024 ** 2 }));
  for (const [name, bytes] of Object.entries(archive)) {
    const target = resolve(root, name); if (!target.startsWith(root + '/') && !target.startsWith(root + '\\')) throw new Error('Archivpfad außerhalb des Testverzeichnisses');
    if (name.endsWith('/')) await mkdir(target, { recursive: true }); else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes); }
  }
  for (const name of ['tests/performance/ui-scenario.ts', 'tests/helpers/measured-vault.ts', '.generated/validators.mjs']) {
    const target = resolve(root, name); await mkdir(dirname(target), { recursive: true }); await writeFile(target, await readFile(name));
  }
}
const output = resolve(`test-results/performance/${label}.mjs`);
await build({ absWorkingDir: root, entryPoints: ['tests/performance/ui-scenario.ts'], outfile: output, bundle: true,
  platform: 'browser', external: ['happy-dom'], format: 'esm', target: 'es2022', alias: { obsidian: resolve(root, 'tests/helpers/obsidian-ui.ts') }, plugins: [browserLibraries] });
const { scenario } = await import(`../test-results/performance/${label}.mjs?` + Date.now());
const report = await scenario(Number(process.env.PERF_NOTES ?? 1000), Number(process.env.PERF_HISTORY ?? 16));
await writeFile(`test-results/performance/${label}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
