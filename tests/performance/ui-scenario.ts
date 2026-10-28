import { Window } from 'happy-dom';
import type { WorkspaceLeaf } from 'obsidian';
import { installDomHelpers, createUiApp } from '../helpers/obsidian-ui';
import { MeasuredVault } from '../helpers/measured-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import { utf8 } from '../../src/storage/vault-port';
import { CommandContext } from '../../src/ui/command-context';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { WritingProjectView } from '../../src/ui/project-view';

/** Runs the real form/controller/view against isolated storage, never a user's Obsidian profile. */
export async function scenario(unrelated = 1000, history = 16) {
  const window = new Window(); Object.assign(globalThis, { window, document: window.document }); installDomHelpers(window as unknown as globalThis.Window);
  const vault = new MeasuredVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), pkg = createProject('Performance-Test');
  for (let i = 0; i < unrelated; i++) vault.data.set(`Andere Notizen/Notiz ${i}.md`, utf8(`Eigener Text ${i}.\n`.repeat(30)));
  for (let i = 0; i < 30; i++) setEntry(pkg, createRecord('catalogItems', pkg.project.id, pkg.producer.instanceId, `Figur ${i}`));
  await service.commit(await service.previewSave(pkg, null));
  for (let i = 0; i < history; i++) {
    const local = await service.snapshot(pkg.project.id); setEntry(local.exchange, createRecord('notes', pkg.project.id, pkg.producer.instanceId, `Idee ${i}`));
    await service.commit(await service.previewSave(local.exchange, local));
  }
  const { app } = createUiApp(vault), ctx = new CommandContext(app, service), writing = new WritingCommands(ctx); ctx.selectedProjectId = pkg.project.id;
  const view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, new TransferCommands(ctx), action => { void action(); }, {
    inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
  });
  await view.onOpen(); document.body.append(view.contentEl);
  const measurements: { name: string; ms: number; reads: number; unrelatedReads: number; backupReads: number; inventories: number }[] = [];
  /** Measures observable user operations; IO counts are more portable than elapsed milliseconds. */
  const measure = async (name: string, action: () => Promise<void>) => {
    vault.reset(); const start = performance.now(); await action();
    measurements.push({ name, ms: Math.round((performance.now() - start) * 10) / 10, reads: vault.reads.length,
      unrelatedReads: vault.reads.filter(path => path.startsWith('Andere Notizen/')).length,
      backupReads: vault.reads.filter(path => /-(?:before|after|pending)\.bin$/.test(path)).length, inventories: vault.inventories });
  };
  let task: Promise<void>;
  await measure('open-create-form', async () => {
    task = writing.add('character', pkg.project.id); const start = performance.now();
    while (!document.querySelector('.modal [aria-label="Name"]')) {
      if (performance.now() - start > 30000) throw new Error('Formular nicht geöffnet');
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  });
  await measure('save-object-and-refresh', async () => {
    const input = document.querySelector<HTMLInputElement>('.modal [aria-label="Name"]')!; input.value = 'Neue Figur'; input.dispatchEvent(new window.Event('input') as unknown as Event);
    [...document.querySelectorAll<HTMLButtonElement>('.modal button')].find(button => button.textContent === 'Figur hinzufügen')!.click();
    await task; await view.refresh();
  });
  await measure('five-idle-refreshes', async () => { for (let i = 0; i < 5; i++) await view.refresh(); });
  await view.onClose(); await window.happyDOM.close();
  return { host: 'Node + happy-dom + synthetic in-memory vault; not native Obsidian', unrelated, history, measurements };
}
