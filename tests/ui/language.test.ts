import { Window } from 'happy-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf, Plugin } from 'obsidian';
import { createUiApp, installDomHelpers, setHostLanguage, MarkdownView, TFile } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { defaultSettings } from '../../src/projects/layout';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { CommandContext } from '../../src/ui/command-context';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { WritingProjectView } from '../../src/ui/project-view';
import { WritellerSettingsTab } from '../../src/ui/settings';
import { changeWritingLanguage } from '../../src/ui/language-change';
import { resolveLanguage, setLanguage, language } from '../../src/i18n/language';
import { tr } from '../../src/i18n/translate';
import { writingKinds, statusLabels } from '../../src/objects/kinds';
import { suggestNote } from '../../src/projects/note-discovery';
import { createProject } from '../../src/objects/factory';
import { pendingJournals } from '../../src/storage/recovery-index';

/** Creates a synthetic DOM and host locale; no personal app or vault is read. */
beforeEach(() => { const win = new Window(); vi.stubGlobal('window', win); vi.stubGlobal('document', win.document); installDomHelpers(win as unknown as globalThis.Window); setLanguage('de'); setHostLanguage('de'); });
/** Restores deterministic defaults after every language override. */
afterEach(() => { setLanguage('de'); setHostLanguage('de'); vi.unstubAllGlobals(); });
/** Composes actual services behind a controlled host. */
function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), { app, editors } = createUiApp(vault);
  const ctx = new CommandContext(app, service), writing = new WritingCommands(ctx), save = vi.fn(async () => {});
  return { vault, service, ctx, writing, save, editors };
}
/** Presses a real modal button through its accessible text. */
async function click(text: string): Promise<void> {
  await vi.waitFor(() => expect([...document.querySelectorAll<HTMLButtonElement>('.modal button')].some(button => button.textContent === text)).toBe(true));
  [...document.querySelectorAll<HTMLButtonElement>('.modal button')].find(button => button.textContent === text)!.click();
}
describe('language selection and production UI', () => {
  it.each([['de', 'de'], ['de-DE', 'de'], ['en', 'en'], ['fr', 'en'], ['zh', 'en'], ['', 'en']] as const)('automatically resolves host %s to %s', (host, expected) => {
    expect(resolveLanguage('auto', host)).toBe(expected); expect(resolveLanguage('de', host)).toBe('de'); expect(resolveLanguage('en', host)).toBe('en');
  });
  it('updates noun and status getters without reimporting modules, keeping user interpolation unchanged', () => {
    setLanguage('en'); expect(writingKinds.find(kind => kind.id === 'character')?.singular).toBe('Character'); expect(statusLabels['idea']).toBe('Idea');
    expect(writingKinds.map(kind => kind.singular)).toEqual(['Chapter', 'Scene', 'Character', 'Location', 'Item', 'Event', 'Story arc', 'Note', 'Research', 'Relationship', 'Custom type']);
    expect(Object.values(statusLabels)).toEqual(['Idea', 'Planned', 'Outlined', 'Drafting', 'Needs revision', 'Revised', 'Reviewed', 'Complete', 'Archived']);
    expect(tr`Als ${'Meine Figur {0}'} übernehmen`).toBe('Adopt as Meine Figur {0}'); setLanguage('de'); expect(statusLabels['idea']).toBe('Idee');
  });
  it('uses the Obsidian locale on first setup and stores English default roots for a non-German host', async () => {
    const { ctx, service, save } = setup(); setHostLanguage('fr');
    expect(await changeWritingLanguage(ctx, 'auto', save, true)).toBe(true); expect(language()).toBe('en'); expect(service.settings.language).toBe('auto');
    expect(service.settings.projectFolder).toBe('Writing Projects'); expect(service.settings.exchangeFolder).toBe('Exports'); expect(save).toHaveBeenCalledOnce();
  });
  it('offers native auto/German/English settings with translated headings and validated override callbacks', async () => {
    const { ctx, service, save } = setup(), change = vi.fn(async preference => { await changeWritingLanguage(ctx, preference, save); });
    const tab = new WritellerSettingsTab(ctx.app, {} as Plugin, service.settings, save, change);
    await tab.setControlValue('language', 'en'); expect(change).toHaveBeenCalledWith('en'); expect(tab.getControlValue('language')).toBe('en');
    expect(tab.getSettingDefinitions()[0]).toMatchObject({ type: 'group', heading: 'Your writing workspace', items: expect.arrayContaining([
      expect.objectContaining({ name: 'Language', control: expect.objectContaining({ options: { auto: 'Automatic (Obsidian)', de: 'Deutsch', en: 'English' } }) })
    ]) }); await expect(tab.setControlValue('language', 'fr')).rejects.toThrow('INVALID_FIELD');
  });
  it('creates an English project through the real form with user-authored German filenames preserved', async () => {
    const { ctx, writing, service, save, vault } = setup(); setHostLanguage('en'); await changeWritingLanguage(ctx, 'auto', save, true);
    const task = writing.createProject(); await vi.waitFor(() => expect(document.querySelector('[aria-label="Project title"]')).not.toBeNull());
    const field = document.querySelector<HTMLInputElement>('[aria-label="Project title"]')!; field.value = 'Mein erstes Buch'; field.dispatchEvent(new window.Event('input'));
    await click('Create project'); await task;
    expect(vault.data.has('Writing Projects/Mein erstes Buch/Mein erstes Buch.md')).toBe(true); expect((await service.snapshot(ctx.selectedProjectId!)).exchange.project.languageCode).toBe('en');
    vault.data.set('Writing Projects/Mein erstes Buch/Characters/Meine Figur.md', new TextEncoder().encode('Text'));
    expect(suggestNote(service.index, 'Writing Projects/Mein erstes Buch/Characters/Meine Figur.md')?.kindId).toBe('character');
  });
  it('refreshes an already open empty project view when the locale changes', async () => {
    const { ctx, writing } = setup(), view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, new TransferCommands(ctx), action => { void action(); }, {
      inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
    });
    await view.onOpen(); expect(view.contentEl.textContent).toContain('Dein nächstes Schreibprojekt'); setLanguage('en'); await view.refresh();
    expect(view.getDisplayText()).toBe('Writing projects'); expect(view.contentEl.textContent).toContain('Your next writing project'); expect(view.contentEl.textContent).not.toContain('Schreibprojekt erstellen'); await view.onClose();
  });
  it('restores preferences and presentation language if persistence fails', async () => {
    const { ctx, service } = setup(); const save = vi.fn(async () => { throw new Error('save failed'); });
    await expect(changeWritingLanguage(ctx, 'en', save)).rejects.toThrow('save failed'); expect(service.settings.language).toBe('auto'); expect(language()).toBe('de');
  });
  it('cancels a concrete folder preview without changing preferences, paths or note bytes', async () => {
    const { ctx, service, vault, save } = setup(), pkg = createProject('Mein Buch'); await service.commit(await service.previewSave(pkg, null));
    const before = [...vault.data], settings = { ...service.settings }, task = changeWritingLanguage(ctx, 'en', save);
    await click('Abbrechen'); expect(await task).toBe(false); expect([...vault.data]).toEqual(before); expect(service.settings).toEqual(settings); expect(language()).toBe('de'); expect(save).not.toHaveBeenCalled();
  });
  it('rolls actual folders back when saving the selected language fails after migration', async () => {
    const { ctx, service, vault } = setup(), pkg = createProject('Mein Buch'); await service.commit(await service.previewSave(pkg, null));
    const paths = vault.files().filter(file => file.markdown).map(file => file.path), task = changeWritingLanguage(ctx, 'en', async () => { throw new Error('save failed'); });
    const rejected = expect(task).rejects.toThrow('save failed'); await click('Übernehmen'); await rejected;
    expect(vault.files().filter(file => file.markdown).map(file => file.path)).toEqual(paths); expect(service.settings.projectFolder).toBe('Schreibprojekte'); expect(await pendingJournals(vault)).toEqual([]);
  });
  it('flushes affected editor buffers while leaving unrelated open notes untouched', async () => {
    const { ctx, service, vault, save, editors } = setup(), pkg = createProject('Mein Buch'); await service.commit(await service.previewSave(pkg, null));
    const owned = new MarkdownView(), unrelated = new MarkdownView(); owned.file = new TFile(vault.files().find(file => file.markdown)!.path); unrelated.file = new TFile('Privat/Andere Notiz.md');
    owned.getViewData = () => 'Unsaved project buffer'; unrelated.getViewData = () => 'Unsaved private buffer'; owned.save = vi.fn(async () => {}); unrelated.save = vi.fn(async () => {}); editors.push(owned, unrelated);
    const task = changeWritingLanguage(ctx, 'en', save); await click('Übernehmen'); await task;
    expect(owned.save).toHaveBeenCalledOnce(); expect(unrelated.save).not.toHaveBeenCalled();
  });
});
