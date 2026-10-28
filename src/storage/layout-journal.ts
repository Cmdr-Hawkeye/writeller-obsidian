import { tr } from '../i18n/translate';
import type { OrganizePlan } from '../projects/organize-plan';
import type { VaultPort } from './vault-port';
import { text, utf8 } from './vault-port';
import { newId, sha256 } from '../exchange/hash';
import { fail } from '../domain/diagnostics';
import { loadLayoutJournal, type LayoutJournal } from './layout-journal-format';
import { parseManaged } from '../mapping/frontmatter';

/** Small dedicated rename journal: the exact original notes remain backed up before moving files. */
export class LayoutJournalService {
  /** Uses only the same checked, replaceable Vault port as ordinary writes. */
  constructor(private readonly vault: VaultPort) {}
  /** Applies an already confirmed path plan; partial failures remain conservatively recoverable. */
  async commit(plan: OrganizePlan): Promise<void> {
    if (!plan.moves.length && !plan.writes.length) return;
    const id = newId(), folder = `${plan.snapshot.root}/journal/${id}`, path = `${folder}/journal.json`;
    const journal: LayoutJournal = { journalVersion: 1, kind: 'layout', id, projectId: plan.snapshot.state.projectId, status: 'prepared', moves: [], writes: [] };
    await this.vault.mkdir(folder);
    for (const [i, m] of plan.moves.entries()) {
      const backup = `${folder}/${i}-move.bin`; await this.vault.create(backup, m.bytes, true);
      journal.moves.push({ from: m.from, to: m.to, hash: await sha256(m.bytes), backup });
    }
    for (const [i, w] of plan.writes.entries()) {
      const before = `${folder}/${i}-before.bin`, after = `${folder}/${i}-after.bin`;
      await this.vault.create(before, w.before, true); await this.vault.create(after, w.after, true);
      journal.writes.push({ path: w.path, before, after, beforeHash: await sha256(w.before), afterHash: await sha256(w.after) });
    }
    await this.vault.create(path, utf8(JSON.stringify(journal)), false);
    try {
      for (const m of plan.moves) {
        const current = await this.vault.read(m.from), before = parseManaged(m.from, text(m.bytes));
        const live = current ? parseManaged(m.from, text(current)) : null;
        if (!current || !before || !live || live.projectId !== before.projectId || live.collection !== before.collection || live.id !== before.id) fail('LOCAL_CHANGED', tr('Die Zuordnung einer Notiz hat sich während des Umordnens geändert.'));
        // FileManager may already have updated this note's links after a prior rename.
        // Moving retains those bytes; the final known-before/known-after checks below
        // prevent an unrelated content edit from being overwritten by projection writes.
        await this.vault.move(m.from, m.to, current);
      }
      for (const m of journal.moves) {
        const current = await this.vault.read(m.to), hash = current ? await sha256(current) : null;
        if (hash !== m.hash && hash !== journal.writes.find(w => w.path === m.to)?.afterHash) fail('LOCAL_CHANGED', tr('Die Notizdarstellung wurde während des Umordnens geändert. Die Originale bleiben gesichert.'));
      }
      for (const w of plan.writes) {
        const current = await this.vault.read(w.path), hash = current ? await sha256(current) : null;
        if (!current || hash !== await sha256(w.before) && hash !== await sha256(w.after)) fail('LOCAL_CHANGED', tr('Eine Notiz wurde während des Umordnens verändert. Die Originalsicherung bleibt erhalten.'));
        if (hash !== await sha256(w.after)) await this.vault.compareAndSwap(w.path, text(current), text(w.after));
      }
      await this.status(path, journal, 'committed');
    } catch (error) { await this.recover(path, journal.projectId); throw error; }
    await this.cleanup(plan);
  }
  /** Rolls back only known planned states, leaving user post-edits in place with originals retained. */
  async recover(path: string, projectId: string): Promise<{ conflicts: string[] }> {
    const journal = await loadLayoutJournal(this.vault, path, projectId), conflicts: string[] = [];
    if (journal.status === 'committed' || journal.status === 'rolledBack') return { conflicts };
    for (const w of [...journal.writes].reverse()) {
      const current = await this.vault.read(w.path), hash = current ? await sha256(current) : null;
      if (!current && journal.moves.some(m => m.to === w.path && this.vault.files().some(f => f.path === m.from))) continue;
      if (hash === w.beforeHash) continue;
      if (!current || hash !== w.afterHash) { conflicts.push(w.path); continue; }
      await this.vault.compareAndSwap(w.path, text(current), text((await this.vault.read(w.before))!));
    }
    for (const m of [...journal.moves].reverse()) {
      const from = await this.vault.read(m.from), to = await this.vault.read(m.to);
      if (from && await sha256(from) === m.hash) continue;
      if (!from && to && await sha256(to) === m.hash) await this.vault.move(m.to, m.from, to);
      else conflicts.push(m.to);
    }
    await this.status(path, journal, conflicts.length ? 'recoveryConflict' : 'rolledBack'); return { conflicts };
  }
  /** CAS-protects the durable status marker. */
  private async status(path: string, journal: LayoutJournal, status: LayoutJournal['status']): Promise<void> {
    const before = JSON.stringify(journal); journal.status = status; await this.vault.compareAndSwap(path, before, JSON.stringify(journal));
  }
  /** Removes only empty former organisation folders; unassigned content is never removed. */
  private async cleanup(plan: OrganizePlan): Promise<void> {
    const oldRoot = plan.snapshot.state.manifestPath.split('/').slice(0, -1).join('/'), newRoot = plan.manifestPath.split('/').slice(0, -1).join('/');
    const folders = new Set<string>();
    for (const move of plan.moves) {
      let folder = move.from.split('/').slice(0, -1).join('/');
      while (folder === oldRoot || folder.startsWith(oldRoot + '/')) { if (folder !== newRoot) folders.add(folder); folder = folder.split('/').slice(0, -1).join('/'); }
    }
    for (const folder of [...folders].sort((a, b) => b.length - a.length)) {
      try { await this.vault.removeEmptyFolder?.(folder); } catch { /* Empty-folder cleanup is optional after a fully committed move. */ }
    }
  }
}
