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
        if (!equalBytes(current, write.before) && !equalBytes(current, write.after)) this.changed();
        if (!equalBytes(current, write.after)) await this.vault.compareAndSwap(write.path, text(current), text(write.after));
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
    for (const write of [...journal.writes].reverse()) {
      const candidates = new Set([write.from, ...journal.moves.map((_, i) => relocate(write.from, journal.moves.slice(0, i + 1)))]);
      let found = false;
      for (const candidate of candidates) {
        const current = await this.vault.read(candidate); if (!current) continue; found = true;
        const hash = await sha256(current);
        if (hash === write.beforeHash) continue;
        if (hash !== write.afterHash) { conflicts.push(candidate); continue; }
        await this.vault.compareAndSwap(candidate, text(current), text((await this.vault.read(write.before))!));
      }
      if (!found) conflicts.push(write.path);
    }
    if (!conflicts.length) for (const [index, move] of [...journal.moves.entries()].reverse()) {
      const folders = visibleFolders(this.vault);
      if (folders.includes(move.from) && !folders.includes(move.to)) continue;
      if (folders.includes(move.from) || !folders.includes(move.to)) { conflicts.push(move.to); break; }
      try { await this.verifyTree(journal, journal.moves.slice(0, index + 1), move.to); await this.vault.moveFolder!(move.to, move.from); }
      catch { conflicts.push(move.to); break; }
    }
    await this.status(path, journal, conflicts.length ? 'recoveryConflict' : 'rolledBack');
    return { conflicts, ...(conflicts.length ? {} : { settings: journal.settingsBefore }) };
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
      const note = splitNote(text(before)); if (!equalBytes(current, utf8(note.header + relocateLinks(note.body, applied)))) this.changed();
    }
  }
  /** Keeps durable completion changes CAS-protected like ordinary journal status updates. */
  private async status(path: string, journal: LanguageJournal, status: LanguageJournal['status']): Promise<void> {
    const before = JSON.stringify(journal); journal.status = status; await this.vault.compareAndSwap(path, before, JSON.stringify(journal));
  }
  /** Reports a stale preview without exposing manuscript text. */
  private changed(): never { fail('LOCAL_CHANGED', tr('Ordner wurden seit der Vorschau verändert. Bitte erneut versuchen.')); }
}
