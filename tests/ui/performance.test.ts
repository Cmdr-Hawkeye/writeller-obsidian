import { Window } from 'happy-dom';
import type { WorkspaceLeaf } from 'obsidian';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { installDomHelpers, createUiApp, Notice } from '../helpers/obsidian-ui';
import { MeasuredVault } from '../helpers/measured-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject } from '../../src/objects/factory';
import { CommandContext } from '../../src/ui/command-context';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { WritingProjectView } from '../../src/ui/project-view';
import { utf8, text } from '../../src/storage/vault-port';
import { withActivity } from '../../src/ui/activity';

/** Controls DOM and timers explicitly; these are not native application timings. */
beforeEach(() => { const win = new Window(); vi.stubGlobal('window', win); vi.stubGlobal('document', win.document); installDomHelpers(win as unknown as globalThis.Window); Notice.messages = []; });
/** Prevents fake timer or DOM state leaking to independent integration tests. */
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
/** Opens actual production UI on an identity-bearing, journaled project. */
async function setup() {
  const vault = new MeasuredVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), pkg = createProject('Mein Buch');
  await service.commit(await service.previewSave(pkg, null)); const { app } = createUiApp(vault), ctx = new CommandContext(app, service);
  const view = new WritingProjectView({} as WorkspaceLeaf, ctx, new WritingCommands(ctx), new TransferCommands(ctx), action => { void action(); }, {
    inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
  });
  await view.onOpen(); return { vault, service, view, pkg };
}
describe('responsive project view', () => {
  it('performs no source or sidecar reads during repeated idle focus/layout refreshes', async () => {
    const { view, vault, service } = await setup(), snapshot = vi.spyOn(service, 'displaySnapshot'); vault.reset();
    for (let i = 0; i < 10; i++) await view.refresh(); expect(vault.reads).toEqual([]); expect(snapshot).not.toHaveBeenCalled(); await view.onClose();
  });
  it('observes data changes and coalesces overlapping refreshes into one project reconstruction', async () => {
    const { view, vault, service, pkg } = await setup(), snapshot = vi.spyOn(service, 'displaySnapshot');
    const manifest = service.index.find(pkg.project.id, 'project', pkg.project.id)!.path;
    vault.data.set(manifest, utf8(text(vault.data.get(manifest)!).replace('Mein Buch', 'Neuer Titel')));
    await Promise.all(Array.from({ length: 10 }, () => view.refresh())); expect(snapshot).toHaveBeenCalledOnce(); expect(view.contentEl.textContent).toContain('Neuer Titel'); await view.onClose();
  });
  it('detects a newly created ordinary note when managed identities have not changed', async () => {
    const { view, vault, service, pkg } = await setup(), base = service.index.find(pkg.project.id, 'project', pkg.project.id)!.path.split('/').slice(0, -1).join('/');
    vault.data.set(`${base}/Figuren/Neue Figur.md`, utf8('Text')); await view.refresh(); expect(view.contentEl.textContent).toContain('Noch nicht im Schreibprojekt'); expect(view.contentEl.textContent).toContain('Neue Figur'); await view.onClose();
  });
  it('includes backing state and journal header changes in the display revision', async () => {
    const { view, vault, service } = await setup(), snapshot = vi.spyOn(service, 'displaySnapshot'), state = vault.files().find(file => file.path.endsWith('/state.json'))!.path;
    vault.data.set(state, utf8(text(vault.data.get(state)!) + '\n')); await view.refresh(); expect(snapshot).toHaveBeenCalledOnce(); await view.onClose();
  });
  it('hides delayed activity feedback on failure and does not show it for quick operations', async () => {
    vi.useFakeTimers(); const hide = vi.spyOn(Notice.prototype, 'hide'); let finish!: () => void;
    vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => setTimeout(callback as () => void, delay));
    vi.spyOn(window, 'clearTimeout').mockImplementation(timer => clearTimeout(timer));
    const wait = new Promise<void>(resolve => { finish = resolve; });
    const slow = withActivity('Speichern…', async () => { await wait; throw new Error('disk error'); }), rejected = expect(slow).rejects.toThrow('disk error');
    await vi.advanceTimersByTimeAsync(300); expect(Notice.messages).toEqual(['Speichern…']); finish(); await rejected; expect(hide).toHaveBeenCalledOnce();
    Notice.messages = []; const fast = withActivity('Speichern…', async () => 42); await vi.advanceTimersByTimeAsync(1); expect(await fast).toBe(42); await vi.advanceTimersByTimeAsync(300); expect(Notice.messages).toEqual([]);
  });
});
