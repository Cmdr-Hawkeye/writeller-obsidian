import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { readExchange } from '../../src/exchange/codec';
import { planLanguage, relocate } from '../../src/projects/language-plan';
import { LanguageJournalService } from '../../src/storage/language-journal';
import { loadLanguageJournal } from '../../src/storage/language-journal-format';
import { pendingJournals } from '../../src/storage/recovery-index';
import { entries, recordKey } from '../../src/domain/records';
import { recordHash } from '../../src/exchange/hash';
import { setLanguage, type Language } from '../../src/i18n/language';
import { text, utf8 } from '../../src/storage/vault-port';
import { ObsidianVault } from '../../src/obsidian/vault';
import { TFolder } from '../helpers/obsidian-ui';

/** Keeps each integration independent of a preceding UI-language selection. */
beforeEach(() => setLanguage('de'));
/** Never leaks a locale into unrelated test files. */
afterEach(() => setLanguage('de'));
/** Imports independent contract data through the real coordinator into an isolated vault. */
async function setup() {
  const vault = new FakeVault(), settings = { ...defaultSettings, language: 'de' as const, folderLanguage: 'de' as const };
  const service = new TransferCoordinator(vault, settings), pkg = await readExchange(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url)));
  await service.commit(await service.resolve(await service.previewImport(pkg, 'new')));
  const base = (await service.snapshot(pkg.project.id)).state.manifestPath.split('/').slice(0, -1).join('/');
  return { vault, service, pkg, base };
}
/** Records domain hashes independently of representation and local file paths. */
async function hashes(service: TransferCoordinator, projectId: string) {
  return Promise.all(entries((await service.snapshot(projectId)).exchange).sort((a, b) => recordKey(a.collection, a.record.id).localeCompare(recordKey(b.collection, b.record.id))).map(async entry => [recordKey(entry.collection, entry.record.id), await recordHash(entry.record)]));
}
/** Commits a concrete folder plan and updates preferences only through its final persistence callback. */
async function change(service: TransferCoordinator, locale: Language) {
  const plan = await planLanguage(service, locale);
  await new LanguageJournalService(service.vault).commit(plan, { ...service.settings }, async () => { Object.assign(service.settings, plan.settings, { language: locale }); setLanguage(locale); });
  return plan;
}
describe('recoverable bilingual project structure', () => {
  it('uses native FileManager folder renames and rejects an existing empty target before calling the host', async () => {
    const source = new TFolder('Schreibprojekte'), target = new TFolder('Writing Projects'), renameFile = vi.fn(async () => {});
    let occupied = false;
    const app = { vault: { getAllFolders: () => occupied ? [source, target] : [source], getAbstractFileByPath: (path: string) => path === source.path ? source : occupied && path === target.path ? target : null }, fileManager: { renameFile } } as unknown as App;
    const adapter = new ObsidianVault(app); await adapter.moveFolder('Schreibprojekte', 'Writing Projects'); expect(renameFile).toHaveBeenCalledWith(source, 'Writing Projects');
    occupied = true; renameFile.mockClear(); await expect(adapter.moveFolder('Schreibprojekte', 'Writing Projects')).rejects.toThrow('LOCAL_CHANGED'); expect(renameFile).not.toHaveBeenCalled();
  });
  it('changes German folders to English and back without changing any Markdown basename or domain hash', async () => {
    const { vault, service, pkg } = await setup(), before = await hashes(service, pkg.project.id);
    const paths = vault.files().filter(file => file.markdown).map(file => file.path).sort();
    const plan = await change(service, 'en');
    for (const path of paths) {
      expect(relocate(path, plan.moves).split('/').at(-1)).toBe(path.split('/').at(-1)); expect(vault.data.has(relocate(path, plan.moves))).toBe(true);
    }
    expect(service.settings.projectFolder).toBe('Writing Projects'); expect(service.settings.exchangeFolder).toBe('Exports');
    expect(vault.files().some(file => file.path.includes('/Characters/'))).toBe(true);
    expect(await hashes(service, pkg.project.id)).toEqual(before);
    await change(service, 'de'); expect(await hashes(service, pkg.project.id)).toEqual(before);
    expect(vault.files().filter(file => file.markdown).map(file => file.path).sort()).toEqual(paths);
  });
  it('moves ordinary notes, binary files and empty structural folders while preserving custom subfolder names', async () => {
    const { vault, service, base } = await setup(), source = `${base}/Figuren/Eigene Ordnung/Meine Figur.md`, body = utf8('---\r\nmeine: Notiz\r\n---\r\nMein Text\r\n');
    vault.data.set(source, body); vault.data.set(`${base}/Figuren/Portrait.bin`, new Uint8Array([0, 255, 9])); vault.emptyFolders.add(`${base}/Ereignisse`);
    const plan = await change(service, 'en'); expect(vault.data.get(relocate(source, plan.moves))).toEqual(body);
    expect(vault.data.get(relocate(`${base}/Figuren/Portrait.bin`, plan.moves))).toEqual(new Uint8Array([0, 255, 9]));
    expect(vault.folders()).toContain(relocate(`${base}/Ereignisse`, plan.moves)); expect(relocate(source, plan.moves)).toContain('/Characters/Eigene Ordnung/Meine Figur.md');
  });
  it('keeps independently configured roots and existing title-derived chapter directories', async () => {
    const { vault, service, pkg, base } = await setup();
    await vault.moveFolder('Schreibprojekte', 'Meine Bücher'); service.settings.projectFolder = 'Meine Bücher'; service.settings.exchangeFolder = 'Downloads';
    const chapters = (await service.snapshot(pkg.project.id)).state.records.filter(record => record.collection === 'chapters').map(record => record.notePath.split('/').at(-2));
    await change(service, 'en'); expect(service.settings.projectFolder).toBe('Meine Bücher'); expect(service.settings.exchangeFolder).toBe('Downloads');
    expect((await service.snapshot(pkg.project.id)).state.records.filter(record => record.collection === 'chapters').map(record => record.notePath.split('/').at(-2))).toEqual(chapters);
    expect(vault.folders().some(path => path.startsWith(base))).toBe(false);
  });
  it('blocks an occupied target even when the target folder is empty, without staging or changing data', async () => {
    const { vault, service, base } = await setup(); vault.emptyFolders.add(`${base}/Characters`);
    const before = [...vault.data]; await expect(planLanguage(service, 'en')).rejects.toThrow('Zielordner'); expect([...vault.data]).toEqual(before);
  });
  it('rejects new ordinary files added after preview before the first mutation', async () => {
    const { vault, service, base } = await setup(), plan = await planLanguage(service, 'en');
    vault.data.set(`${base}/Figuren/Nachher.md`, utf8('Neuer Text')); const before = [...vault.data];
    await expect(new LanguageJournalService(vault).commit(plan, service.settings, async () => {})).rejects.toThrow('Vorschau'); expect([...vault.data]).toEqual(before);
  });
  it('rolls back a native folder error and preserves the original notes and settings', async () => {
    const { vault, service, pkg } = await setup(), before = await hashes(service, pkg.project.id), move = vault.moveFolder.bind(vault); let count = 0;
    vault.moveFolder = async (from, to) => { if (++count === 2) throw new Error('injected folder error'); await move(from, to); };
    await expect(change(service, 'en')).rejects.toThrow('injected folder error'); expect(await pendingJournals(vault)).toEqual([]);
    expect(await hashes(service, pkg.project.id)).toEqual(before); expect(service.settings.projectFolder).toBe('Schreibprojekte');
  });
  it('recovers a completed rename with a missing completion marker through the ordinary recovery route', async () => {
    const { vault, service, pkg } = await setup(), before = await hashes(service, pkg.project.id); await change(service, 'en');
    const path = vault.files().find(file => file.path.includes('/language-changes/') && file.path.endsWith('/journal.json'))!.path;
    const journal = JSON.parse(text(vault.data.get(path)!)); journal.status = 'prepared'; vault.data.set(path, utf8(JSON.stringify(journal)));
    expect((await pendingJournals(vault)).map(item => item.projectId)).toEqual(['language']); await expect(service.snapshot(pkg.project.id)).rejects.toThrow('LOCAL_CHANGED');
    const result = await service.journal.recover(path, 'language'); expect(result.conflicts).toEqual([]); Object.assign(service.settings, result.settings); setLanguage('de');
    expect(service.settings.projectFolder).toBe('Schreibprojekte'); expect(await hashes(service, pkg.project.id)).toEqual(before);
    expect((await service.journal.recover(path, 'language')).conflicts).toEqual([]);
  });
  it('retains foreign post-edits and backups, blocking new project operations until recovery is resolved', async () => {
    const { vault, service, pkg } = await setup(); await change(service, 'en');
    const path = vault.files().find(file => file.path.includes('/language-changes/') && file.path.endsWith('/journal.json'))!.path;
    const journal = JSON.parse(text(vault.data.get(path)!)); journal.status = 'prepared'; vault.data.set(path, utf8(JSON.stringify(journal)));
    const edited = vault.files().find(file => file.markdown && file.path.includes('/Characters/'))!.path; vault.data.set(edited, utf8('Fremde Nachbearbeitung'));
    const result = await service.journal.recover(path, 'language'); expect(result.conflicts.length).toBeGreaterThan(0); expect(text(vault.data.get(edited)!)).toBe('Fremde Nachbearbeitung');
    expect(vault.files().some(file => file.path.includes('/language-changes/') && file.path.endsWith('-original.bin'))).toBe(true);
    await expect(service.snapshot(pkg.project.id)).rejects.toThrow('LOCAL_CHANGED');
  });
  it('rejects tampered folder roles before recovery can touch a target', async () => {
    const { vault, service } = await setup(); await change(service, 'en');
    const path = vault.files().find(file => file.path.includes('/language-changes/') && file.path.endsWith('/journal.json'))!.path;
    const journal = JSON.parse(text(vault.data.get(path)!)); journal.moves[0].to += '/Andere Dateien'; journal.status = 'prepared'; vault.data.set(path, utf8(JSON.stringify(journal)));
    const before = [...vault.data]; await expect(loadLanguageJournal(vault, path)).rejects.toThrow('STATE_MISSING'); expect([...vault.data]).toEqual(before);
  });
});
