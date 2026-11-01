import type { VaultPort } from './vault-port';
import { text } from './vault-port';
import { parseLocalJson } from './local-json';
import { isObject } from '../exchange/parser';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

/** Blocks writes and snapshots while structural changes or a deletion still need recovery. */
export async function assertStructureReady(vault: VaultPort): Promise<void> {
  for (const file of vault.files().filter(file => /\/(?:language-changes|project-deletions)\/[^/]+\/journal\.json$/.test(file.path))) {
    const bytes = await vault.read(file.path), header = bytes ? parseLocalJson(text(bytes)) : null;
    if (!isObject(header) || !['committed', 'rolledBack'].includes(String(header['status']))) {
      fail('LOCAL_CHANGED', file.path.includes('/project-deletions/') ? tr('Ein Projekt wurde noch nicht vollständig gelöscht. Zuerst den unterbrochenen Vorgang wiederherstellen.') : tr('Der Sprachwechsel ist noch nicht abgeschlossen. Zuerst den unterbrochenen Vorgang wiederherstellen.'));
    }
  }
}
