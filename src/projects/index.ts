import { tr } from '../i18n/translate';
import type { Collection } from '../domain/types';
import { identityKey } from '../domain/records';
import { type Diagnostic, ExchangeError } from '../domain/diagnostics';
import type { ManagedNote } from '../mapping/frontmatter';
import type { VaultPort } from '../storage/vault-port';
import { text } from '../storage/vault-port';
import { jcs, sha256 } from '../exchange/hash';
import { parsedNote, type ParsedNote } from './note-cache';
import { language } from '../i18n/language';

/** Fresh-source identity index; events merely mark it dirty and never establish ownership. */
export class ProjectIndex {
  notes: ManagedNote[] = [];
  problems: (Diagnostic & { path: string })[] = [];
  dirty = true;
  private revision = 0;
  private building: Promise<void> | null = null;
  private buildingFresh = false;
  private readonly parsed = new Map<string, ParsedNote>();
  private readonly changedPaths = new Set<string>();
  private allChanged = true;
  private digest: Promise<string> | null = null;
  /** Binds a visible-vault adapter; no plugin data.json identities are consumed. */
  constructor(private readonly vault: VaultPort) {}
  /** Display invalidation token includes events whose stat timestamps have not advanced yet. */
  get eventRevision(): number { return this.revision; }
  /** Marks any create/modify/rename/delete/metadata event for the next refresh. */
  invalidate(path?: string): void { this.dirty = true; this.revision++; if (path) this.changedPaths.add(path); else this.allChanged = true; }
  /** Rebuilds from current source, recording duplicates and malformed identities conservatively. */
  async rebuild(): Promise<void> {
    if (this.building) { if (this.buildingFresh) return this.building; await this.building; return this.rebuild(); }
    this.buildingFresh = true;
    const build = this.scan(true); this.building = build;
    try { await build; } finally { this.building = null; }
  }
  /** Uses stat/event hints for presentation only. Commits always call rebuild() for fresh bytes. */
  async refresh(): Promise<void> {
    if (this.building) return this.building;
    this.buildingFresh = false;
    const build = this.scan(false); this.building = build;
    try { await build; } finally { this.building = null; }
  }
  /** Swaps a complete scan atomically so concurrent views cannot observe a half-built identity list. */
  private async scan(fresh: boolean): Promise<void> {
    const revision = this.revision, notes: ManagedNote[] = [], problems: (Diagnostic & { path: string })[] = [];
    const keys = new Map<string, string>(), present = new Set<string>();
    for (const file of this.vault.files().filter(f => f.markdown)) {
      present.add(file.path);
      let parsed = this.parsed.get(file.path);
      if (fresh || this.allChanged || this.changedPaths.has(file.path) || file.version === undefined || parsed?.version !== file.version || parsed.locale !== language()) {
        const bytes = await this.vault.read(file.path);
        if (!bytes) { this.parsed.delete(file.path); continue; }
        parsed = parsedNote(file.path, text(bytes), file.version, parsed); this.parsed.set(file.path, parsed);
      }
      if (parsed) {
        problems.push(...parsed.problems.map(d => ({ ...d, path: file.path })));
        const note = parsed.note;
        if (!note) continue;
        notes.push(note);
        const key = identityKey(note.projectId, note.collection, note.id);
        if (keys.has(key)) problems.push({ path: note.path, code: 'DUPLICATE_ID', severity: 'error', pointer: '', message: tr('Zwei Dateien beanspruchen dieselbe Identität. Kopie entfernen oder unabhängig kopieren.') });
        keys.set(key, note.path);
      }
    }
    for (const path of this.parsed.keys()) if (!present.has(path)) this.parsed.delete(path);
    if (notes.length !== this.notes.length || notes.some((note, i) => note !== this.notes[i])) this.digest = null;
    this.notes = notes; this.problems = problems; this.dirty = revision !== this.revision;
    if (!this.dirty) { this.allChanged = false; this.changedPaths.clear(); }
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
    return this.digest ??= sha256(jcs(this.notes.map(n => [n.path, n.source]).sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))));
  }
  /** Blocks graph operations until all malformed and duplicated managed notes are repaired. */
  assertClean(): void { if (this.problems.length) throw new ExchangeError(this.problems); }
}
