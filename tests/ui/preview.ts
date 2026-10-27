import type { WorkspaceLeaf } from 'obsidian';
import { installDomHelpers, createUiApp } from '../helpers/obsidian-ui';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import { CommandContext } from '../../src/ui/command-context';
import { WritingCommands } from '../../src/ui/writing-commands';
import { TransferCommands } from '../../src/ui/transfer-commands';
import { WritingProjectView } from '../../src/ui/project-view';
import { technicalFolderCss } from '../../src/obsidian/presentation';
import { exportFoldersToHide } from '../../src/projects/export-location';
import { utf8 } from '../../src/storage/vault-port';

// Browser preview of the actual production components in an explicit API-fake host.
installDomHelpers(window);
const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
const pkg = createProject('Mein erstes Buch'); pkg.project.description = 'Eine Geschichte über Ankunft, Vertrauen und einen neuen Anfang.'; pkg.project.wordTarget = 40000;
const chapter = createRecord('chapters', pkg.project.id, pkg.producer.instanceId, 'Die Ankunft'); setEntry(pkg, chapter);
for (const [index, name] of ['Nebel am Hafen', 'Eine unerwartete Begegnung'].entries()) {
  const entry = createRecord('scenes', pkg.project.id, pkg.producer.instanceId, name);
  if (entry.collection !== 'scenes') throw new Error('Preview invariant');
  entry.record.chapterId = chapter.record.id; entry.record.orderIndex = index;
  entry.record.content.text = index ? '' : 'Der Nebel lag über dem Wasser. Lina zog ihren Mantel enger und suchte zwischen den schaukelnden Booten nach dem alten Leuchtturm. Irgendwo schlug eine Glocke.';
  setEntry(pkg, entry);
}
for (const [type, name, summary] of [['character', 'Lina', 'Findet ihren Weg zurück zum Hafen.'], ['location', 'Alter Hafen', 'Ein Ort zwischen Abschied und Aufbruch.'], ['object', 'Kompass', 'Eine Erinnerung an die letzte Reise.']]) {
  const entry = createRecord('catalogItems', pkg.project.id, pkg.producer.instanceId, name!, { type: type! });
  if ('summary' in entry.record) entry.record.summary = summary!; setEntry(pkg, entry);
}
await service.commit(await service.previewSave(pkg, null));
// Non-Markdown export files reproduce the native explorer's apparently empty transport roots.
vault.data.set('Writeller Austausch/Beispiel.writeller-exchange.json', utf8('{}'));
vault.data.set('Exporte/Beispiel.writeller-exchange.json', utf8('{}'));
const { app } = createUiApp(vault), ctx = new CommandContext(app, service), writing = new WritingCommands(ctx), transfer = new TransferCommands(ctx);
ctx.selectedProjectId = pkg.project.id;
const shell = document.body.createDiv({ cls: 'preview-shell' });
const tree = shell.createDiv({ cls: 'workspace-leaf-content preview-tree', attr: { 'data-type': 'file-explorer', 'aria-label': 'Dateien im Test-Vault' } });
const view = new WritingProjectView({} as WorkspaceLeaf, ctx, writing, transfer, action => { void action().catch(e => ctx.report(e)); }, {
  inspect: async () => {}, advanced: async () => {}, organize: async () => {}, recover: async () => {}
});
shell.append(view.contentEl);
const style = document.head.createEl('style'); style.textContent = technicalFolderCss(['Writeller-Daten', ...exportFoldersToHide(vault, defaultSettings)]);
/** Renders an explorer fixture so the shipped hide-folder selector is tested in the browser. */
function refreshTree(): void {
  tree.empty(); tree.createDiv({ cls: 'preview-tree-heading', text: 'Dateien' });
  const parents = new Map<string, HTMLElement>([['', tree]]);
  for (const file of vault.files().sort((a, b) => a.path.localeCompare(b.path, 'de'))) {
    const parts = file.path.split('/'); let path = '';
    for (const [index, part] of parts.entries()) {
      const parent = parents.get(path)!; path = path ? path + '/' + part : part;
      if (index === parts.length - 1) parent.createDiv({ cls: 'preview-file', text: part.replace(/\.md$/, '') });
      else if (!parents.has(path)) {
        const folder = parent.createDiv({ cls: 'nav-folder' }); folder.createDiv({ cls: 'nav-folder-title', text: part, attr: { 'data-path': path } });
        parents.set(path, folder.createDiv({ cls: 'nav-folder-children' }));
      }
    }
  }
}
ctx.changed.add(refreshTree); refreshTree(); await view.onOpen();
// Test-host event only: exercise an asynchronous refresh between native browser mouse events.
document.addEventListener('writeller-test-refresh', () => { void view.refresh().then(() => document.documentElement.dataset.refreshFinished = 'true'); });
document.documentElement.dataset.previewReady = 'true';
