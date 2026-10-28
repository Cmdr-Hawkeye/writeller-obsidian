import { tr } from '../i18n/translate';
import type { VaultPort } from './vault-port';
import { text } from './vault-port';
import { isObject, parseJson } from '../exchange/parser';
import { loadJournal } from './journal-format';
import { fail } from '../domain/diagnostics';
import { loadLayoutJournal } from './layout-journal-format';
import { loadLanguageJournal } from './language-journal-format';

/** Discovers journals without requiring a surviving manifest after a failed new-project import. */
export async function pendingJournals(vault: VaultPort): Promise<{ path: string; projectId: string }[]> {
  const result: { path: string; projectId: string }[] = [];
  for (const file of vault.files().filter(f => /\/(?:journal|language-changes)\/[^/]+\/journal\.json$/.test(f.path))) {
    const bytes = await vault.read(file.path); if (!bytes) continue;
    const header = parseJson(text(bytes));
    if (!isObject(header) || typeof header['projectId'] !== 'string') fail('STATE_MISSING', tr('Journal ist beschädigt. Gesicherte Originale vor weiteren Vorgängen prüfen.'));
    if (header['status'] === 'committed' || header['status'] === 'rolledBack') continue;
    const journal = header['kind'] === 'language' ? await loadLanguageJournal(vault, file.path) : header['kind'] === 'layout' ? await loadLayoutJournal(vault, file.path, header['projectId']) : await loadJournal(vault, file.path, header['projectId']);
    if (journal.status === 'prepared' || journal.status === 'recoveryConflict') result.push({ path: file.path, projectId: journal.projectId });
  }
  return result;
}
