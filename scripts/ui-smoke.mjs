import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browserLibraries } from './browser-libraries.mjs';

// Renders actual production UI modules in a controlled host; no personal vault or native settings.
const root = resolve('test-results/ui'); await mkdir(root, { recursive: true });
await build({ entryPoints: ['tests/ui/preview.ts'], outfile: `${root}/preview.js`, bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  alias: { obsidian: resolve('tests/helpers/obsidian-ui.ts') }, plugins: [browserLibraries] });
await copyFile('styles.css', `${root}/styles.css`); await copyFile('tests/ui/preview-shell.css', `${root}/host.css`);
await writeFile(`${root}/index.html`, '<!doctype html><html lang="de"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Writeller – UI-Testvorschau</title><link rel="stylesheet" href="host.css"><link rel="stylesheet" href="styles.css"><body><script type="module" src="preview.js"></script></body></html>');
const candidates = [process.env.UI_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let executablePath;
for (const path of candidates) { try { await access(path); executablePath = path; break; } catch { /* Try the next already installed browser. */ } }
if (!executablePath) throw new Error('Vorhandenen Chromium-Browser über UI_BROWSER angeben. Es wird kein Browser installiert.');
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [], requests = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  // A local static server avoids file-origin module restrictions and serves generated fixture files only.
  const { createServer } = await import('node:http'); const { readFile } = await import('node:fs/promises');
  const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!['index.html', 'preview.js', 'styles.css', 'host.css'].includes(name)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    response.end(await readFile(`${root}/${name}`));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Previewserver konnte nicht gestartet werden');
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`); await page.waitForSelector('html[data-preview-ready="true"]');
    const text = await page.locator('body').innerText();
    if (/Writeller-Daten|Writeller Austausch|Exporte|records|journal|[a-f0-9]{32,}|[a-f0-9]{8}-[a-f0-9]{4}-/i.test(text)) throw new Error('Technische Daten in der normalen Schreibansicht sichtbar');
    checks.push('Desktopübersicht mit lesbaren Namen und ausgeblendetem technischen Ordner');
    if (await page.locator('.nav-folder-title[data-path="Writeller Austausch"]').isVisible() || await page.locator('.nav-folder-title[data-path="Exporte"]').isVisible()) throw new Error('JSON-Exportordner ist noch sichtbar');
    checks.push('Alte und aktuelle Exportordner mit vorhandenen JSON-Dateien sind im Schreibbereich ausgeblendet');
    await page.screenshot({ path: `${root}/desktop.png`, fullPage: true });
    await page.evaluate(() => globalThis.document.dispatchEvent(new globalThis.Event('writeller-test-native-note')));
    await page.waitForSelector('html[data-native-note-ready="true"]');
    await page.getByRole('region', { name: 'Noch nicht zugeordnete Notizen' }).getByText('Bernd das Brot', { exact: true }).waitFor();
    await page.screenshot({ path: `${root}/native-note.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth)) throw new Error('Übernahmehinweis läuft auf schmalem Fenster horizontal über');
    await page.screenshot({ path: `${root}/native-note-narrow.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    checks.push('Gewöhnliche Markdown-Datei ohne Writeller-Metadaten wird in der Schreibübersicht erkannt');
    await page.getByRole('button', { name: 'Als Figur übernehmen', exact: true }).click();
    if (await page.getByLabel('Name', { exact: true }).inputValue() !== 'Bernd das Brot') throw new Error('Dateiname wurde nicht als Figurenname vorgeschlagen');
    await page.locator('.modal').getByRole('button', { name: 'Figur übernehmen', exact: true }).click();
    await page.getByRole('region', { name: 'Noch nicht zugeordnete Notizen' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await page.waitForSelector('html[data-native-note-exported="true"]');
    checks.push('Gewöhnliche Notiz bewusst als Figur übernommen und mit vollständigem Text über die Produktionsoberfläche exportiert');
    const figure = page.getByRole('button', { name: 'Figur hinzufügen', exact: true });
    await figure.hover(); await page.mouse.down();
    await page.evaluate(() => globalThis.document.dispatchEvent(new globalThis.Event('writeller-test-refresh')));
    await page.waitForSelector('html[data-refresh-finished="true"]'); await page.mouse.up();
    await page.locator('.modal [aria-label="Name"]').waitFor();
    checks.push('Ein Klick öffnet das Formular auch bei Refresh zwischen Drücken und Loslassen');
    await page.getByLabel('Name', { exact: true }).fill('Mara'); await page.getByLabel('Rolle in der Geschichte', { exact: true }).fill('Hafenmeisterin');
    await page.locator('.modal').getByRole('button', { name: 'Figur hinzufügen', exact: true }).click();
    await page.waitForFunction(() => [...globalThis.document.querySelectorAll('.writeller-note-title')].some(e => e.textContent === 'Mara'));
    checks.push('Figur über das tatsächliche Produktionsformular angelegt und als lesbare Notiz angezeigt');
    await page.getByRole('button', { name: 'Kapitel hinzufügen', exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Der Aufbruch');
    await page.locator('.modal').getByRole('button', { name: 'Kapitel hinzufügen', exact: true }).click();
    await page.waitForFunction(() => globalThis.document.querySelector('.writeller-manuscript')?.textContent.includes('Der Aufbruch'));
    checks.push('Kapitel ohne technischen Zwischendialog angelegt');
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${root}/mobile.png`, fullPage: true });
    if (await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth)) throw new Error('Horizontaler Überlauf auf schmalem Fenster');
    checks.push('390-Pixel-Ansicht ohne horizontalen Überlauf');
    await page.getByRole('button', { name: 'Figur hinzufügen', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Neue Figur'); await page.screenshot({ path: `${root}/mobile-form.png`, fullPage: true });
    await page.locator('.modal').getByRole('button', { name: 'Abbrechen', exact: true }).click();
    checks.push('Schmales Formular erreichbar und ohne Datensatzanlage abbrechbar');
    const properties = await page.evaluate(() => {
      const doc = globalThis.document, host = doc.createElement('div'); host.className = 'writeller-writing-note';
      const container = doc.createElement('div'); container.className = 'metadata-container'; host.append(container);
      const technical = doc.createElement('div'); technical.className = 'metadata-property'; technical.dataset.propertyKey = 'writeller-id'; technical.textContent = 'Technische Kennung';
      const own = doc.createElement('div'); own.className = 'metadata-property'; own.dataset.propertyKey = 'mein-kommentar'; own.textContent = 'Eigene Eigenschaft';
      container.append(technical, own); doc.body.append(host);
      const hidden = globalThis.getComputedStyle(technical).display === 'none', preserved = globalThis.getComputedStyle(own).display !== 'none';
      host.classList.remove('writeller-writing-note'); const restored = globalThis.getComputedStyle(technical).display !== 'none'; host.remove();
      return hidden && preserved && restored;
    });
    if (!properties) throw new Error('Technische/benutzereigene Properties nicht korrekt getrennt');
    checks.push('Technische Properties ausblendbar; eigene Eigenschaften bleiben sichtbar und wiederherstellbar');
  } finally { await new Promise(resolve => server.close(resolve)); }
  if (errors.length) throw new Error(errors.join('\n'));
  const external = requests.filter(url => !url.startsWith('http://127.0.0.1:'));
  if (external.length) throw new Error('Externer Request in der UI-Testumgebung');
  await writeFile(`${root}/report.json`, JSON.stringify({ passed: true, host: 'Browser + expliziter Obsidian-API-Fake', nativeObsidian: false, externalRequests: 0, checks }, null, 2));
  console.log(`${checks.length} UI-Smokechecks bestanden; Desktop-/schmale Vorschauen in test-results/ui/. Kein nativer Geräteabnahmetest.`);
} finally { await browser.close(); }
