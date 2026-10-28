import type { ProjectIndex } from './index';
import type { VaultPort } from '../storage/vault-port';
import { isBelow } from '../storage/paths';

/** Lightweight display key only. Unknown stat tokens disable this optimization, never write guards. */
export async function viewRevision(vault: VaultPort, index: ProjectIndex, projectId: string): Promise<string | null> {
  const manifest = index.find(projectId, 'project', projectId); if (!manifest) return null;
  const base = manifest.path.split('/').slice(0, -1).join('/'), hint = manifest.properties['writeller-state-path'];
  const data = typeof hint === 'string' ? hint.slice(0, hint.lastIndexOf('/')) : '';
  const files = vault.files().filter(file =>
    file.markdown && (file.path === manifest.path || base && isBelow(file.path, base)) ||
    data && isBelow(file.path, data) && !file.path.includes('/journal/') ||
    /\/(?:journal|language-changes)\/[^/]+\/journal\.json$/.test(file.path));
  if (files.some(file => file.version === undefined)) return null;
  return JSON.stringify([index.eventRevision, await index.fingerprint(), files.map(file => [file.path, file.version]).sort((a, b) => a[0]!.localeCompare(b[0]!))]);
}
