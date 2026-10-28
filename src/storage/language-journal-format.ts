import type { Settings } from '../projects/layout';
import { relocate, relocateLinks, type FolderMove } from '../projects/relocation';
import { folderRole } from '../i18n/folders';
import type { VaultPort } from './vault-port';
import { text, equalBytes, utf8 } from './vault-port';
import { safePath, isBelow } from './paths';
import { parseLocalJson } from './local-json';
import { isObject } from '../exchange/parser';
import { sha256, jcs } from '../exchange/hash';
import { splitNote, parseManaged } from '../mapping/frontmatter';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

export interface LanguageBackup { path: string; backup: string; hash: string }
export interface LanguageJournal { journalVersion: 1; kind: 'language'; projectId: 'language'; id: string;
  status: 'prepared' | 'committed' | 'rolledBack' | 'recoveryConflict'; moves: FolderMove[]; originals: LanguageBackup[];
  writes: { from: string; path: string; before: string; after: string; beforeHash: string; afterHash: string }[]; settingsBefore: Settings }
/** Rejects malformed or foreign backup data before any recovery action can run. */
function invalid(): never { fail('STATE_MISSING', tr('Ungültige Sicherung des Sprachwechsels.')); }
/** Checks that a proposed write is strictly a path relocation, never a manuscript or identity edit. */
function validWrite(path: string, before: Uint8Array, after: Uint8Array, moves: FolderMove[], originals: Map<string, Uint8Array>): boolean {
  if (path.endsWith('.md')) {
    const note = splitNote(text(before)); return equalBytes(after, utf8(note.header + relocateLinks(note.body, moves)));
  }
  if (!/\/[a-f0-9]{64}\/(?:state\.json|records\/[a-zA-Z]+\/[a-f0-9]{64}\.json)$/.test(path)) return false;
  const previous = parseLocalJson(text(before)), next = parseLocalJson(text(after)); if (!isObject(previous)) return false;
  const expected = structuredClone(previous);
  if (typeof expected['manifestPath'] === 'string' && Array.isArray(expected['records'])) {
    const notes = [...originals].filter(([path]) => path.endsWith('.md')).map(([path, bytes]) => parseManaged(path, text(bytes))).filter(note => note?.projectId === expected['projectId']);
    expected['manifestPath'] = relocate(notes.find(note => note?.collection === 'project')?.path ?? expected['manifestPath'], moves);
    for (const entry of expected['records']) {
      if (!isObject(entry) || typeof entry['notePath'] !== 'string') return false;
      const note = notes.find(note => note && note.collection === entry['collection'] && note.id === entry['id']);
      entry['notePath'] = relocate(note?.path ?? entry['notePath'], moves);
    }
  } else if (isObject(expected['projection']) && typeof expected['projection']['body'] === 'string' && Array.isArray(expected['projection']['links'])) {
    expected['projection']['body'] = relocateLinks(expected['projection']['body'], moves);
    for (const link of expected['projection']['links']) { if (!isObject(link) || typeof link['localPath'] !== 'string') return false; link['localPath'] = relocate(link['localPath'], moves); }
  } else return false;
  return jcs(expected) === jcs(next);
}
/** Reads bounded JSON, whitelists folder role changes and verifies every backup hash/transformation. */
export async function loadLanguageJournal(vault: VaultPort, path: string): Promise<LanguageJournal> {
  safePath(path); const bytes = await vault.read(path); if (!bytes) invalid();
  const value = parseLocalJson(text(bytes)), folder = path.slice(0, path.lastIndexOf('/'));
  if (!isObject(value) || value['journalVersion'] !== 1 || value['kind'] !== 'language' || value['projectId'] !== 'language' || typeof value['id'] !== 'string' ||
    !folder.endsWith('/language-changes/' + value['id']) || !path.endsWith('/journal.json') || !Array.isArray(value['moves']) || !Array.isArray(value['originals']) || !Array.isArray(value['writes']) ||
    !['prepared', 'committed', 'rolledBack', 'recoveryConflict'].includes(String(value['status'])) || !isObject(value['settingsBefore'])) invalid();
  const settings = value['settingsBefore'];
  for (const key of ['projectFolder', 'dataFolder', 'exchangeFolder']) { if (typeof settings[key] !== 'string') invalid(); safePath(settings[key]); }
  if (!path.startsWith(settings['dataFolder'] + '/language-changes/') || !['de', 'en', 'auto'].includes(String(settings['language'])) || typeof settings['showTechnicalInfo'] !== 'boolean') invalid();
  if (settings['folderLanguage'] !== undefined && settings['folderLanguage'] !== 'de' && settings['folderLanguage'] !== 'en') invalid();
  const moves: FolderMove[] = [], targets = new Set<string>();
  for (const item of value['moves']) {
    if (!isObject(item) || typeof item['from'] !== 'string' || typeof item['to'] !== 'string') invalid();
    const from = safePath(item['from']), to = safePath(item['to']), role = folderRole(from.split('/').at(-1)!);
    if (!role || role !== folderRole(to.split('/').at(-1)!) || from === to || from.split('/').slice(0, -1).join('/') !== to.split('/').slice(0, -1).join('/') || targets.has(to)) invalid();
    if (isBelow(from, String(settings['dataFolder'])) || isBelow(to, String(settings['dataFolder']))) invalid();
    targets.add(to); moves.push({ from, to });
  }
  const originalPaths = new Map<string, Uint8Array>();
  const backup = async (path: unknown, hash: unknown): Promise<Uint8Array> => {
    if (typeof path !== 'string' || !path.startsWith(folder + '/') || !/^\d+-(?:original|after)\.bin$/.test(path.slice(folder.length + 1)) || typeof hash !== 'string') invalid();
    const data = await vault.read(safePath(path)); if (!data || await sha256(data) !== hash) invalid(); return data;
  };
  for (const item of value['originals']) {
    if (!isObject(item) || typeof item['path'] !== 'string' || originalPaths.has(item['path']) || item['path'].startsWith(folder + '/')) invalid();
    originalPaths.set(safePath(item['path']), await backup(item['backup'], item['hash']));
  }
  const writes = new Set<string>();
  for (const item of value['writes']) {
    if (!isObject(item) || typeof item['from'] !== 'string' || typeof item['path'] !== 'string' || relocate(item['from'], moves) !== item['path'] || writes.has(item['path'])) invalid();
    writes.add(item['path']); safePath(item['path']);
    const before = await backup(item['before'], item['beforeHash']), after = await backup(item['after'], item['afterHash']);
    if (!originalPaths.has(item['from']) || !equalBytes(originalPaths.get(item['from'])!, before) || !validWrite(item['from'], before, after, moves, originalPaths)) invalid();
  }
  return value as unknown as LanguageJournal;
}
