import { tr } from '../i18n/translate';
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
export function registerWritingCommands(plugin: Plugin, ctx: CommandContext, actions: CommandActions): () => void {
  const ids: string[] = [];
  const hasProject = (): boolean => ctx.service.index.manifests().length > 0;
  const advanced = (): boolean => ctx.service.settings.showTechnicalInfo;
  const add = (id: string, name: string, action: () => Promise<void>, enabled: () => boolean = () => true): void => {
    ids.push(id);
    plugin.addCommand({ id, name, checkCallback: checking => {
      const allowed = actions.available() && enabled(); if (!checking && allowed) actions.run(action); return allowed;
    } });
  };
  add('open-project', tr('Schreibprojekte öffnen'), () => actions.openView());
  add('create-project', tr('Neues Schreibprojekt'), () => actions.writing.createProject());
  for (const kind of writingKinds) add(`add-${kind.id}`, tr`${kind.singular} hinzufügen`, () => actions.writing.add(kind.id), hasProject);
  add('create-object', tr('Weitere Notizart hinzufügen'), () => actions.writing.pickKind(), () => advanced() && hasProject());
  add('assign-note', tr('Diese Notiz einem Schreibprojekt zuordnen'), () => actions.writing.pickKind(ctx.app.workspace.getActiveFile()?.path),
    () => ctx.app.workspace.getActiveFile()?.extension === 'md' && !ctx.active() && hasProject());
  add('edit-properties', tr('Details bearbeiten'), () => actions.writing.details(), () => !!ctx.active());
  add('change-object-type', tr('Notizart ändern'), () => actions.advanced.changeType(), () => ctx.active()?.collection === 'catalogItems');
  add('import-project', tr('Projektdatei importieren'), () => actions.transfer.importProject());
  add('export-project', tr('Projekt exportieren'), () => actions.transfer.exportProject(), hasProject);
  add('organize-project', tr('Projektdateien lesbar ordnen'), () => actions.organize(), hasProject);
  add('copy-project', tr('Projekt kopieren'), () => actions.advanced.copyProject(), hasProject);
  add('transfer-object', tr('Notiz in anderes Projekt kopieren'), () => actions.advanced.transfer(), () => !!ctx.active() && ctx.active()?.collection !== 'project' && ctx.service.index.manifests().length > 1);
  add('add-image', tr('Bild hinzufügen'), () => actions.images.addImage(), hasProject);
  add('inspect-project', tr('Projekt auf Probleme prüfen'), () => actions.inspection.show(), () => hasProject() || ctx.service.index.problems.length > 0);
  add('edit-exchange-data', tr('Technische Daten bearbeiten'), () => actions.advanced.properties(), () => advanced() && !!ctx.active());
  add('adopt-changed-images', tr('Extern bearbeitete Bilder übernehmen'), () => actions.images.changedImages(), () => advanced() && hasProject());
  add('repair-state', tr('Fehlende Austauschdaten wiederherstellen'), () => actions.transfer.repairState(), () => hasProject() && (advanced() || ctx.problemCodes.has('STATE_MISSING')));
  add('recover-import', tr('Unterbrochenen Vorgang wiederherstellen'), () => actions.transfer.recoverImport(), () => advanced() || ctx.pendingRecovery);
  return () => { for (const id of ids) plugin.removeCommand(id); };
}
