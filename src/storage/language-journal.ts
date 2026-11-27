import type { VaultPort } from './vault-port';
import { equalBytes, text, utf8 } from './vault-port';
import { newId, sha256 } from '../exchange/hash';
import type { LanguagePlan } from '../projects/language-plan';
import { relocate, relocateLinks, visibleFolders, type FolderMove } from '../projects/relocation';
import { splitNote } from '../mapping/frontmatter';
import { loadLanguageJournal, type LanguageJournal } from './language-journal-format';
import type { Settings } from '../projects/layout';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';
import { sameExceptLinkTargets } from '../projects/link-equivalence';

/** Durable folder-only migration; backups are retained and recovery never guesses through user edits. */
export class LanguageJournalService {
  /** Requires the same visible-vault adapter as ordinary project persistence. */
  constructor(private readonly vault: VaultPort) {}
  /** Verifies the concrete preview, stages every affected original, then performs native folder moves. */
  async commit(plan: LanguagePlan, before: Settings, save: () => Promise<void>): Promise<void> {
    if (!plan.moves.length && !plan.writes.length) { await save(); return; }
    if (!this.vault.moveFolder) fail('UNSUPPORTED_REPRESENTATION', tr('Ordner wurden seit der Vorschau verändert. Bitte erneut versuchen.'));
    if (JSON.stringify(visibleFolders(this.vault)) !== JSON.stringify(plan.folders)) this.changed();
    const affected = this.vault.files().filter(file => relocate(file.path, plan.moves) !== file.path).map(file => file.path).sort();
    const expected = [...plan.guards.keys()].filter(path => relocate(path, plan.moves) !== path).sort();
    if (JSON.stringify(affected) !== JSON.stringify(expected)) this.changed();
    for (const [path, bytes] of plan.guards) { const current = await this.vault.read(path); if (!current || !equalBytes(current, bytes)) this.changed(); }
    const folder = `${before.dataFolder}/language-changes/${newId()}`, path = `${folder}/journal.json`;
    const journal: LanguageJournal = { journalVersion: 1, kind: 'language', projectId: 'language', id: folder.split('/').at(-1)!,
      status: 'prepared', moves: plan.moves, originals: [], writes: [], settingsBefore: { ...before } };
    await this.vault.mkdir(folder);
    for (const [i, [source, bytes]] of [...plan.guards].entries()) {
      const backup = `${folder}/${i}-original.bin`; await this.vault.create(backup, bytes, true);
      journal.originals.push({ path: source, backup, hash: await sha256(bytes) });
    }
    for (const [i, write] of plan.writes.entries()) {
      const original = journal.originals.find(original => original.path === write.from)!;
      const after = `${folder}/${i}-after.bin`; await this.vault.create(after, write.after, true);
      journal.writes.push({ from: write.from, path: write.path, before: original.backup, after, beforeHash: original.hash, afterHash: await sha256(write.after) });
    }
    await this.vault.create(path, utf8(JSON.stringify(journal)), false);
    await loadLanguageJournal(this.vault, path);
    try {
      const applied: FolderMove[] = [];
      for (const move of plan.moves) {
        await this.verifyTree(journal, applied, move.from);
        await this.vault.moveFolder(move.from, move.to); applied.push(move);
      }
      for (const write of plan.writes) {
        const current = await this.vault.read(write.path); if (!current) this.changed();
        if (equalBytes(current, write.after)) continue;
        // Obsidian may already have updated the links itself while renaming the folders. That
        // version is equally valid and is kept; recovery recognises it as a link-only change.
        if (!equalBytes(current, write.before) && write.path.endsWith('.md') && sameExceptLinkTargets(text(current), text(write.after))) continue;
        if (!equalBytes(current, write.before)) this.changed();
        await this.vault.compareAndSwap(write.path, text(current), text(write.after));
      }
      await save(); await this.status(path, journal, 'committed');
    } catch (error) {
      const result = await this.recover(path); if (result.conflicts.length) fail('LOCAL_CHANGED', tr('Sprachwechsel konnte nicht vollständig zurückgenommen werden. Die gesicherten Originale bleiben erhalten.'));
      throw error;
    }
  }
  /** Rolls back only known after-images and unchanged trees, including after a process restart. */
  async recover(path: string): Promise<{ conflicts: string[]; settings?: Settings }> {
    const journal = await loadLanguageJournal(this.vault, path), conflicts: string[] = [];
    if (journal.status === 'committed' || journal.status === 'rolledBack') return { conflicts };
    // Folders first: Obsidian may rewrite links while renaming, so note texts are restored afterwards.
    // verifyTree accepts own after-images and link-only changes but still blocks real author edits.
    for (const [index, move] of [...journal.moves.entries()].reverse()) {
      const folders = visibleFolders(this.vault);
      if (folders.includes(move.from) && !folders.includes(move.to)) continue;
      if (folders.includes(move.from) || !folders.includes(move.to)) { conflicts.push(move.to); break; }
      try { await this.verifyTree(journal, journal.moves.slice(0, index + 1), move.to); await this.vault.moveFolder!(move.to, move.from); }
      catch { conflicts.push(move.to); break; }
    }
    if (!conflicts.length) conflicts.push(...await this.restoreWrites(journal));
    await this.status(path, journal, conflicts.length ? 'recoveryConflict' : 'rolledBack');
    return { conflicts, ...(conflicts.length ? {} : { settings: journal.settingsBefore }) };
  }
  /**
   * Explicit user repair of an unfinished switch: renames every structural folder back where the
   * original name is free (a rename never loses content), then restores the plugin's own text
   * changes. Notes with real author edits are kept unchanged and only reported.
   */
  async repair(path: string): Promise<{ conflicts: string[]; kept: string[]; settings?: Settings }> {
    const journal = await loadLanguageJournal(this.vault, path), conflicts: string[] = [];
    if (journal.status === 'committed' || journal.status === 'rolledBack') return { conflicts, kept: [] };
    for (const move of [...journal.moves].reverse()) {
      const folders = visibleFolders(this.vault);
      if (folders.includes(move.from) && !folders.includes(move.to)) continue;
      if (folders.includes(move.from) || !folders.includes(move.to)) { conflicts.push(move.to); continue; }
      try { await this.vault.moveFolder!(move.to, move.from); } catch { conflicts.push(move.to); }
    }
    const kept: string[] = [];
    for (const conflict of await this.restoreWrites(journal)) (conflict.endsWith('.md') ? kept : conflicts).push(conflict);
    await this.status(path, journal, conflicts.length ? 'recoveryConflict' : 'rolledBack');
    return { conflicts, kept, ...(conflicts.length ? {} : { settings: journal.settingsBefore }) };
  }
  /** Restores before-images where the current file is the plugin's own after-image or differs only in link targets. */
  private async restoreWrites(journal: LanguageJournal): Promise<string[]> {
    const conflicts: string[] = [];
    for (const write of [...journal.writes].reverse()) {
      const candidates = new Set([write.from, ...journal.moves.map((_, i) => relocate(write.from, journal.moves.slice(0, i + 1)))]);
      let found = false;
      for (const candidate of candidates) {
        const current = await this.vault.read(candidate); if (!current) continue; found = true;
        const hash = await sha256(current), before = (await this.vault.read(write.before))!;
        if (hash === write.beforeHash) continue;
        const linkOnly = candidate.endsWith('.md') && sameExceptLinkTargets(text(current), text(before));
        if (hash !== write.afterHash && !linkOnly) { conflicts.push(candidate); continue; }
        await this.vault.compareAndSwap(candidate, text(current), text(before));
      }
      if (!found) conflicts.push(write.path);
    }
    return conflicts;
  }
  /** Verifies all files under a folder before moving it; newly added content blocks the move. */
  private async verifyTree(journal: LanguageJournal, applied: FolderMove[], root: string): Promise<void> {
    const files = this.vault.files().filter(file => file.path.startsWith(root + '/'));
    const originals = journal.originals.filter(original => relocate(original.path, applied).startsWith(root + '/'));
    if (files.length !== originals.length) this.changed();
    for (const original of originals) {
      const current = await this.vault.read(relocate(original.path, applied)); if (!current) this.changed();
      if (await sha256(current) === original.hash) continue;
      const before = await this.vault.read(original.backup); if (!before || !original.path.endsWith('.md')) this.changed();
      const note = splitNote(text(before)), expected = note.header + relocateLinks(note.body, applied);
      // Obsidian's own link update after an earlier rename is not an author edit.
      if (!equalBytes(current, utf8(expected)) && !sameExceptLinkTargets(text(current), expected)) this.changed();
    }
  }
  /** Keeps durable completion changes CAS-protected like ordinary journal status updates. */
  private async status(path: string, journal: LanguageJournal, status: LanguageJournal['status']): Promise<void> {
    const before = JSON.stringify(journal); journal.status = status; await this.vault.compareAndSwap(path, before, JSON.stringify(journal));
  }
  /** Reports a stale preview without exposing manuscript text. */
  private changed(): never { fail('LOCAL_CHANGED', tr('Ordner wurden seit der Vorschau verändert. Bitte erneut versuchen.')); }
}
