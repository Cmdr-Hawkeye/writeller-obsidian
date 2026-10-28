import { Window } from 'happy-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Menu, type WorkspaceLeaf } from 'obsidian';
import { createUiApp, installDomHelpers, TFolder, TFile } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import { CommandContext } from '../../src/ui/command-context';
import { WritingCommands } from '../../src/ui/writing-commands';
import { LocalCommands } from '../../src/ui/local-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { WritingProjectView } from '../../src/ui/project-view';
import { writingFileMenu } from '../../src/obsidian/file-menu';
import { adoptNote } from '../../src/ui/unassigned-notes';
import { discoverNotes } from '../../src/projects/note-discovery';
import { parseManaged, splitNote } from '../../src/mapping/frontmatter';
import { utf8, text } from '../../src/storage/vault-port';
import { readExchange } from '../../src/exchange/codec';

/** Uses a controlled UI host; no personal vault or native Obsidian instance is opened. */
beforeEach(() => { const window = new Window(); vi.stubGlobal('window', window); vi.stubGlobal('document', window.document); installDomHelpers(window as unknown as globalThis.Window); });
/** Restores test globals after each independent action. */
afterEach(() => { vi.unstubAllGlobals(); });
/** Creates one real project and one ordinary user-authored Markdown file. */
async function setup(withNote = true) {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), pkg = createProject('Mein Buch');
  await service.commit(await service.previewSave(pkg, null));
  const { app } = createUiApp(vault), ctx = new CommandContext(app, service), writing = new WritingCommands(ctx), transfer = new TransferCommands(ctx);
  ctx.selectedProjectId = pkg.project.id;
  const root = service.index.manifests()[0]!.path.split('/').slice(0, -1).join('/'), path = `${root}/Figuren/Bernd das Brot.md`;
  const source = '---\nmeine-tags: [Brot, Figur]\nmein-status: {offen: true}\n---\n# Bernd\r\nEin vorhandener Text.\r\n';
  if (withNote) vault.data.set(path, utf8(source));
  return { vault, service, pkg, app, ctx, writing, transfer, root, path, source };
}
/** Clicks one real controlled button after the asynchronous production dialog opens. */
async function click(label: string): Promise<void> {
  await vi.waitFor(() => expect([...document.querySelectorAll<HTMLButtonElement>('.modal button')].some(button => button.textContent === label)).toBe(true));
  [...document.querySelectorAll<HTMLButtonElement>('.modal button')].find(button => button.textContent === label)!.click();
}
describe('gewöhnliche Notiz bewusst übernehmen und vollständig exportieren', () => {
  it('erkennt neue Dateien auch ohne Änderung am verwalteten Index und zeigt die passende Übernahmeaktion', async () => {
    const state = await setup(false), { ctx, writing, transfer, vault, path, source } = state;
    const view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, transfer, action => { void action(); }, {
      inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
    });
    document.body.append(view.contentEl); await view.onOpen(); const before = await ctx.service.index.fingerprint();
    vault.data.set(path, utf8(source)); await view.refresh();
    expect(await ctx.service.index.fingerprint()).toBe(before);
    expect(view.contentEl.textContent).toContain('Bernd das Brot'); expect(view.contentEl.textContent).toContain('Als Figur übernehmen');
    await view.onClose();
  });
  it('erhält Text, eigene YAML-Werte und Pfad und exportiert die übernommene Notiz als Figur', async () => {
    const { ctx, writing, vault, path, source, service, pkg } = await setup();
    const candidate = discoverNotes(vault, service.index, pkg.project.id)[0]!, task = adoptNote(ctx, writing, candidate);
    await vi.waitFor(() => expect(document.querySelector<HTMLInputElement>('[aria-label="Name"]')?.value).toBe('Bernd das Brot'));
    await click('Figur übernehmen'); await task;
    const saved = text(vault.data.get(path)!), managed = parseManaged(path, saved)!;
    expect(managed.projectId).toBe(pkg.project.id); expect(managed.collection).toBe('catalogItems');
    expect(splitNote(saved).body).toBe(splitNote(source).body); expect(splitNote(saved).properties['meine-tags']).toEqual(['Brot', 'Figur']);
    expect(splitNote(saved).properties['mein-status']).toEqual({ offen: true }); expect(discoverNotes(vault, service.index, pkg.project.id)).toEqual([]);
    const out = await service.previewExport(pkg.project.id, null); await service.commit(out.preview);
    const exported = await readExchange(vault.data.get(out.path)!);
    expect(exported.catalogItems[0]).toMatchObject({ type: 'character', name: 'Bernd das Brot', summary: splitNote(source).body });
  });
  it('lässt beim Abbrechen die gewöhnliche Notiz vollständig unverändert', async () => {
    const { ctx, writing, vault, path, source, service, pkg } = await setup(), before = vault.files().map(f => f.path);
    const task = adoptNote(ctx, writing, discoverNotes(vault, service.index, pkg.project.id)[0]!);
    await click('Abbrechen'); await task;
    expect(text(vault.data.get(path)!)).toBe(source); expect(vault.files().map(f => f.path)).toEqual(before);
    expect(discoverNotes(vault, service.index, pkg.project.id)).toHaveLength(1);
  });
  it('verschiebt eine Szene aus Ohne Kapitel nicht still in das zuletzt angelegte Kapitel', async () => {
    const { ctx, writing, service, pkg, vault, root } = await setup(false), snapshot = await service.snapshot(pkg.project.id);
    setEntry(snapshot.exchange, createRecord('chapters', pkg.project.id, snapshot.state.localInstanceId, 'Vorhandenes Kapitel'));
    await service.commit(await service.previewSave(snapshot.exchange, snapshot));
    const path = `${root}/Manuskript/Ohne Kapitel/Freie Szene.md`; vault.data.set(path, utf8('Meine Szene'));
    const task = adoptNote(ctx, writing, discoverNotes(vault, service.index, pkg.project.id)[0]!);
    await vi.waitFor(() => expect(document.querySelector<HTMLSelectElement>('[aria-label="Kapitel"]')?.value).toBe(''));
    await click('Szene übernehmen'); await task;
    expect((await service.snapshot(pkg.project.id)).exchange.scenes[0]).toMatchObject({ chapterId: null, title: 'Freie Szene', content: { text: 'Meine Szene' } });
  });
  it('warnt vor dem Export und öffnet auf Wunsch die Zuordnung statt Notizen still zu übergehen', async () => {
    const { ctx, transfer, vault, pkg } = await setup(); ctx.openProjectView = vi.fn(async () => {});
    const task = transfer.exportProject(pkg.project.id); await click('Zuerst in der Schreibübersicht zuordnen'); await task;
    expect(ctx.openProjectView).toHaveBeenCalledWith(pkg.project.id); expect(vault.files().some(f => f.path.startsWith('Exporte/'))).toBe(false);
  });
  it('exportiert nur nach ausdrücklicher Auslassentscheidung ohne die gewöhnliche Datei zu verändern', async () => {
    const { transfer, vault, pkg, path, source } = await setup(), task = transfer.exportProject(pkg.project.id);
    await click('Nur zugeordnete Notizen exportieren (1 gewöhnliche Notiz auslassen)'); await click('Übernehmen'); await task;
    expect(text(vault.data.get(path)!)).toBe(source);
    const file = vault.files().find(f => f.path.startsWith('Exporte/'))!;
    expect((await readExchange(vault.data.get(file.path)!)).catalogItems).toEqual([]);
  });
  it('schützt nachträgliche Änderungen an der aufzunehmenden Datei vor einem veralteten Schreibplan', async () => {
    const { ctx, writing, vault, pkg, service, path, source } = await setup(), original = service.previewSave.bind(service);
    vi.spyOn(service, 'previewSave').mockImplementation(async (...args) => { const result = await original(...args); vault.data.set(path, utf8(source + 'Spätere Bearbeitung')); return result; });
    const task = adoptNote(ctx, writing, discoverNotes(vault, service.index, pkg.project.id)[0]!);
    const rejection = expect(task).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: 'LOCAL_CHANGED' })] });
    await click('Figur übernehmen'); await rejection;
    expect(text(vault.data.get(path)!)).toBe(source + 'Spätere Bearbeitung'); expect(parseManaged(path, text(vault.data.get(path)!))).toBeNull();
  });
  it('ergänzt den nativen Ordner- und Dateimenüs passende Schreibaktionen', async () => {
    const { ctx, writing, root, path } = await setup(), run = (action: () => Promise<void>): void => { void action(); };
    const menu = new Menu(); writingFileMenu(menu, new TFolder(`${root}/Figuren`) as unknown as import('obsidian').TFolder, ctx, writing, new LocalCommands(ctx), run);
    menu.showAtPosition({ x: 0, y: 0 }); expect(document.querySelector('.menu')?.textContent).toContain('Novel Planner: Figur hinzufügen');
    const fileMenu = new Menu(); writingFileMenu(fileMenu, new TFile(path) as unknown as import('obsidian').TFile, ctx, writing, new LocalCommands(ctx), run);
    fileMenu.showAtPosition({ x: 0, y: 0 }); expect(document.querySelector('.menu')?.textContent).toContain('Novel Planner: Als Figur übernehmen');
  });
});
