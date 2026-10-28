import type { Plugin } from 'obsidian';
import { writingKinds } from '../objects/kinds';
import type { CommandContext } from './command-context';
import type { WritingCommands } from './writing-commands';
import type { LocalCommands } from './local-commands';
import type { TransferCommands } from './transfer-commands';
import type { ImageCommands } from './image-commands';
import type { Inspection } from './inspection';

export interface CommandActions { writing: WritingCommands; advanced: LocalCommands; transfer: TransferCommands; images: ImageCommands;
  inspection: Inspection; openView(): Promise<void>; organize(): Promise<void>; run(action: () => Promise<void>): void; available(): boolean }
/** Registers familiar writing nouns; technical tools appear only when requested or needed. */
export function registerWritingCommands(plugin: Plugin, ctx: CommandContext, actions: CommandActions): void {
  const hasProject = (): boolean => ctx.service.index.manifests().length > 0;
  const advanced = (): boolean => ctx.service.settings.showTechnicalInfo;
  const add = (id: string, name: string, action: () => Promise<void>, enabled: () => boolean = () => true): void => {
    plugin.addCommand({ id, name, checkCallback: checking => {
      const allowed = actions.available() && enabled(); if (!checking && allowed) actions.run(action); return allowed;
    } });
  };
  add('open-project', 'Schreibprojekte öffnen', () => actions.openView());
  add('create-project', 'Neues Schreibprojekt', () => actions.writing.createProject());
  for (const kind of writingKinds) add(`add-${kind.id}`, `${kind.singular} hinzufügen`, () => actions.writing.add(kind.id), hasProject);
  add('create-object', 'Weitere Notizart hinzufügen', () => actions.writing.pickKind(), () => advanced() && hasProject());
  add('assign-note', 'Diese Notiz einem Schreibprojekt zuordnen', () => actions.writing.pickKind(ctx.app.workspace.getActiveFile()?.path),
    () => ctx.app.workspace.getActiveFile()?.extension === 'md' && !ctx.active() && hasProject());
  add('edit-properties', 'Details bearbeiten', () => actions.writing.details(), () => !!ctx.active());
  add('change-object-type', 'Notizart ändern', () => actions.advanced.changeType(), () => ctx.active()?.collection === 'catalogItems');
  add('import-project', 'Projektdatei importieren', () => actions.transfer.importProject());
  add('export-project', 'Projekt exportieren', () => actions.transfer.exportProject(), hasProject);
  add('organize-project', 'Projektdateien lesbar ordnen', () => actions.organize(), hasProject);
  add('copy-project', 'Projekt kopieren', () => actions.advanced.copyProject(), hasProject);
  add('transfer-object', 'Notiz in anderes Projekt kopieren', () => actions.advanced.transfer(), () => !!ctx.active() && ctx.active()?.collection !== 'project' && ctx.service.index.manifests().length > 1);
  add('add-image', 'Bild hinzufügen', () => actions.images.addImage(), hasProject);
  add('inspect-project', 'Projekt auf Probleme prüfen', () => actions.inspection.show(), () => hasProject() || ctx.service.index.problems.length > 0);
  add('edit-exchange-data', 'Technische Daten bearbeiten', () => actions.advanced.properties(), () => advanced() && !!ctx.active());
  add('adopt-changed-images', 'Extern bearbeitete Bilder übernehmen', () => actions.images.changedImages(), () => advanced() && hasProject());
  add('repair-state', 'Fehlende Austauschdaten wiederherstellen', () => actions.transfer.repairState(), () => hasProject() && (advanced() || ctx.problemCodes.has('STATE_MISSING')));
  add('recover-import', 'Unterbrochenen Vorgang wiederherstellen', () => actions.transfer.recoverImport(), () => advanced() || ctx.pendingRecovery);
}
