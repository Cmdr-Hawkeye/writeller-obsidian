import type { VaultPort } from './vault-port';
import { text } from './vault-port';
import { parseLocalJson } from './local-json';
import { isObject } from '../exchange/parser';
import { safePath, collisionKey } from './paths';
import { sha256 } from '../exchange/hash';
import { fail } from '../domain/diagnostics';
import { parseManaged } from '../mapping/frontmatter';

export interface LayoutJournalMove { from: string; to: string; hash: string; backup: string }
export interface LayoutJournalWrite { path: string; beforeHash: string; afterHash: string; before: string; after: string }
export interface LayoutJournal { journalVersion: 1; kind: 'layout'; id: string; projectId: string;
  status: 'prepared' | 'committed' | 'rolledBack' | 'recoveryConflict'; moves: LayoutJournalMove[]; writes: LayoutJournalWrite[] }
/** Validates all path and backup hashes before any layout rollback may modify a target. */
export async function loadLayoutJournal(vault: VaultPort, path: string, projectId: string): Promise<LayoutJournal> {
  safePath(path);
  if (!path.includes(`/${await sha256(projectId)}/journal/`) || !path.endsWith('/journal.json')) fail('PROJECT_MISMATCH', 'Die Sicherung gehört nicht zu diesem Projekt.');
  const bytes = await vault.read(path); if (!bytes) fail('STATE_MISSING', 'Die Sicherung zum Umordnen fehlt.');
  const value = parseLocalJson(text(bytes)), folder = path.slice(0, path.lastIndexOf('/'));
  if (!isObject(value) || value['kind'] !== 'layout' || value['journalVersion'] !== 1 || value['projectId'] !== projectId ||
    typeof value['id'] !== 'string' || !folder.endsWith('/' + value['id']) || !Array.isArray(value['moves']) || !Array.isArray(value['writes']) ||
    !['prepared', 'committed', 'rolledBack', 'recoveryConflict'].includes(String(value['status']))) fail('STATE_MISSING', 'Die Sicherung zum Umordnen ist beschädigt.');
  const targets = new Set<string>();
  const root = path.slice(0, path.lastIndexOf('/journal/'));
  const backup = async (data: unknown, hash: unknown): Promise<Uint8Array> => {
    if (typeof data !== 'string' || !data.startsWith(folder + '/') || !/^\d+-(?:move|before|after)\.bin$/.test(data.slice(folder.length + 1))) fail('STATE_MISSING', 'Ungültiger Sicherungspfad.');
    const saved = await vault.read(safePath(data));
    if (!saved || await sha256(saved) !== hash) fail('STATE_MISSING', 'Eine Originalsicherung fehlt oder ist beschädigt.');
    return saved;
  };
  for (const m of value['moves']) {
    if (!isObject(m) || typeof m['from'] !== 'string' || typeof m['to'] !== 'string' || typeof m['hash'] !== 'string') fail('STATE_MISSING', 'Ungültige Umbenennung.');
    safePath(m['from']); safePath(m['to']);
    if (m['from'].includes('/journal/') || m['to'].includes('/journal/') || targets.has(collisionKey(m['to']))) fail('STATE_MISSING', 'Kollidierendes Umbenennungsziel.');
    targets.add(collisionKey(m['to']));
    const note = parseManaged(m['from'], text(await backup(m['backup'], m['hash'])));
    if (!note || note.projectId !== projectId || !m['to'].endsWith('.md')) fail('PROJECT_MISMATCH', 'Die umzubenennende Notiz gehört nicht zu diesem Projekt.');
  }
  const written = new Set<string>();
  for (const w of value['writes']) {
    if (!isObject(w) || typeof w['path'] !== 'string' || typeof w['beforeHash'] !== 'string' || typeof w['afterHash'] !== 'string') fail('STATE_MISSING', 'Ungültige Änderungsdaten.');
    safePath(w['path']);
    if (w['path'].includes('/journal/') || written.has(collisionKey(w['path']))) fail('STATE_MISSING', 'Kollidierende Änderungsdaten.');
    written.add(collisionKey(w['path']));
    const before = await backup(w['before'], w['beforeHash']), after = await backup(w['after'], w['afterHash']);
    if (w['path'].endsWith('.md')) {
      const a = parseManaged(w['path'], text(before)), b = parseManaged(w['path'], text(after));
      if (!a || !b || a.projectId !== projectId || b.projectId !== projectId || a.id !== b.id || a.collection !== b.collection) fail('PROJECT_MISMATCH', 'Eine Notizsicherung hat abweichende Zuordnungen.');
    } else if (w['path'] !== `${root}/state.json` && !w['path'].startsWith(`${root}/records/`)) fail('PROJECT_MISMATCH', 'Eine Sicherung zeigt außerhalb der Projekteigendaten.');
  }
  return value as unknown as LayoutJournal;
}
