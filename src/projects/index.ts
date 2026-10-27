import type { Collection } from '../domain/types';
import { identityKey } from '../domain/records';
import { type Diagnostic, ExchangeError } from '../domain/diagnostics';
import { parseManaged, type ManagedNote } from '../mapping/frontmatter';
import type { VaultPort } from '../storage/vault-port';
import { text } from '../storage/vault-port';
import { jcs, sha256 } from '../exchange/hash';

/** Fresh-source identity index; events merely mark it dirty and never establish ownership. */
export class ProjectIndex {
  notes: ManagedNote[] = [];
  problems: (Diagnostic & { path: string })[] = [];
  dirty = true;
  private revision = 0;
  private building: Promise<void> | null = null;
  /** Binds a visible-vault adapter; no plugin data.json identities are consumed. */
  constructor(private readonly vault: VaultPort) {}
  /** Marks any create/modify/rename/delete/metadata event for the next refresh. */
  invalidate(): void { this.dirty = true; this.revision++; }
  /** Rebuilds from current source, recording duplicates and malformed identities conservatively. */
  async rebuild(): Promise<void> {
    if (this.building) return this.building;
    const build = this.scan(); this.building = build;
    try { await build; } finally { this.building = null; }
  }
  /** Swaps a complete scan atomically so concurrent views cannot observe a half-built identity list. */
  private async scan(): Promise<void> {
    const revision = this.revision, notes: ManagedNote[] = [], problems: (Diagnostic & { path: string })[] = [];
    const keys = new Map<string, string>();
    for (const file of this.vault.files().filter(f => f.markdown)) {
      const bytes = await this.vault.read(file.path);
      if (!bytes) continue;
      try {
        const note = parseManaged(file.path, text(bytes));
        if (!note) continue;
        notes.push(note);
        const key = identityKey(note.projectId, note.collection, note.id);
        if (keys.has(key)) problems.push({ path: note.path, code: 'DUPLICATE_ID', severity: 'error', pointer: '', message: 'Zwei Dateien beanspruchen dieselbe Identität. Kopie entfernen oder unabhängig kopieren.' });
        keys.set(key, note.path);
      } catch (error) {
        if (!(error instanceof ExchangeError)) throw error;
        problems.push(...error.diagnostics.map(d => ({ ...d, path: file.path })));
      }
    }
    this.notes = notes; this.problems = problems; this.dirty = revision !== this.revision;
  }
  /** Returns manifests; duplicate project IDs remain an error instead of choosing a winner. */
  manifests(): ManagedNote[] { return this.notes.filter(n => n.collection === 'project'); }
  /** Finds a uniquely owned object; duplicate keys block rather than selecting by scan order. */
  find(projectId: string, collection: Collection, id: string): ManagedNote | undefined {
    const matches = this.notes.filter(n => n.projectId === projectId && n.collection === collection && n.id === id);
    if (matches.length > 1) throw new ExchangeError(this.problems.filter(d => d.code === 'DUPLICATE_ID'));
    return matches[0];
  }
  /** Includes source, paths and every managed identity to detect edits and newly copied notes. */
  async fingerprint(): Promise<string> {
    return sha256(jcs(this.notes.map(n => [n.path, n.source]).sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))));
  }
  /** Blocks graph operations until all malformed and duplicated managed notes are repaired. */
  assertClean(): void { if (this.problems.length) throw new ExchangeError(this.problems); }
}
