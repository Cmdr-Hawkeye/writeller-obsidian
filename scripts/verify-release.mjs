import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';

// Only inspect our own generated archive; the plugin itself has no archive reader.
const { version } = JSON.parse(await readFile('manifest.json', 'utf8'));
const root = `release/${version}`, name = `writeller-${version}.zip`;
const archive = await readFile(`${root}/${name}`), files = unzipSync(archive);
for (const name of ['main.js', 'manifest.json', 'styles.css', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  const data = files[`writeller/${name}`];
  if (!data || !data.length) throw new Error(`Release-Datei fehlt: ${name}`);
  if (!Buffer.from(data).equals(await readFile(`${root}/${name}`))) throw new Error(`ZIP-Datei weicht ab: ${name}`);
}
for (const line of (await readFile(`${root}/SHA256SUMS.txt`, 'utf8')).trim().split('\n')) {
  const [hash, name] = line.split('  ');
  if (createHash('sha256').update(await readFile(`${root}/${name}`)).digest('hex') !== hash) throw new Error(`Release-Prüfsumme falsch: ${name}`);
}
execFileSync(process.execPath, ['scripts/release.mjs'], { stdio: 'inherit' });
if (!archive.equals(await readFile(`${root}/writeller-${version}.zip`))) throw new Error('ZIP ist nicht reproduzierbar');
console.log('ZIP-Inhalt, alle SHA-256-Summen und wiederholte ZIP-Erzeugung geprüft.');
