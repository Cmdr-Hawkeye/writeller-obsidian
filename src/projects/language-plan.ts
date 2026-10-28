import type { Settings } from './layout';
import type { Snapshot } from './snapshot';
import type { TransferCoordinator } from '../transfer/coordinator';

import { text, utf8, equalBytes } from '../storage/vault-port';
import { collisionKey } from '../storage/paths';
import { folderName, folderRole, translatedRoot } from '../i18n/folders';
import type { Language } from '../i18n/language';

import { splitNote } from '../mapping/frontmatter';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';
import { pendingJournals } from '../storage/recovery-index';
import { parseLocalJson } from '../storage/local-json';
import type { ProjectState } from '../storage/state-types';

import { relocate, relocateLinks, visibleFolders, type FolderMove } from './relocation';
export { relocate, relocateLinks, visibleFolders, type FolderMove } from './relocation';
export interface LanguageWrite { from: string; path: string; before: Uint8Array; after: Uint8Array }
export interface LanguagePlan { moves: FolderMove[]; writes: LanguageWrite[]; guards: Map<string, Uint8Array>; folders: string[]; settings: Settings }
/** Plans category folders beside actual manifests, leaving chapter titles and custom subfolders intact. */
export async function planLanguage(service: TransferCoordinator, locale: Language): Promise<LanguagePlan> {
  if ((await pendingJournals(service.vault)).length) fail('LOCAL_CHANGED', tr('Der Sprachwechsel ist noch nicht abgeschlossen. Zuerst den unterbrochenen Vorgang wiederherstellen.'));
  await service.index.rebuild(); service.index.assertClean();
  const snapshots: Snapshot[] = [];
  for (const note of service.index.manifests()) snapshots.push(await service.snapshot(note.projectId));
  const folders = visibleFolders(service.vault), moves: FolderMove[] = [], bases = snapshots.map(s => s.state.manifestPath.split('/').slice(0, -1).join('/'));
  const add = (from: string, to: string): void => {
    if (from === to || moves.some(move => move.from === from) || !folders.includes(from)) return;
    if (folders.some(path => collisionKey(path) === collisionKey(to)) || service.vault.files().some(file => collisionKey(file.path) === collisionKey(to))) fail('LOCAL_CHANGED', tr`Zielordner ist bereits vorhanden: ${to}`);
    moves.push({ from, to });
  };
  for (const base of bases.filter(Boolean)) for (const path of folders.filter(path => path.startsWith(base + '/'))) {
    if (bases.includes(path)) continue;
    const relative = path.slice(base.length + 1).split('/'), role = folderRole(relative[0] ?? '');
    if (relative.length === 1 && role && !['projects', 'exports', 'unassigned'].includes(role)) add(path, `${base}/${folderName(role, locale)}`);
    if (relative.length === 2 && role === 'manuscript' && folderRole(relative[1]!) === 'unassigned') add(path, `${base}/${relative[0]}/${folderName('unassigned', locale)}`);
  }
  moves.sort((a, b) => b.from.split('/').length - a.from.split('/').length || a.from.localeCompare(b.from));
  const settings = { ...service.settings, projectFolder: translatedRoot(service.settings.projectFolder, 'projects', locale),
    exchangeFolder: translatedRoot(service.settings.exchangeFolder, 'exports', locale), folderLanguage: locale };
  add(service.settings.projectFolder, settings.projectFolder); add(service.settings.exchangeFolder, settings.exchangeFolder);
  const guards = new Map<string, Uint8Array>(), writes: LanguageWrite[] = [];
  const write = (from: string, before: Uint8Array, after: Uint8Array): void => {
    guards.set(from, before); if (!equalBytes(before, after)) writes.push({ from, path: relocate(from, moves), before, after });
  };
  for (const snapshot of snapshots) {
    for (const [path, bytes] of snapshot.files) guards.set(path, bytes);
    // The snapshot has already validated this state. Change paths only, retaining even stale
    // deletion/history fields; actual indexed identities account for earlier native moves.
    const state = parseLocalJson(text(snapshot.files.get(snapshot.statePath)!)) as unknown as ProjectState;
    state.manifestPath = relocate(snapshot.state.manifestPath, moves);
    for (const location of state.records) {
      const current = snapshot.state.records.find(record => record.collection === location.collection && record.id === location.id);
      location.notePath = relocate(current?.notePath ?? location.notePath, moves);
    }
    write(snapshot.statePath, snapshot.files.get(snapshot.statePath)!, utf8(JSON.stringify(state, null, 2)));
    for (const location of snapshot.state.records) {
      const bytes = snapshot.files.get(location.sidecarPath); if (!bytes) continue;
      const stored = structuredClone(snapshot.records.get(`${location.collection}/${location.id}`));
      if (stored?.projection) {
        stored.projection.body = relocateLinks(stored.projection.body, moves);
        for (const link of stored.projection.links) link.localPath = relocate(link.localPath, moves);
        write(location.sidecarPath, bytes, utf8(JSON.stringify(stored, null, 2)));
      }
    }
  }
  for (const file of service.vault.files().filter(file => relocate(file.path, moves) !== file.path)) {
    const bytes = await service.vault.read(file.path); if (!bytes) fail('LOCAL_CHANGED', tr('Ordner wurden seit der Vorschau verändert. Bitte erneut versuchen.'));
    guards.set(file.path, bytes);
  }
  for (const [path, bytes] of guards) if (path.endsWith('.md')) {
    const note = splitNote(text(bytes)); write(path, bytes, utf8(note.header + relocateLinks(note.body, moves)));
  }
  return { moves, writes, guards, folders, settings };
}
