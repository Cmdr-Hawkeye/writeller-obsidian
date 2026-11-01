import type { TransferCoordinator } from '../transfer/coordinator';
import type { Snapshot } from './snapshot';
import { assertNoPending } from './snapshot';
import { visibleFolders } from './relocation';
import { isBelow } from '../storage/paths';
import { equalBytes } from '../storage/vault-port';
import { assertStructureReady } from '../storage/operation-status';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

export interface DeletionPlan { snapshot: Snapshot; fingerprint: string; files: Map<string, Uint8Array>; folders: string[]; noteCount: number }
/** Inventories only identity-owned notes and the verified project's private data tree. */
export async function planDeletion(service: TransferCoordinator, projectId: string): Promise<DeletionPlan> {
  const snapshot = await service.snapshot(projectId), notes = service.index.notes.filter(note => note.projectId === projectId);
  if (service.index.notes.some(note => note.projectId !== projectId && isBelow(note.path, snapshot.root))) {
    fail('PROJECT_MISMATCH', tr('Im Projektdatenordner liegt eine Notiz eines anderen Projekts. Vor dem Löschen verschieben.'));
  }
  const paths = new Set([...notes.map(note => note.path), ...service.vault.files().filter(file => isBelow(file.path, snapshot.root)).map(file => file.path)]);
  const files = new Map<string, Uint8Array>(); let size = 0;
  for (const path of paths) {
    const bytes = await service.vault.read(path);
    if (!bytes) fail('LOCAL_CHANGED', tr('Datei seit der Vorschau geändert. Vorschau erneut erstellen.'));
    size += bytes.length;
    if (size > 512 * 1024 ** 2) fail('LIMIT_EXCEEDED', tr('Die Löschsicherung überschreitet 512 MiB. Projekt extern sichern und manuell entfernen.'));
    files.set(path, bytes);
  }
  const base = snapshot.state.manifestPath.split('/').slice(0, -1).join('/');
  const folders = visibleFolders(service.vault).filter(path => path === snapshot.root || isBelow(path, snapshot.root) || base && (path === base || isBelow(path, base)));
  return { snapshot, fingerprint: await service.index.fingerprint(), files, folders, noteCount: notes.length };
}
/** Rechecks actual source bytes, identities and the private data inventory before removing anything. */
export async function assertDeletionFresh(service: TransferCoordinator, plan: DeletionPlan): Promise<void> {
  await assertStructureReady(service.vault);
  await assertNoPending(service.vault, plan.snapshot.root, plan.snapshot.state.projectId);
  await service.index.rebuild(); service.index.assertClean();
  if (await service.index.fingerprint() !== plan.fingerprint || service.vault.files().some(file => isBelow(file.path, plan.snapshot.root) && !plan.files.has(file.path))) {
    fail('LOCAL_CHANGED', tr('Datei seit der Vorschau geändert. Vorschau erneut erstellen.'));
  }
  for (const [path, bytes] of plan.files) {
    const current = await service.vault.read(path);
    if (!current || !equalBytes(bytes, current)) fail('LOCAL_CHANGED', tr('Datei seit der Vorschau geändert. Vorschau erneut erstellen.'));
  }
}
