import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';

// This script prepares local files only. Publishing requires a separate manual workflow.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const versions = JSON.parse(await readFile('versions.json', 'utf8'));
if (pkg.version !== manifest.version || versions[manifest.version] !== manifest.minAppVersion || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Versionsdateien stimmen nicht überein');
const sourceLicense = await readFile('LICENSE', 'utf8');
const copyright = process.env.RELEASE_COPYRIGHT_HOLDER || sourceLicense.match(/^Copyright \(c\) \d{4} (.+)$/m)?.[1]?.trim() || '[RELEASE_COPYRIGHT_HOLDER]';
manifest.author = process.env.RELEASE_AUTHOR || manifest.author;
manifest.authorUrl = process.env.RELEASE_AUTHOR_URL || manifest.authorUrl;
const open = [];
if (!manifest.authorUrl) open.push('Herausgeber-URL fehlt');
if (copyright.startsWith('[')) open.push('Tatsächlicher Copyrightinhaber fehlt');
if (process.argv.includes('--publish-ready') && open.length) throw new Error(open.join('; '));
const root = `release/${pkg.version}`;
await mkdir(root, { recursive: true });
await mkdir(`${root}/docs`, { recursive: true });
const content = new Map();
for (const name of ['main.js', 'styles.css', 'README.md', 'README.en.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'THIRD-PARTY-NOTICES.md']) content.set(name, new Uint8Array(await readFile(name)));
content.set('manifest.json', strToU8(JSON.stringify(manifest, null, 2) + '\n'));
content.set('LICENSE', strToU8(sourceLicense.replace(/^Copyright \(c\) (\d{4}) .+$/m, (_line, year) => `Copyright (c) ${year} ${copyright}`)));
for (const name of ['WRITELLER-EXCHANGE-SPEC.md', 'architecture.md', 'data-layout.md', 'compatibility.md', 'testing.md', 'release-checklist.md', 'verification-report.md', 'handbuch.md', 'faq.md', 'languages.md',
  'assets/header.svg', 'assets/schreibuebersicht.png', 'assets/schreibuebersicht-en.png', 'assets/figur-formular.png', 'assets/schmale-ansicht.png', 'assets/notiz-uebernehmen.png', 'assets/README.md']) content.set(`docs/${name}`, new Uint8Array(await readFile(`docs/${name}`)));
content.set('dependency-licenses.json', new Uint8Array(await readFile('docs/dependency-licenses.json')));
content.set('release-status.json', strToU8(JSON.stringify({ version: pkg.version, published: false, openPublisherFields: open,
  independentContract: 'Writeller Exchange 1.0.0', desktopApiTest: `offen - keine native ${pkg.version} Abnahme`, mobileDeviceTest: 'offen',
  writellerEndToEnd: 'implementiert und getestet; durch Benni bestaetigt (27.10.2026)' }, null, 2)));
const archive = {};
for (const [name, data] of [...content].sort(([a], [b]) => a.localeCompare(b))) {
  const parent = name.slice(0, name.lastIndexOf('/'));
  if (name.includes('/')) await mkdir(`${root}/${parent}`, { recursive: true });
  await writeFile(`${root}/${name}`, data);
  archive[`writeller/${name}`] = [data, { mtime: new Date(1980, 0, 1, 0, 0, 0), os: 0 }];
}
const zipName = `writeller-${pkg.version}.zip`, zip = zipSync(archive, { level: 9 });
await writeFile(`${root}/${zipName}`, zip); content.set(zipName, zip);
const sums = [...content].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => `${createHash('sha256').update(data).digest('hex')}  ${name}`).join('\n') + '\n';
await writeFile(`${root}/SHA256SUMS.txt`, sums);
console.log(`Release-Artefakte vorbereitet: ${root}; offene Herausgeberwerte: ${open.length}. Nichts veröffentlicht.`);
