import { TFile, TFolder, type Menu, type TAbstractFile } from 'obsidian';
import type { CommandContext } from '../ui/command-context';
import type { WritingCommands } from '../ui/writing-commands';
import type { LocalCommands } from '../ui/local-commands';
import { suggestNote } from '../projects/note-discovery';
import { writingKinds } from '../objects/kinds';
import { adoptNote } from '../ui/unassigned-notes';

/** Adds familiar typed creation to native folder menus and adoption to ordinary note menus. */
export function writingFileMenu(menu: Menu, file: TAbstractFile, ctx: CommandContext, writing: WritingCommands, advanced: LocalCommands, run: (action: () => Promise<void>) => void): void {
  const suggestion = suggestNote(ctx.service.index, file.path);
  if (file instanceof TFolder) {
    if (!suggestion) return;
    const kind = writingKinds.find(kind => kind.id === suggestion.kindId)!;
    menu.addItem(item => item.setTitle(`Writeller: ${kind.singular} hinzufügen`).setIcon(kind.icon)
      .onClick(() => run(() => writing.add(kind.id, suggestion.projectId, suggestion.chapterId))));
    return;
  }
  if (!(file instanceof TFile) || file.extension !== 'md') return;
  const note = ctx.active(file.path);
  if (!note) {
    if (suggestion) {
      const kind = writingKinds.find(kind => kind.id === suggestion.kindId)!;
      menu.addItem(item => item.setTitle(`Writeller: Als ${kind.singular} übernehmen`).setIcon(kind.icon).onClick(() => run(() => adoptNote(ctx, writing, suggestion))));
    }
    menu.addItem(item => item.setTitle('Writeller: Einem Schreibprojekt zuordnen').onClick(() => run(() => writing.pickKind(file.path))));
  } else {
    menu.addItem(item => item.setTitle('Writeller: Schreibprojekt öffnen').setIcon('book-open-text').onClick(() => run(async () => { await ctx.openProjectView?.(note.projectId); })));
    menu.addItem(item => item.setTitle('Writeller: Details bearbeiten').setIcon('pencil').onClick(() => run(() => writing.details(note.projectId, `${note.collection}/${note.id}`))));
    if (note.collection === 'catalogItems') menu.addItem(item => item.setTitle('Writeller: Notizart ändern').onClick(() => run(() => advanced.changeType(file.path))));
  }
}
