import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Recursively inventories production sources; fixtures and generated schemas are exempt. */
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
/** Enforces module line budgets and rejects runtime Node imports/network APIs. */
export async function verifySources() {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  if (!(await readFile('src/domain/version.ts', 'utf8')).includes(`export const pluginVersion = '${manifest.version}';`)) throw new Error('Plugin-/Manifestversion stimmen nicht überein');
  for (const path of (await files('src')).filter(p => p.endsWith('.ts') || p.endsWith('.mjs'))) {
    const source = await readFile(path, 'utf8');
    const max = path === 'src/main.ts' ? 150 : 300;
    if (source.split('\n').length > max) throw new Error(`${path}: mehr als ${max} Zeilen`);
    if (/(?:from\s*|import\s*\(|require\s*\()\s*['"](?:node:|fs['"/]|path['"/]|os['"/]|crypto['"/]|electron|child_process)/.test(source)) throw new Error(`${path}: Node-Laufzeitimport`);
    if (/\b(?:fetch|XMLHttpRequest|WebSocket|requestUrl)\s*\(|\.innerHTML\s*=/.test(source)) throw new Error(`${path}: verbotene Netzwerk-/HTML-API`);
    if (path.startsWith('src/domain/') || path.startsWith('src/exchange/')) {
      if (/from\s*['"]obsidian/.test(source)) throw new Error(`${path}: Obsidian in Austauschdomäne`);
    }
  }
}
/** esbuild platform=browser resolves all transitive imports; only Obsidian may stay external. */
export async function verifyBundle(meta) {
  for (const output of Object.values(meta.outputs)) for (const imp of output.imports) {
    if (imp.external && imp.path !== 'obsidian') throw new Error(`Unerwartetes Runtime-External: ${imp.path}`);
  }
  const source = await readFile('main.js', 'utf8');
  if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) throw new Error('Bundle contains dynamic code execution');
  if (/\b(?:fetch|requestUrl)\s*\(|new (?:XMLHttpRequest|WebSocket)\s*\(|\bBuffer\.(?:from|alloc)\(|\.innerHTML\s*=/.test(source)) throw new Error('Bundle contains network, raw HTML or Node Buffer code');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await verifySources();
