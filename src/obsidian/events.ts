import { TFile, type Plugin } from 'obsidian';
import type { CommandContext } from '../ui/command-context';
import type { WritingCommands } from '../ui/writing-commands';
import type { LocalCommands } from '../ui/local-commands';
import type { Inspection } from '../ui/inspection';
import type { WritingPresentation } from './presentation';
import { WritingProjectView } from '../ui/project-view';

/** Registers reversible UI hints; full source verification remains in the exchange service. */
export function registerWritingEvents(plugin: Plugin, ctx: CommandContext, writing: WritingCommands, advanced: LocalCommands,
  inspection: Inspection, presentation: WritingPresentation, status: HTMLElement, run: (action: () => Promise<void>) => void, canRefresh: () => boolean): void {
  let timer: number | null = null;
  const update = (): void => {
    if (!canRefresh()) return;
    inspection.updateStatus(status); void presentation.refresh().catch(e => ctx.report(e));
    const view = plugin.app.workspace.getActiveViewOfType(WritingProjectView);
    if (view) void view.refresh().catch(e => ctx.report(e));
  };
  const invalidate = (): void => {
    ctx.service.index.invalidate();
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => { timer = null; update(); }, 200);
  };
  plugin.register(() => { if (timer !== null) window.clearTimeout(timer); });
  plugin.registerEvent(plugin.app.vault.on('create', invalidate));
  plugin.registerEvent(plugin.app.vault.on('modify', invalidate));
  plugin.registerEvent(plugin.app.vault.on('rename', invalidate));
  plugin.registerEvent(plugin.app.vault.on('delete', invalidate));
  plugin.registerEvent(plugin.app.metadataCache.on('changed', invalidate));
  plugin.registerEvent(plugin.app.workspace.on('active-leaf-change', update));
  plugin.registerEvent(plugin.app.workspace.on('layout-change', () => { void presentation.refresh().catch(e => ctx.report(e)); }));
  plugin.registerEvent(plugin.app.workspace.on('file-menu', (menu, file) => {
    if (!(file instanceof TFile) || file.extension !== 'md') return;
    const note = ctx.active(file.path);
    if (!note) menu.addItem(item => item.setTitle('Writeller: Einem Schreibprojekt zuordnen').onClick(() => run(() => writing.pickKind(file.path))));
    else {
      menu.addItem(item => item.setTitle('Writeller: Schreibprojekt öffnen').setIcon('book-open-text').onClick(() => run(async () => { await ctx.openProjectView?.(note.projectId); })));
      menu.addItem(item => item.setTitle('Writeller: Details bearbeiten').setIcon('pencil').onClick(() => run(() => writing.details(note.projectId, `${note.collection}/${note.id}`))));
      if (note.collection === 'catalogItems') menu.addItem(item => item.setTitle('Writeller: Notizart ändern').onClick(() => run(() => advanced.changeType(file.path))));
    }
  }));
}
