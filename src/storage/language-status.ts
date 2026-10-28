import type { VaultPort } from './vault-port';
import { text } from './vault-port';
import { parseLocalJson } from './local-json';
import { isObject } from '../exchange/parser';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

/** Prevents ordinary project writes while a cross-project folder change needs recovery. */
export async function assertLanguageReady(vault: VaultPort): Promise<void> {
  for (const file of vault.files().filter(file => /\/language-changes\/[^/]+\/journal\.json$/.test(file.path))) {
    const bytes = await vault.read(file.path), header = bytes ? parseLocalJson(text(bytes)) : null;
    if (!isObject(header) || !['committed', 'rolledBack'].includes(String(header['status']))) fail('LOCAL_CHANGED', tr('Der Sprachwechsel ist noch nicht abgeschlossen. Zuerst den unterbrochenen Vorgang wiederherstellen.'));
  }
}
