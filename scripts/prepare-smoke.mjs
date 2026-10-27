import { mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

// Isolated generated fixtures only. This never reads or changes a personal vault.
const root = resolve('.smoke'), vault = join(root, 'Writeller-Testvault'), profile = join(root, 'profile');
const plugin = join(vault, '.obsidian', 'plugins', 'writeller');
await mkdir(plugin, { recursive: true }); await mkdir(profile, { recursive: true });
for (const name of ['main.js', 'manifest.json', 'styles.css']) await copyFile(name, join(plugin, name));
await writeFile(join(vault, '.obsidian', 'community-plugins.json'), JSON.stringify(['writeller']));
await writeFile(join(vault, '.obsidian', 'app.json'), JSON.stringify({ alwaysUpdateLinks: true }));
await mkdir(join(vault, 'Writeller-Austausch'), { recursive: true });
for (const name of ['minimal', 'harbor', 'forest', 'harbor-edited']) await copyFile(`tests/fixtures/${name}.writeller-exchange.json`, join(vault, 'Writeller-Austausch', `${name}.writeller-exchange.json`));
await writeFile(join(vault, 'Testnotiz.md'), '---\neigene-property: bleibt erhalten\n---\nEigener lokaler Text.');
const id = createHash('sha256').update(vault).digest('hex').slice(0, 16);
await writeFile(join(profile, 'obsidian.json'), JSON.stringify({ vaults: { [id]: { path: vault, ts: Date.now(), open: true } }, updateDisabled: true }));
// Use an already installed app update; do not download or install a different application.
const appDir = join(process.env.APPDATA, 'obsidian');
for (const name of (await readdir(appDir)).filter(n => /^obsidian-1\.14\.5\.asar$/.test(n))) await copyFile(join(appDir, name), join(profile, name));
console.log('Isolierter synthetischer Smoke-Vault vorbereitet.');
