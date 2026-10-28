import { tr } from '../i18n/translate';
import { fail } from '../domain/diagnostics';
import { newId, sha256 } from '../exchange/hash';
import type { VaultPort } from './vault-port';
import { equalBytes, text, utf8 } from './vault-port';
import { safePath, collisionKey } from './paths';
import { loadJournal, type Journal, type JournalEntry } from './journal-format';
import { isObject } from '../exchange/parser';
import { parseLocalJson } from './local-json';
import { LayoutJournalService } from './layout-journal';
import { LanguageJournalService } from './language-journal';
import type { Settings } from '../projects/layout';

export interface Mutation { path: string; before: Uint8Array | null; after: Uint8Array; binary: boolean }
/** Sequential write-ahead journal; the prepared marker precedes every target mutation. */
export class JournalService {
  /** Binds visible-vault IO only; never calls a raw filesystem or remote service. */
  constructor(private readonly vault: VaultPort) {}
  /** Stages and commits a concrete plan, rolling back only our own after-images on failure. */
  async commit(root: string, projectId: string, changes: Mutation[]): Promise<string | null> {
    const writes = changes.filter(c => !c.before || !equalBytes(c.before, c.after));
    if (!writes.length) return null;
    const paths = new Set<string>();
    for (const c of writes) {
      safePath(c.path);
      const key = collisionKey(c.path);
      if (paths.has(key)) fail('IDENTITY_CONFLICT', tr('Schreibplan enthält kollidierende Pfade.'));
      paths.add(key);
    }
    const id = newId(), folder = safePath(`${root}/journal/${id}`), path = `${folder}/journal.json`;
    await this.vault.mkdir(folder);
    const journal: Journal = { journalVersion: 1, id, projectId, status: 'prepared', entries: [] };
    const pendingWrites = new Map<string, Uint8Array>();
    for (let i = 0; i < writes.length; i++) {
      const c = writes[i]!;
      const afterPath = `${folder}/${i}-after.bin`, beforePath = c.before ? `${folder}/${i}-before.bin` : null;
      await this.vault.create(afterPath, c.after, true);
      if (beforePath && c.before) await this.vault.create(beforePath, c.before, true);
      let pendingPath: string | null = null, pendingHash: string | null = null;
      if (c.path === `${root}/state.json`) {
        const state = parseLocalJson(text(c.after));
        if (!isObject(state) || state['projectId'] !== projectId) fail('PROJECT_MISMATCH', tr('Geplanter Zustand gehört nicht zum Projekt.'));
        state['pendingJournal'] = id;
        const pending = utf8(JSON.stringify(state, null, 2));
        pendingPath = `${folder}/${i}-pending.bin`; pendingHash = await sha256(pending);
        await this.vault.create(pendingPath, pending, true); pendingWrites.set(c.path, pending);
      }
      journal.entries.push({ path: c.path, binary: c.binary, beforeHash: c.before ? await sha256(c.before) : null,
        afterHash: await sha256(c.after), beforePath, afterPath, pendingHash, pendingPath });
    }
    await this.vault.create(path, utf8(JSON.stringify(journal)), false);
    try {
      // Recheck all preconditions before the first write, then each target at its CAS boundary.
      for (const c of writes) await this.assertBefore(c);
      for (const c of writes) await this.apply({ ...c, after: pendingWrites.get(c.path) ?? c.after });
      for (const c of writes) {
        const pending = pendingWrites.get(c.path);
        if (pending) await this.apply({ ...c, before: pending });
      }
      await this.setStatus(path, journal, 'committed');
    } catch (error) {
      await this.recover(path, projectId);
      throw error;
    }
    return id;
  }
  /** Recovers after crashes, including a crash after a target write but before any progress marker. */
  async recover(path: string, projectId: string): Promise<{ conflicts: string[]; settings?: Settings }> {
    const bytes = await this.vault.read(safePath(path));
    const header = bytes ? parseLocalJson(text(bytes)) : null;
    if (isObject(header) && header['kind'] === 'layout') return new LayoutJournalService(this.vault).recover(path, projectId);
    if (isObject(header) && header['kind'] === 'language' && projectId === 'language') return new LanguageJournalService(this.vault).recover(path);
    const journal = await loadJournal(this.vault, path, projectId);
    if (journal.status === 'committed' || journal.status === 'rolledBack') return { conflicts: [] };
    const conflicts: string[] = [];
    for (const entry of [...journal.entries].reverse()) {
      if (!await this.restore(entry)) conflicts.push(entry.path);
    }
    await this.setStatus(path, journal, conflicts.length ? 'recoveryConflict' : 'rolledBack');
    return { conflicts };
  }
  /** Reads and compares existence/content immediately before a write; never treats a collision as new. */
  private async assertBefore(change: Mutation): Promise<void> {
    const current = await this.vault.read(change.path);
    if (current === null ? change.before !== null : change.before === null || !equalBytes(current, change.before)) fail('LOCAL_CHANGED', tr('Datei seit der Vorschau geändert. Vorschau erneut erstellen.'));
    if (!change.before && this.vault.files().some(f => collisionKey(f.path) === collisionKey(change.path))) fail('IDENTITY_CONFLICT', tr('Dateipfad ist bereits belegt.'));
  }
  /** Existing text uses synchronous compare-and-swap; existing binary assets are immutable. */
  private async apply(change: Mutation): Promise<void> {
    await this.assertBefore(change);
    const parent = change.path.slice(0, change.path.lastIndexOf('/'));
    if (parent) await this.vault.mkdir(parent);
    if (!change.before) await this.vault.create(change.path, change.after, change.binary);
    else {
      if (change.binary) fail('INVALID_ASSET', tr('Vorhandene Bildbytes werden nicht überschrieben. Neues Asset aufnehmen.'));
      await this.vault.compareAndSwap(change.path, text(change.before), text(change.after));
    }
  }
  /** Restores only exact planned after-images; external post-edits remain untouched and reported. */
  private async restore(entry: JournalEntry): Promise<boolean> {
    const current = await this.vault.read(entry.path), currentHash = current ? await sha256(current) : null;
    if (currentHash === entry.beforeHash) return true;
    if ((currentHash !== entry.afterHash && currentHash !== entry.pendingHash) || !current) return false;
    if (entry.beforePath) {
      const before = await this.vault.read(entry.beforePath);
      if (!before || entry.binary) return false;
      await this.vault.compareAndSwap(entry.path, text(current), text(before));
    } else await this.vault.trash(entry.path, current);
    return true;
  }
  /** Journal transitions are CAS-protected; a changed journal is never silently overwritten. */
  private async setStatus(path: string, journal: Journal, status: Journal['status']): Promise<void> {
    const before = JSON.stringify(journal);
    journal.status = status;
    await this.vault.compareAndSwap(path, before, JSON.stringify(journal));
  }
}
