import type { TransferCoordinator } from '../transfer/coordinator';
import { assertDeletionFresh, type DeletionPlan } from '../projects/deletion';
import type { VaultPort } from './vault-port';
import { equalBytes, utf8 } from './vault-port';
import { loadDeletionJournal, type DeletionJournal } from './deletion-format';
import { newId, sha256 } from '../exchange/hash';

/** Write-ahead originals make a partially trashed project recoverable without its manifest. */
export class DeletionJournalService {
  /** Uses native trash preferences through the same checked adapter as other recovery operations. */
  constructor(private readonly vault: VaultPort) {}
  /** Backs up every target before removal; the manifest is removed last and no foreign files are swept. */
  async commit(service: TransferCoordinator, plan: DeletionPlan): Promise<void> {
    await assertDeletionFresh(service, plan);
    const id = newId(), parent = plan.snapshot.root.slice(0, plan.snapshot.root.lastIndexOf('/'));
    const folder = `${parent}/project-deletions/${id}`, path = `${folder}/journal.json`;
    const journal: DeletionJournal = { journalVersion: 1, kind: 'deletion', id, projectId: plan.snapshot.state.projectId,
      root: plan.snapshot.root, manifest: plan.snapshot.state.manifestPath, status: 'prepared', entries: [] };
    await this.vault.mkdir(folder);
    const files = [...plan.files].sort(([a], [b]) => Number(a === journal.manifest) - Number(b === journal.manifest));
    try {
      for (const [index, [target, bytes]] of files.entries()) {
        const backup = `${folder}/${index}-before.bin`, hash = await sha256(bytes);
        await this.vault.create(backup, bytes, true); journal.entries.push({ path: target, backup, hash });
      }
      // Backup creation can take time: never act on a preview that became stale meanwhile.
      await assertDeletionFresh(service, plan);
      await this.vault.create(path, utf8(JSON.stringify(journal)), false);
    } catch (error) {
      // A host may report an error after persisting the marker: never remove its originals.
      if (!await this.vault.read(path)) await this.cleanup(journal);
      throw error;
    }
    try {
      for (const [target, bytes] of files) await this.vault.trash(target, bytes);
      await this.status(path, journal, 'committed');
    } catch (error) { await this.recover(path, journal.projectId); throw error; }
    service.index.invalidate(); await service.index.refresh();
    for (const target of plan.folders.sort((a, b) => b.length - a.length)) {
      try { await this.vault.removeEmptyFolder?.(target); } catch { /* Optional cleanup never recursively removes remaining content. */ }
    }
    await this.cleanup(journal);
  }
  /** Restores missing originals exclusively; later edits and occupied folder paths remain conflicts. */
  async recover(path: string, projectId: string): Promise<{ conflicts: string[] }> {
    const journal = await loadDeletionJournal(this.vault, path, projectId), conflicts: string[] = [];
    if (journal.status === 'committed' || journal.status === 'rolledBack') return { conflicts };
    // Restore the manifest last so an interrupted recovery still advertises a pending operation.
    for (const entry of journal.entries) {
      const before = (await this.vault.read(entry.backup))!, current = await this.vault.read(entry.path);
      if (current) { if (!equalBytes(current, before)) conflicts.push(entry.path); continue; }
      try {
        const parent = entry.path.slice(0, entry.path.lastIndexOf('/')); if (parent) await this.vault.mkdir(parent);
        await this.vault.create(entry.path, before, true);
      } catch { conflicts.push(entry.path); }
    }
    await this.status(path, journal, conflicts.length ? 'recoveryConflict' : 'rolledBack');
    if (!conflicts.length) await this.cleanup(journal);
    return { conflicts };
  }
  /** Makes completion durable before originals can leave the live vault. */
  private async status(path: string, journal: DeletionJournal, status: DeletionJournal['status']): Promise<void> {
    const before = JSON.stringify(journal); journal.status = status;
    await this.vault.compareAndSwap(path, before, JSON.stringify(journal));
  }
  /** Removes temporary manuscript backups through user-selected trash after a durable final status. */
  private async cleanup(journal: DeletionJournal): Promise<void> {
    let complete = true;
    for (const entry of journal.entries) {
      try {
        const bytes = await this.vault.read(entry.backup);
        if (bytes) {
          if (await sha256(bytes) !== entry.hash) { complete = false; continue; }
          await this.vault.trash(entry.backup, bytes);
        }
      } catch { complete = false; /* Retain an inaccessible original rather than reporting a false deletion failure. */ }
    }
    if (complete && journal.status !== 'prepared' && journal.status !== 'recoveryConflict') {
      const folder = journal.entries[0]?.backup.split('/').slice(0, -1).join('/');
      if (!folder) return;
      try {
        await this.vault.trash(`${folder}/journal.json`, utf8(JSON.stringify(journal)));
        await this.vault.removeEmptyFolder?.(folder);
        await this.vault.removeEmptyFolder?.(folder.split('/').slice(0, -1).join('/'));
      } catch { /* Completed metadata may remain if native trash or empty-folder cleanup is unavailable. */ }
    }
  }
}
