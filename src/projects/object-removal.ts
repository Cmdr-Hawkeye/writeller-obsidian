import { tr } from '../i18n/translate';
import { clone, recordKey, setEntry } from '../domain/records';
import type { Entry } from '../domain/types';
import { fail } from '../domain/diagnostics';
import { detachReferences, invalidPov, missingTargets, type Detachment } from '../objects/detach';
import type { TransferCoordinator, CommitPreview } from '../transfer/coordinator';
import { snapshotProject, type Snapshot } from './snapshot';
import { NameAllocator } from './names';

/** A checked save plan plus the Markdown notes to move to the trash after it was committed. */
export interface RemovalPlan { preview: CommitPreview; detachment: Detachment; trash: string[]; restored: string[]; moved: string[] }

/** Marks removed records as locally deleted and lists their verified notes for the trash. */
function finish(service: TransferCoordinator, snapshot: Snapshot, detachment: Detachment): string[] {
  const projectId = snapshot.state.projectId, trash: string[] = [];
  for (const key of detachment.removed) {
    if (!snapshot.state.locallyDeleted.includes(key)) snapshot.state.locallyDeleted.push(key);
    const [collection, id] = [key.slice(0, key.indexOf('/')), key.slice(key.indexOf('/') + 1)] as [Entry['collection'], string];
    const note = service.index.find(projectId, collection, id);
    if (note) trash.push(note.path);
  }
  return trash;
}

/** Plans the regular deletion of one object: references are cleaned in the same checked save. */
export async function planObjectDeletion(service: TransferCoordinator, projectId: string, key: string): Promise<RemovalPlan> {
  const snapshot = await service.snapshot(projectId), entry = service.entry(snapshot, key);
  if (entry.collection === 'project') fail('INVALID_FIELD', tr('Projekte werden über „Projekt löschen“ entfernt.'));
  const pkg = clone(snapshot.exchange), detachment = detachReferences(pkg, [key]);
  const trash = finish(service, snapshot, detachment);
  return { preview: await service.previewSave(pkg, snapshot), detachment, trash, restored: [], moved: [] };
}

/** Finds references to objects that no longer exist, including those whose note was deleted by hand. */
export async function inspectReferences(service: TransferCoordinator, projectId: string): Promise<{ snapshot: Snapshot; missing: string[]; restorable: string[]; invalid: number }> {
  const snapshot = await snapshotProject(service.vault, service.index, projectId, true);
  const missing = [...missingTargets(snapshot.exchange)];
  return { snapshot, missing, restorable: missing.filter(k => snapshot.records.has(k)), invalid: invalidPov(snapshot.exchange).length };
}

/**
 * Repairs dangling references. `restore` brings deleted objects back from their preserved data
 * (as a new note next to a foreign file of the same name); everything not restorable is detached.
 */
export async function planReferenceRepair(service: TransferCoordinator, projectId: string, restore: boolean): Promise<RemovalPlan> {
  const { snapshot } = await inspectReferences(service, projectId), pkg = clone(snapshot.exchange), restored: string[] = [], moved: string[] = [];
  const occupied = new NameAllocator(service.vault.files().map(f => f.path));
  for (let pending = restore ? [...missingTargets(pkg)].filter(k => snapshot.records.has(k)) : []; pending.length; pending = [...missingTargets(pkg)].filter(k => snapshot.records.has(k) && !restored.includes(k))) {
    for (const key of pending) {
      const stored = snapshot.records.get(key)!;
      setEntry(pkg, { collection: stored.collection, record: clone(stored.record) } as Entry);
      snapshot.state.locallyDeleted = snapshot.state.locallyDeleted.filter(k => k !== key);
      const location = snapshot.state.records.find(r => recordKey(r.collection, r.id) === key);
      if (location && service.vault.files().some(f => f.path === location.notePath)) {
        const name = location.notePath.slice(location.notePath.lastIndexOf('/') + 1).replace(/\.md$/i, '');
        location.notePath = occupied.allocate(location.notePath.slice(0, location.notePath.lastIndexOf('/')), name, '.md'); moved.push(location.notePath);
      }
      restored.push(key);
    }
  }
  const detachment = detachReferences(pkg, missingTargets(pkg));
  const trash = finish(service, snapshot, detachment);
  return { preview: await service.previewSave(pkg, snapshot), detachment, trash, restored, moved };
}

/** Moves the removed objects' notes to the trash after the save, respecting the user's trash setting. */
export async function trashRemoved(service: TransferCoordinator, plan: RemovalPlan): Promise<void> {
  for (const path of plan.trash) {
    const bytes = await service.vault.read(path);
    if (bytes) await service.vault.trash(path, bytes);
    service.index.invalidate(path);
  }
  await service.index.refresh();
}
