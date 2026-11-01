import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { createUiApp, installDomHelpers, Notice } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject } from '../../src/objects/factory';
import { CommandContext } from '../../src/ui/command-context';
import { deleteProject } from '../../src/ui/delete-project';
import { WritingProjectView } from '../../src/ui/project-view';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { setLanguage } from '../../src/i18n/language';

/** Uses a controlled DOM/API host, never a personal Obsidian vault. */
beforeEach(() => {
  const win = new Window(); vi.stubGlobal('window', win); vi.stubGlobal('document', win.document);
  installDomHelpers(win as unknown as globalThis.Window); setLanguage('de'); Notice.messages = [];
});
/** Keeps global UI and locale defaults isolated from the remaining suite. */
afterEach(() => { setLanguage('de'); vi.unstubAllGlobals(); });
/** Saves production project data and returns a real overview with captured asynchronous actions. */
async function setup(second = false) {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = createProject('Der Hafen'); await service.commit(await service.previewSave(pkg, null));
  if (second) await service.commit(await service.previewSave(createProject('Das zweite Buch'), null));
  const ctx = new CommandContext(createUiApp(vault).app, service); ctx.selectedProjectId = pkg.project.id;
  let task = Promise.resolve();
  const view = new WritingProjectView({} as WorkspaceLeaf, ctx, new WritingCommands(ctx), new TransferCommands(ctx), action => { task = action(); },
    { inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {} });
  document.body.append(view.contentEl); await view.onOpen(); ctx.openProjectView = () => view.refresh();
  return { vault, service, pkg, ctx, view, task: () => task };
}
/** Clicks a plain accessible button label within a selected UI container. */
function click(label: string, selector = '.modal'): void {
  const button = [...document.querySelectorAll<HTMLButtonElement>(`${selector} button`)].find(element => element.textContent === label);
  if (!button) throw new Error(`Missing button: ${label}`); button.click();
}
/** Fills the sole confirmation text input through its normal native input event. */
function name(value: string): void {
  const field = document.querySelector<HTMLInputElement>('.modal input')!;
  field.value = value; field.dispatchEvent(new window.Event('input'));
}
/** Opens the production overflow menu rather than bypassing its action wiring. */
function openDelete(view: WritingProjectView): void {
  view.contentEl.querySelector<HTMLButtonElement>('[aria-label="Weitere Projektaktionen"]')!.click(); click('Projekt löschen', '.menu');
}
describe('project deletion UI', () => {
  it('offers deletion in the project menu with scope and native-trash explanation; cancellation writes nothing', async () => {
    const { view, vault, task } = await setup(), before = new Map(vault.data), writes = vault.writes;
    openDelete(view); await vi.waitFor(() => expect(document.querySelector('.modal input')).not.toBeNull());
    expect(document.querySelector('.modal')?.textContent).toContain('Nicht zugeordnete Dateien und vorhandene Exporte bleiben erhalten.');
    expect(document.querySelector('.modal')?.textContent).toContain('Obsidian-Einstellung');
    expect(document.querySelector('.modal h2')?.textContent).toBe('„Der Hafen“ löschen?');
    click('Abbrechen'); await task(); expect(vault.data).toEqual(before); expect(vault.writes).toBe(writes); await view.onClose();
  });
  it('requires the exact project name, deletes once on double click and shows the empty first-project screen', async () => {
    const { view, service, vault, task } = await setup(); openDelete(view);
    await vi.waitFor(() => expect(document.querySelector('.modal input')).not.toBeNull());
    name('anderes Buch'); click('Projekt löschen'); expect(document.querySelector('[role="alert"]')?.textContent).toContain('genau wie oben');
    expect(service.index.manifests()).toHaveLength(1); name('Der Hafen');
    const button = [...document.querySelectorAll<HTMLButtonElement>('.modal button')].find(b => b.textContent === 'Projekt löschen')!;
    expect(button.classList.contains('mod-warning')).toBe(true); button.click(); button.click(); await task();
    expect(vault.data.size).toBe(0); expect(service.index.manifests()).toHaveLength(0);
    expect(view.contentEl.textContent).toContain('Dein nächstes Schreibprojekt'); expect(Notice.messages).toContain('„Der Hafen“ wurde gelöscht.'); await view.onClose();
  });
  it('automatically selects a remaining project after deletion', async () => {
    const { view, service, task } = await setup(true); openDelete(view);
    await vi.waitFor(() => expect(document.querySelector('.modal input')).not.toBeNull()); name('Der Hafen'); click('Projekt löschen'); await task();
    expect(view.contentEl.querySelector('h2')?.textContent).toBe('Das zweite Buch'); expect(service.index.manifests()).toHaveLength(1); await view.onClose();
  });
  it('translates the entire confirmation and success notice into English while preserving the project title', async () => {
    const { ctx, pkg, service, view } = await setup(); setLanguage('en');
    const task = deleteProject(ctx, pkg.project.id); await vi.waitFor(() => expect(document.querySelector('.modal input')).not.toBeNull());
    expect(document.querySelector('.modal h2')?.textContent).toBe('Delete “Der Hafen”?');
    expect(document.querySelector('.modal')?.textContent).toContain('Unassigned files and existing exports will be kept.');
    expect(document.querySelector('input')?.getAttribute('aria-label')).toBe('Enter the project name to confirm');
    name('Der Hafen'); click('Delete project'); await task; expect(service.index.manifests()).toHaveLength(0);
    expect(Notice.messages).toContain('“Der Hafen” was deleted.'); await view.onClose();
  });
});
