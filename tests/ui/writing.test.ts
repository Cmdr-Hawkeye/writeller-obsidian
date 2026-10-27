import { Window } from 'happy-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { installDomHelpers, createUiApp, Notice, commandHost, MarkdownView, TFile } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { CommandContext } from '../../src/ui/command-context';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { LocalCommands } from '../../src/ui/local-commands';
import { ImageCommands } from '../../src/ui/image-commands';
import { Inspection } from '../../src/ui/inspection';
import { WritingProjectView } from '../../src/ui/project-view';
import { registerWritingCommands } from '../../src/ui/commands';
import { technicalFolderCss, WritingPresentation } from '../../src/obsidian/presentation';
import { createRecord } from '../../src/objects/factory';
import { entries, setEntry } from '../../src/domain/records';
import { applyDetails, detailFields } from '../../src/ui/writing-fields';

let window: Window;
/** Sets up a controlled DOM with only public API shapes used by the production UI. */
beforeEach(() => {
  window = new Window(); vi.stubGlobal('window', window); vi.stubGlobal('document', window.document);
  installDomHelpers(window as unknown as globalThis.Window); Notice.messages = [];
});
/** Prevents a fake host from leaking into other tests or being confused with a native run. */
afterEach(() => { vi.unstubAllGlobals(); });
/** Builds real production writing services against the explicit API fake. */
function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const { app, opened, editors } = createUiApp(vault), ctx = new CommandContext(app, service), writing = new WritingCommands(ctx);
  return { vault, service, ctx, writing, opened, editors };
}
/** Changes a labelled field by dispatching the same event as a user typing. */
function fill(label: string, value: string): void {
  const field = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!field) throw new Error(`Feld fehlt: ${label}`);
  field.value = value; field.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
}
/** Clicks an exact label inside the current modal only. */
function submit(label: string): void {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.modal button')].find(b => b.textContent === label);
  if (!button) throw new Error(`Button fehlt: ${label}`); button.click();
}
/** Creates the first project through the actual production form, not by bypassing its controller. */
async function created() {
  const state = setup(), task = state.writing.createProject();
  await vi.waitFor(() => expect(document.querySelector('[aria-label="Projekttitel"]')).not.toBeNull());
  fill('Projekttitel', 'Mein erstes Buch'); fill('Worum geht es?', 'Eine Geschichte über Ankunft und Aufbruch.');
  submit('Projekt erstellen'); await task;
  return state;
}
describe('Schreiboberfläche im DOM-/API-Fake', () => {
  it('erstellt ein Projekt mit einem verständlichen Formular und ohne zweiten technischen Dialog', async () => {
    const { vault, service } = await created();
    expect(vault.data.has('Schreibprojekte/Mein erstes Buch/Mein erstes Buch.md')).toBe(true);
    expect(service.index.manifests()).toHaveLength(1);
    expect(document.querySelector('.modal')).toBeNull();
    expect(Notice.messages).toContain('Dein Schreibprojekt ist bereit.');
  });
  it('erstellt Kapitel und Szenen direkt im aktiven Projekt und öffnet ihre echten Markdown-Dateien', async () => {
    const { ctx, writing, service, opened } = await created(), chapterTask = writing.add('chapter');
    await vi.waitFor(() => expect(document.querySelector('[aria-label="Titel"]')).not.toBeNull());
    fill('Titel', 'Die Ankunft'); submit('Kapitel hinzufügen'); await chapterTask;
    const snapshot = await service.snapshot(ctx.selectedProjectId!); expect(snapshot.exchange.chapters).toHaveLength(1);
    const sceneTask = writing.add('scene', ctx.selectedProjectId!, snapshot.exchange.chapters[0]!.id);
    await vi.waitFor(() => expect(document.querySelector('[aria-label="Kapitel"]')).not.toBeNull());
    expect([...document.querySelectorAll('option')].map(o => o.textContent)).toContain('Die Ankunft');
    fill('Titel', 'Nebel am Hafen'); submit('Szene hinzufügen'); await sceneTask;
    expect(opened.at(-1)).toBe('Schreibprojekte/Mein erstes Buch/Manuskript/01 - Die Ankunft/01 - Nebel am Hafen.md');
    expect((await service.snapshot(ctx.selectedProjectId!)).exchange.scenes[0]?.chapterId).toBe(snapshot.exchange.chapters[0]!.id);
  });
  it('behält ungültige Eingaben im Formular und kann ohne Dateianlage abbrechen', async () => {
    const { writing, vault } = setup(), task = writing.createProject();
    submit('Projekt erstellen'); expect(document.querySelector('[role="alert"]')?.textContent).toContain('Projekttitel');
    expect(vault.data.size).toBe(0); submit('Abbrechen'); await task;
    expect(vault.data.size).toBe(0);
  });
  it('zeigt einen Arbeitsbereich mit echten Notizarten und ohne IDs, Hashes oder Speicherjargon', async () => {
    const { ctx, writing } = await created(), transfer = new TransferCommands(ctx);
    const view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, transfer, action => { void action(); }, {
      inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
    });
    document.body.append(view.contentEl); await view.onOpen();
    const text = view.contentEl.textContent ?? '';
    for (const label of ['Mein erstes Buch', 'Manuskript', 'Erstes Kapitel hinzufügen', 'Figuren', 'Orte', 'Gegenstände', 'Exportieren']) expect(text).toContain(label);
    expect(text).not.toMatch(/writeller-id|catalogItems|records|journal|[a-f0-9]{32,}|[a-f0-9]{8}-[a-f0-9]{4}-/i);
    expect(ctx.changed.size).toBe(1); await view.onClose(); expect(ctx.changed.size).toBe(0);
  });
  it('bietet direkte Schreibbefehle an und versteckt reine Wartungsbefehle bis sie gebraucht werden', async () => {
    const { ctx, writing } = await created(), { plugin, commands } = commandHost();
    registerWritingCommands(plugin, ctx, { writing, advanced: new LocalCommands(ctx), transfer: new TransferCommands(ctx), images: new ImageCommands(ctx), inspection: new Inspection(ctx),
      openView: async () => {}, organize: async () => {}, run: action => { void action(); }, available: () => true });
    const visible = commands.filter(c => c.checkCallback(true)).map(c => c.name);
    for (const name of ['Kapitel hinzufügen', 'Szene hinzufügen', 'Figur hinzufügen', 'Ort hinzufügen', 'Schreibprojekte öffnen']) expect(visible).toContain(name);
    expect(visible).not.toContain('Technische Daten bearbeiten'); expect(visible).not.toContain('Unterbrochenen Vorgang wiederherstellen');
    ctx.pendingRecovery = true; expect(commands.find(c => c.id === 'recover-import')?.checkCallback(true)).toBe(true);
  });
  it('behält Buttons, Fokus und aufgeklappte Gruppen bei unverändertem Refresh zwischen Drücken und Klicken', async () => {
    const { ctx, writing } = await created();
    const view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, new TransferCommands(ctx), action => { void action(); }, {
      inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
    });
    document.body.append(view.contentEl); await view.onOpen();
    const button = view.contentEl.querySelector<HTMLButtonElement>('[aria-label="Figur hinzufügen"]')!;
    const group = button.closest('details')!; group.open = true; button.focus();
    button.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }) as unknown as Event);
    await Promise.all([view.refresh(), view.refresh()]);
    expect(button.isConnected).toBe(true); expect(document.activeElement).toBe(button); expect(group.open).toBe(true);
    button.click(); await vi.waitFor(() => expect(document.querySelector('.modal [aria-label="Name"]')).not.toBeNull());
    submit('Abbrechen'); await view.onClose();
  });
  it('aktualisiert bei wirklich geänderten Daten weiterhin die Projektübersicht', async () => {
    const { ctx, writing, service } = await created();
    const view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, new TransferCommands(ctx), action => { void action(); }, {
      inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
    });
    document.body.append(view.contentEl); await view.onOpen();
    const snapshot = await service.snapshot(ctx.selectedProjectId!);
    snapshot.exchange.project.title = 'Der neue Titel'; await service.commit(await service.previewSave(snapshot.exchange, snapshot));
    await view.refresh(); expect(view.contentEl.querySelector('h2')?.textContent).toBe('Der neue Titel'); await view.onClose();
  });
  it('bewahrt komplexe Charakterfelder beim Bearbeiten verständlicher Details', async () => {
    const { service, ctx } = await created(), snapshot = await service.snapshot(ctx.selectedProjectId!);
    const entry = createRecord('catalogItems', snapshot.state.projectId, snapshot.state.localInstanceId, 'Lina');
    if (entry.collection !== 'catalogItems') throw new Error('Testinvariante');
    entry.record.fields['roleFunction'] = { text: 'Strukturierter Fremdwert' };
    setEntry(snapshot.exchange, entry);
    expect(detailFields(entry, snapshot.exchange).some(f => f.key === 'roleFunction')).toBe(false);
    applyDetails(entry, { title: 'Lina am Hafen', status: 'drafting', summary: 'Neue Zusammenfassung' });
    expect(entry.record.fields['roleFunction']).toEqual({ text: 'Strukturierter Fremdwert' });
    expect(entries(snapshot.exchange).filter(e => e.collection === 'catalogItems')).toHaveLength(1);
  });
  it('blendet nur den technischen Ordner aus und lässt dessen Daten auf dem Vault-Port erhalten', async () => {
    const { vault, ctx } = await created();
    const css = technicalFolderCss(['Writeller-Daten']);
    expect(css).toContain('.workspace-leaf-content[data-type="file-explorer"]');
    expect(css).toContain('[data-path="Writeller-Daten"]'); expect(css).not.toContain('Schreibprojekte');
    expect(vault.files().some(f => f.path.startsWith('Writeller-Daten/'))).toBe(true);
    expect(ctx.service.settings.showTechnicalInfo).toBe(false);
  });
  it('entfernt alle Ansichtsänderungen beim Einschalten technischer Informationen und beim Entladen', async () => {
    const { ctx, editors, service } = await created(), editor = new MarkdownView();
    editor.file = new TFile(service.index.manifests()[0]!.path); document.body.append(editor.containerEl); editors.push(editor);
    const presentation = new WritingPresentation(ctx); await presentation.refresh();
    expect(editor.containerEl.classList.contains('writeller-writing-note')).toBe(true);
    expect(document.head.querySelector('style')?.textContent).toContain('Writeller-Daten');
    expect(document.head.querySelector('style')?.textContent).toContain('Writeller Austausch');
    expect(document.head.querySelector('style')?.textContent).toContain('Exporte');
    ctx.service.settings.showTechnicalInfo = true; await presentation.refresh();
    expect(editor.containerEl.classList.contains('writeller-writing-note')).toBe(false);
    expect(document.head.querySelector('style')?.textContent).toBe('');
    presentation.dispose(); expect(document.head.querySelector('style')).toBeNull();
  });
});
