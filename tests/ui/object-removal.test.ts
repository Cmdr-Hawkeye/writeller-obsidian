import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { createUiApp, installDomHelpers, Notice } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import type { CatalogItem, Scene } from '../../src/domain/types';
import { CommandContext } from '../../src/ui/command-context';
import { WritingProjectView } from '../../src/ui/project-view';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { ObjectCommands } from '../../src/ui/object-commands';
import { setLanguage } from '../../src/i18n/language';

beforeEach(() => {
  const win = new Window(); vi.stubGlobal('window', win); vi.stubGlobal('document', win.document);
  installDomHelpers(win as unknown as globalThis.Window); setLanguage('de'); Notice.messages = [];
});
afterEach(() => { setLanguage('de'); vi.unstubAllGlobals(); });

/** A real overview over a project whose scene uses a character as point of view. */
async function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = createProject('Der Hafen'), id = pkg.project.id;
  const anna = createRecord('catalogItems', id, 'x', 'Anna', { type: 'character' }).record as CatalogItem;
  const scene = createRecord('scenes', id, 'x', 'Ankunft').record as Scene; scene.povCharacterId = anna.id;
  setEntry(pkg, { collection: 'catalogItems', record: anna }); setEntry(pkg, { collection: 'scenes', record: scene });
  await service.commit(await service.previewSave(pkg, null));
  const ctx = new CommandContext(createUiApp(vault).app, service), objects = new ObjectCommands(ctx); ctx.selectedProjectId = id;
  let task = Promise.resolve();
  const view = new WritingProjectView({} as WorkspaceLeaf, ctx, new WritingCommands(ctx), new TransferCommands(ctx), action => { task = action(); },
    { inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {},
      removeObject: (project, key) => objects.delete(project, key), repairReferences: (project, mode) => objects.repair(project, mode) });
  document.body.append(view.contentEl); await view.onOpen();
  return { vault, service, id, anna, scene, view, task: () => task };
}
/** Clicks a button by its visible label inside a container. */
function click(label: string, selector: string): void {
  const button = [...document.querySelectorAll<HTMLButtonElement>(`${selector} button`)].find(element => element.textContent?.includes(label));
  if (!button) throw new Error(`Missing button: ${label}`); button.click();
}

describe('object deletion and reference repair UI', () => {
  it('deletes a scene from its action menu after a confirmation', async () => {
    const { view, service, id, scene, task } = await setup();
    view.contentEl.querySelector<HTMLButtonElement>('[aria-label="Aktionen für „Ankunft“"]')!.click(); click('Löschen…', '.menu');
    await vi.waitFor(() => expect(document.querySelector('.modal')?.textContent).toContain('Szene „Ankunft“ löschen'));
    click('Übernehmen', '.modal'); await task();
    expect((await service.snapshot(id)).exchange.scenes.map(s => s.id)).not.toContain(scene.id);
    expect(Notice.messages.join('\n')).toContain('wurde gelöscht'); await view.onClose();
  });
  it('explains a character deleted by hand and restores it from the overview', async () => {
    const { view, vault, service, id, anna, scene, task } = await setup();
    const path = service.index.find(id, 'catalogItems', anna.id)!.path;
    vault.data.delete(path); service.index.invalidate(path); await view.refresh();
    expect(view.contentEl.textContent).toContain('Ein verknüpftes Objekt fehlt.');
    click('Objekt wiederherstellen', '.writeller-repair');
    await vi.waitFor(() => expect(document.querySelector('.modal')?.textContent).toContain('Wiederhergestellt: „Anna“'));
    click('Übernehmen', '.modal'); await task();
    const after = (await service.snapshot(id)).exchange;
    expect(after.scenes.find(s => s.id === scene.id)!.povCharacterId).toBe(anna.id); expect(vault.data.has(path)).toBe(true);
    await view.onClose();
  });
  it('can remove the references instead', async () => {
    const { view, vault, service, id, anna, scene, task } = await setup();
    const path = service.index.find(id, 'catalogItems', anna.id)!.path;
    vault.data.delete(path); service.index.invalidate(path); await view.refresh();
    click('Verweise entfernen', '.writeller-repair');
    await vi.waitFor(() => expect(document.querySelector('.modal')?.textContent).toContain('1 Szenen verlieren ihre Perspektive.'));
    click('Übernehmen', '.modal'); await task();
    expect((await service.snapshot(id)).exchange.scenes.find(s => s.id === scene.id)!.povCharacterId).toBeNull();
    await view.onClose();
  });
});
