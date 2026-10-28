import { isObject } from '../exchange/parser';
import { parseLocalJson } from './local-json';
import { safePath } from './paths';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

/** Verifies completion metadata without reopening historical before/after images on every edit. */
export function projectJournalHeader(source: string, path: string, projectId: string, projectHash: string): { final: boolean; layout: boolean } {
  const header = parseLocalJson(source); safePath(path);
  if (!isObject(header) || header['journalVersion'] !== 1 || header['projectId'] !== projectId || typeof header['id'] !== 'string' ||
    !path.endsWith(`/${projectHash}/journal/${header['id']}/journal.json`) ||
    !['prepared', 'committed', 'rolledBack', 'recoveryConflict'].includes(String(header['status'])) ||
    !(header['kind'] === undefined && Array.isArray(header['entries']) || header['kind'] === 'layout' && Array.isArray(header['moves']) && Array.isArray(header['writes']))) {
    fail('STATE_MISSING', tr('Beschädigtes Journal. Keine automatische Wiederherstellung.'));
  }
  return { final: header['status'] === 'committed' || header['status'] === 'rolledBack', layout: header['kind'] === 'layout' };
}
