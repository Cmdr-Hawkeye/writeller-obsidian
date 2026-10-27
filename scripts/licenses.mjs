import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';

/** Generates runtime transitive dependency licences from the exact lockfile and installed packages. */
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const report = [], notices = ['# Drittanbieter-Lizenzen', '', 'Automatisch aus package-lock.json und den installierten Paketen erzeugt. Nur Laufzeitabhängigkeiten.', ''];
for (const [path, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!path || entry.dev || entry.devOptional || !path.includes('node_modules/')) continue;
  const pkg = JSON.parse(await readFile(`${path}/package.json`, 'utf8'));
  const names = (await readdir(path)).filter(n => /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(n)).sort();
  report.push({ name: pkg.name, version: pkg.version, license: pkg.license ?? 'UNBEKANNT', licenseFiles: names });
  notices.push(`## ${pkg.name} ${pkg.version}`, '', `Lizenz: ${pkg.license ?? 'UNBEKANNT'}`, '');
  if (!names.length) throw new Error(`Fehlender Lizenztext: ${pkg.name}`);
  for (const name of names) notices.push('```text', (await readFile(`${path}/${name}`, 'utf8')).trim().replace(/[ \t]+$/gm, ''), '```', '');
}
await mkdir('docs', { recursive: true });
await writeFile('docs/dependency-licenses.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('THIRD-PARTY-NOTICES.md', notices.join('\n'));
console.log(`${report.length} Laufzeit-Pakete mit Lizenztext erfasst.`);
