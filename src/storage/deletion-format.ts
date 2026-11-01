import type { VaultPort } from './vault-port';
import { text } from './vault-port';
import { safePath, isBelow, collisionKey } from './paths';
import { parseLocalJson } from './local-json';
import { isObject } from '../exchange/parser';
import { sha256 } from '../exchange/hash';
import { parseManaged } from '../mapping/frontmatter';
import { decodeProjectState } from './state';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

export interface DeletionEntry { path: string; backup: string; hash: string }
export interface DeletionJournal { journalVersion: 1; kind: 'deletion'; id: string; projectId: string; root: string; manifest: string;
  status: 'prepared' | 'committed' | 'rolledBack' | 'recoveryConflict'; entries: DeletionEntry[] }
/** Keeps malformed deletion backups from authorizing restoration of unrelated files. */
function invalid(): never { fail('STATE_MISSING', tr('Die Sicherung zum Löschen ist beschädigt. Gesicherte Originale prüfen.')); }
/** Validates ownership, unique target paths and all available originals before any recovery write. */
export async function loadDeletionJournal(vault: VaultPort, path: string, projectId: string): Promise<DeletionJournal> {
  safePath(path); const bytes = await vault.read(path); if (!bytes) invalid();
  const value = parseLocalJson(text(bytes)), folder = path.slice(0, path.lastIndexOf('/'));
  if (!isObject(value) || value['journalVersion'] !== 1 || value['kind'] !== 'deletion' || value['projectId'] !== projectId ||
    typeof value['id'] !== 'string' || typeof value['root'] !== 'string' || typeof value['manifest'] !== 'string' ||
    !Array.isArray(value['entries']) || !['prepared', 'committed', 'rolledBack', 'recoveryConflict'].includes(String(value['status']))) invalid();
  const root = safePath(value['root']), manifest = safePath(value['manifest']);
  const parent = root.slice(0, root.lastIndexOf('/'));
  if (!root.endsWith('/' + await sha256(projectId)) || folder !== `${parent}/project-deletions/${value['id']}` || path !== `${folder}/journal.json`) invalid();
  // Completed deletion backups may already be in Obsidian's configured trash.
  if (value['status'] === 'committed' || value['status'] === 'rolledBack') return value as unknown as DeletionJournal;
  const targets = new Set<string>(); let stateFound = false, manifestFound = false;
  for (const [index, entry] of value['entries'].entries()) {
    if (!isObject(entry) || typeof entry['path'] !== 'string' || typeof entry['hash'] !== 'string' || entry['backup'] !== `${folder}/${index}-before.bin`) invalid();
    const target = safePath(entry['path']), key = collisionKey(target);
    if (targets.has(key) || isBelow(target, folder)) invalid(); targets.add(key);
    const original = await vault.read(entry['backup']); if (!original || await sha256(original) !== entry['hash']) invalid();
    if (isBelow(target, root)) {
      if (target === `${root}/state.json`) { decodeProjectState(text(original), projectId); stateFound = true; }
    } else {
      const note = target.endsWith('.md') ? parseManaged(target, text(original)) : null;
      if (!note || note.projectId !== projectId) invalid();
      if (target === manifest && note.collection === 'project' && note.id === projectId) manifestFound = true;
    }
  }
  if (!stateFound || !manifestFound) invalid();
  return value as unknown as DeletionJournal;
}
