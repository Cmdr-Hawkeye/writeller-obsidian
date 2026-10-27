import { isObject, parseJson } from '../exchange/parser';
import { fail } from '../domain/diagnostics';
import { sha256 } from '../exchange/hash';
import { collisionKey, safePath } from './paths';
import type { VaultPort } from './vault-port';
import { text } from './vault-port';

export interface JournalEntry {
  path: string; binary: boolean; beforeHash: string | null; afterHash: string;
  beforePath: string | null; afterPath: string;
  pendingHash: string | null; pendingPath: string | null;
}
export interface Journal { journalVersion: 1; id: string; projectId: string;
  status: 'prepared' | 'committed' | 'rolledBack' | 'recoveryConflict'; entries: JournalEntry[] }
/** Validates the entire journal and every backup before the first recovery write. */
export async function loadJournal(vault: VaultPort, path: string, projectId: string): Promise<Journal> {
  safePath(path);
  const projectHash = await sha256(projectId);
  if (!path.includes(`/${projectHash}/journal/`) || !path.endsWith('/journal.json')) fail('PROJECT_MISMATCH', 'Journal gehört nicht zum Projekt.');
  const bytes = await vault.read(path);
  if (!bytes) fail('STATE_MISSING', 'Journal fehlt. Gesicherte Originale unverändert prüfen.');
  const value = parseJson(text(bytes));
  if (!isObject(value) || value['kind'] !== undefined || value['journalVersion'] !== 1 || value['projectId'] !== projectId || typeof value['id'] !== 'string' ||
    !['prepared', 'committed', 'rolledBack', 'recoveryConflict'].includes(String(value['status'])) || !Array.isArray(value['entries'])) fail('STATE_MISSING', 'Beschädigtes Journal. Keine automatische Wiederherstellung.');
  const folder = path.slice(0, path.lastIndexOf('/'));
  if (!folder.endsWith('/' + value['id'])) fail('STATE_MISSING', 'Journal-ID stimmt nicht mit dem Ordner überein.');
  const seen = new Set<string>();
  for (const e of value['entries']) {
    if (!isObject(e) || typeof e['path'] !== 'string' || typeof e['binary'] !== 'boolean' || typeof e['afterPath'] !== 'string' ||
      typeof e['afterHash'] !== 'string' || !(e['beforePath'] === null || typeof e['beforePath'] === 'string') ||
      !(e['beforeHash'] === null || typeof e['beforeHash'] === 'string') ||
      !(e['pendingPath'] === null || typeof e['pendingPath'] === 'string') ||
      !(e['pendingHash'] === null || typeof e['pendingHash'] === 'string')) fail('STATE_MISSING', 'Ungültiger Journaleintrag.');
    safePath(e['path']);
    if (e['path'].includes('/journal/') || seen.has(collisionKey(e['path']))) fail('STATE_MISSING', 'Kollidierendes Journalziel.');
    seen.add(collisionKey(e['path']));
    for (const [field, hashField] of [['afterPath', 'afterHash'], ['beforePath', 'beforeHash'], ['pendingPath', 'pendingHash']] as const) {
      const dataPath = e[field], hash = e[hashField];
      if (dataPath === null && hash === null) continue;
      if (typeof dataPath !== 'string' || !dataPath.startsWith(folder + '/') || !/^\d+-(?:before|after|pending)\.bin$/.test(dataPath.slice(folder.length + 1))) fail('STATE_MISSING', 'Unsicherer Journal-Sicherungspfad.');
      const backup = await vault.read(safePath(dataPath));
      if (!backup || await sha256(backup) !== hash) fail('STATE_MISSING', 'Journal-Sicherung fehlt oder Hash ist beschädigt.');
    }
  }
  return value as unknown as Journal;
}
