import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { browserLibraries } from './browser-libraries.mjs';

// Enable a dedicated test harness only in the generated vault, never in the user's own vault.
const root = '.smoke/Writeller-Testvault/.obsidian';
await mkdir(`${root}/plugins/writeller-smoke`, { recursive: true });
await build({ entryPoints: ['tests/desktop/harness.ts'], bundle: true, external: ['obsidian'], platform: 'browser', format: 'cjs', target: 'es2022',
  outfile: `${root}/plugins/writeller-smoke/main.js`, plugins: [browserLibraries] });
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
await writeFile(`${root}/plugins/writeller-smoke/manifest.json`, JSON.stringify({ id: 'writeller-smoke', name: 'Writeller API Smoke', version: manifest.version, minAppVersion: manifest.minAppVersion, author: 'Local test harness', description: 'Nur synthetische Desktop-API-Tests.', isDesktopOnly: false }));
await writeFile(`${root}/community-plugins.json`, JSON.stringify(['writeller', 'writeller-smoke']));
console.log('Desktop-API-Smoke vorbereitet; Testprofil für tatsächliche Ausführung neu starten.');
