import { Window } from 'happy-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { installDomHelpers, createUiApp, Notice, TFolder } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { cleanupLegacyExportFolders, upgradeExportFolder, exportFoldersToHide } from '../../src/projects/export-location';
import { createProject } from '../../src/objects/factory';
import { CommandContext } from '../../src/ui/command-context';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { ObsidianVault } from '../../src/obsidian/vault';
import { utf8 } from '../../src/storage/vault-port';

/** Supplies controlled DOM/API surfaces without opening a native Obsidian vault. */
beforeEach(() => {
  const window = new Window(); vi.stubGlobal('window', window); vi.stubGlobal('document', window.document);
  installDomHelpers(window as unknown as globalThis.Window); Notice.messages = [];
});
/** Restores globals after each isolated UI case. */
afterEach(() => { vi.unstubAllGlobals(); });
/** Creates one project through the actual journal-backed service for export-dialog tests. */
async function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = createProject('Mein Buch'); await service.commit(await service.previewSave(pkg, null));
  const { app } = createUiApp(vault), ctx = new CommandContext(app, service);
  return { vault, commands: new TransferCommands(ctx), id: pkg.project.id };
}
/** Chooses the explicit final preview action, preserving the real controller's commit path. */
async function decide(buttonText: string): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector('.modal')).not.toBeNull());
  const button = [...document.querySelectorAll<HTMLButtonElement>('.modal button')].find(b => b.textContent === buttonText);
  expect(button).toBeDefined(); button!.click();
}
describe('auffindbare Exporte und frühere leere Austauschordner', () => {
  it('zeigt nach erfolgreichem Export den tatsächlichen Pfad einschließlich Kollisionsnummer', async () => {
    const { vault, commands, id } = await setup();
    for (const name of ['Mein Buch', 'Mein Buch (2)']) {
      const task = commands.exportProject(id); await decide('Übernehmen'); await task;
      const path = `Exporte/${name}.writeller-exchange.json`;
      expect(vault.data.has(path)).toBe(true); expect(Notice.messages.at(-1)).toBe(`Export gespeichert im Vault:\n${path}`);
    }
    expect(vault.files().some(f => /Writeller-(?:Austausch|Exchange)\//.test(f.path))).toBe(false);
  });
  it('erzeugt bei abgebrochener Vorschau weder Export noch Erfolgsmeldung', async () => {
    const { vault, commands, id } = await setup(), files = vault.files().map(f => f.path);
    const task = commands.exportProject(id); await decide('Abbrechen'); await task;
    expect(vault.files().map(f => f.path)).toEqual(files); expect(Notice.messages).toEqual([]);
  });
  it('ersetzt frühere Standardnamen und erhält individuelle Exportordner', () => {
    for (const name of ['Writeller-Austausch', 'Writeller Austausch', 'Writeller-Exchange', 'Writeller Exchange']) {
      const settings = { ...defaultSettings, exchangeFolder: name }; expect(upgradeExportFolder(settings)).toBe(true); expect(settings.exchangeFolder).toBe('Exporte');
    }
    const custom = { ...defaultSettings, exchangeFolder: 'Mein Ordner/Abgaben' };
    expect(upgradeExportFolder(custom)).toBe(false); expect(custom.exchangeFolder).toBe('Mein Ordner/Abgaben');
    const overlap = { ...defaultSettings, projectFolder: 'Exporte/Bücher', exchangeFolder: 'Writeller-Austausch' };
    expect(upgradeExportFolder(overlap)).toBe(false); expect(overlap.exchangeFolder).toBe('Writeller-Austausch');
  });
  it('räumt alte Wurzeln nur ohne Dateien auf und schützt konfigurierte Projektordner', async () => {
    const vault = new FakeVault(), removeEmptyFolder = vi.fn(async (_path: string) => {});
    vault.data.set('Writeller-Austausch/Behalten.txt', utf8('Meine Datei'));
    const port = Object.assign(vault, { removeEmptyFolder });
    await cleanupLegacyExportFolders(port, { ...defaultSettings, projectFolder: 'Writeller Exchange/Projekte' });
    expect(removeEmptyFolder.mock.calls.map(([path]) => path)).toEqual(['Writeller Austausch', 'Writeller-Exchange']);
    expect(vault.data.get('Writeller-Austausch/Behalten.txt')).toEqual(utf8('Meine Datei'));
  });
  it('prüft im nativen Adapter auch leere Unterordner und verschiebt nur wirklich leere Ordner in den Papierkorb', async () => {
    const nonempty = Object.assign(new TFolder(), { children: [new TFolder()] }), empty = Object.assign(new TFolder(), { children: [] });
    const trash = vi.fn(async () => {}), app = { vault: { getAbstractFileByPath: (path: string) => path === 'Leer' ? empty : nonempty }, fileManager: { trashFile: trash } } as unknown as App;
    const adapter = new ObsidianVault(app);
    await adapter.removeEmptyFolder('Mit Unterordner'); expect(trash).not.toHaveBeenCalled();
    await adapter.removeEmptyFolder('Leer'); expect(trash).toHaveBeenCalledWith(empty);
  });
  it('blendet alte und aktuelle Exportordner auch mit unsichtbaren JSON-Dateien aus, schützt aber eigene Inhalte', () => {
    const vault = new FakeVault();
    vault.data.set('Writeller Austausch/Mein Buch.writeller-exchange.json', utf8('{}'));
    vault.data.set('Exporte/Mein Buch.writeller-exchange.json', utf8('{}'));
    expect(exportFoldersToHide(vault, defaultSettings)).toEqual(expect.arrayContaining(['Writeller Austausch', 'Exporte']));
    vault.data.set('Writeller Austausch/Idee.md', utf8('Meine Idee'));
    vault.data.set('Exporte/Titelbild.png', new Uint8Array([1]));
    expect(exportFoldersToHide(vault, defaultSettings)).not.toContain('Writeller Austausch');
    expect(exportFoldersToHide(vault, defaultSettings)).not.toContain('Exporte');
    expect(exportFoldersToHide(new FakeVault(), { ...defaultSettings, projectFolder: 'Writeller Austausch/Roman' })).not.toContain('Writeller Austausch');
  });
});
