import type { VaultPort, VaultFile } from '../../src/storage/vault-port';
import { equalBytes, text, utf8 } from '../../src/storage/vault-port';
import { collisionKey, safePath } from '../../src/storage/paths';
import { fail } from '../../src/domain/diagnostics';

/** Deterministic visible-vault fake with controllable write failure and external edits. */
export class FakeVault implements VaultPort {
  data = new Map<string, Uint8Array>();
  writes = 0;
  failAt = Infinity;
  beforeWrite: (() => void) | null = null;
  /** Lists current files rather than returning a stale cache. */
  files(): VaultFile[] { return [...this.data.keys()].map(path => ({ path, markdown: path.endsWith('.md') })); }
  /** Returns a copy to prevent accidental mutation of stored bytes. */
  async read(path: string): Promise<Uint8Array | null> { return this.data.get(path)?.slice() ?? null; }
  /** Checks folder safety; the in-memory implementation needs no folder entries. */
  async mkdir(path: string): Promise<void> { safePath(path); }
  /** Injects failures at physical target mutations for recovery tests. */
  private tick(): void {
    this.beforeWrite?.(); this.beforeWrite = null;
    if (++this.writes === this.failAt) throw new Error('injected write failure');
  }
  /** Enforces case-insensitive exclusive creation like supported desktop filesystems. */
  async create(path: string, bytes: Uint8Array, _binary: boolean): Promise<void> {
    safePath(path); this.tick();
    if (this.files().some(f => collisionKey(f.path) === collisionKey(path))) fail('LOCAL_CHANGED', 'Pfad belegt.');
    this.data.set(path, bytes.slice());
  }
  /** Synchronous comparison simulates the callback contract of Vault.process. */
  async compareAndSwap(path: string, before: string, after: string): Promise<void> {
    this.tick();
    const bytes = this.data.get(path);
    if (!bytes || text(bytes) !== before) fail('LOCAL_CHANGED', 'Datei geändert.');
    this.data.set(path, utf8(after));
  }
  /** Simulates trash with expected-byte protection; tests retain backups in the journal. */
  async trash(path: string, expected: Uint8Array): Promise<void> {
    this.tick();
    const bytes = this.data.get(path);
    if (!bytes || !equalBytes(bytes, expected)) fail('LOCAL_CHANGED', 'Datei geändert.');
    this.data.delete(path);
  }
  /** Simulates exclusive rename with the same fresh-byte guard as the native adapter. */
  async move(from: string, to: string, expected: Uint8Array): Promise<void> {
    this.tick(); safePath(to);
    const bytes = this.data.get(from);
    if (!bytes || !equalBytes(bytes, expected) || this.files().some(f => collisionKey(f.path) === collisionKey(to))) fail('LOCAL_CHANGED', 'Umbenennung kollidiert oder Quelle wurde verändert.');
    this.data.set(to, bytes.slice()); this.data.delete(from);
  }
  /** Resolves explicit vault paths and relative Markdown paths without IO. */
  resolveLink(link: string, source: string): string | null {
    const decoded = decodeURIComponent(link);
    const base = source.split('/').slice(0, -1);
    for (const part of decoded.split('/')) { if (part === '..') base.pop(); else if (part !== '.') base.push(part); }
    return [decoded, decoded + '.md', base.join('/'), base.join('/') + '.md'].find(p => this.data.has(p)) ?? null;
  }
}
