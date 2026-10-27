import { App, TFile, TFolder } from 'obsidian';
import type { VaultFile, VaultPort } from '../storage/vault-port';
import { equalBytes, text, utf8 } from '../storage/vault-port';
import { safePath, collisionKey } from '../storage/paths';
import { fail } from '../domain/diagnostics';
import { jcs } from '../exchange/hash';
import { splitNote } from '../mapping/frontmatter';

/** Official visible Vault API adapter with synchronous text and property preconditions. */
export class ObsidianVault implements VaultPort {
  /** Receives the host App; no filesystem, Electron or Node API is used. */
  constructor(private readonly app: App) {}
  /** Enumerates visible files, including JSON and binary assets. */
  files(): VaultFile[] { return this.app.vault.getFiles().map(f => ({ path: f.path, markdown: f.extension === 'md' })); }
  /** Reads fresh bytes with a pre-read package budget, avoiding cachedRead for commits. */
  async read(path: string): Promise<Uint8Array | null> {
    const file = this.app.vault.getAbstractFileByPath(safePath(path));
    if (!file) return null;
    if (!(file instanceof TFile)) fail('IDENTITY_CONFLICT', 'Dateipfad ist ein Ordner.');
    const maximum = path.endsWith('.writeller-exchange.json') ? 128 * 1024 ** 2 : 512 * 1024 ** 2;
    if (file.stat.size > maximum) fail('LIMIT_EXCEEDED', 'Datei überschreitet das lokale Lesebudget.');
    return file.extension === 'md' ? utf8(await this.app.vault.read(file)) : new Uint8Array(await this.app.vault.readBinary(file));
  }
  /** Creates visible folders serially and blocks file/folder collisions. */
  async mkdir(path: string): Promise<void> {
    const parts = safePath(path).split('/');
    for (let i = 1; i <= parts.length; i++) {
      const segment = parts.slice(0, i).join('/'), existing = this.app.vault.getAbstractFileByPath(segment);
      if (existing && !(existing instanceof TFolder)) fail('IDENTITY_CONFLICT', 'Ordnerpfad ist durch eine Datei belegt.');
      if (!existing) await this.app.vault.createFolder(segment);
    }
  }
  /** Uses exclusive Vault.create/createBinary; never replaces an existing file. */
  async create(path: string, bytes: Uint8Array, binary: boolean): Promise<void> {
    safePath(path);
    if (this.files().some(f => collisionKey(f.path) === collisionKey(path)) || this.app.vault.getAbstractFileByPath(path)) fail('LOCAL_CHANGED', 'Ausgabepfad ist bereits belegt. Neuen Namen wählen.');
    if (binary) await this.app.vault.createBinary(path, new Uint8Array(bytes).buffer);
    else await this.app.vault.create(path, text(bytes));
  }
  /** Protects text in Vault.process; property changes use processFrontMatter as a separate step. */
  async compareAndSwap(path: string, before: string, after: string): Promise<void> {
    const file = this.file(path);
    let expected = before;
    if (file.extension === 'md' && jcs(splitNote(before).properties) !== jcs(splitNote(after).properties)) {
      expected = await this.updateFrontMatter(file, before, after);
    }
    await this.app.vault.process(file, current => {
      if (current !== expected) fail('LOCAL_CHANGED', 'Datei während des Schreibens geändert. Neue Vorschau erforderlich.');
      return after;
    });
  }
  /** Uses independent property/body preconditions; no await occurs inside synchronous callbacks. */
  private async updateFrontMatter(file: TFile, before: string, after: string): Promise<string> {
    if (await this.app.vault.read(file) !== before) fail('LOCAL_CHANGED', 'Notiz vor Property-Änderung verändert.');
    const old = splitNote(before), next = splitNote(after);
    await this.app.fileManager.processFrontMatter(file, (frontmatter: unknown) => {
      if (jcs(frontmatter) !== jcs(old.properties) || !frontmatter || typeof frontmatter !== 'object') fail('LOCAL_CHANGED', 'Properties inzwischen verändert.');
      const target = frontmatter as Record<string, unknown>;
      // Only owned keys change. User YAML remains the host's responsibility.
      for (const key of Object.keys(target).filter(k => k.startsWith('writeller-'))) delete target[key];
      for (const [key, value] of Object.entries(next.properties).filter(([k]) => k.startsWith('writeller-'))) Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
    });
    const intermediate = await this.app.vault.read(file), parts = splitNote(intermediate);
    if (parts.body !== old.body || jcs(parts.properties) !== jcs(next.properties)) fail('LOCAL_CHANGED', 'Notiz während Property-Änderung verändert. Journal und Original prüfen.');
    // This is not a multi-file or combined frontmatter/body transaction. A crash here
    // leaves a conservative recovery conflict with the original bytes in the journal.
    return intermediate;
  }
  /** Uses local trash only, preserving existing notes rather than permanently deleting them. */
  async trash(path: string, expected: Uint8Array): Promise<void> {
    const current = await this.read(path);
    if (!current || !equalBytes(current, expected)) fail('LOCAL_CHANGED', 'Datei vor Wiederherstellung verändert.');
    await this.app.vault.trash(this.file(path), false);
  }
  /** Uses FileManager.renameFile after fresh content/target checks; the host updates native links. */
  async move(from: string, to: string, expected: Uint8Array): Promise<void> {
    safePath(to);
    const current = await this.read(from);
    if (!current || !equalBytes(current, expected)) fail('LOCAL_CHANGED', 'Die Notiz wurde seit der Vorschau verändert. Bitte erneut ordnen.');
    if (this.app.vault.getAbstractFileByPath(to) || this.files().some(f => collisionKey(f.path) === collisionKey(to))) fail('LOCAL_CHANGED', 'Der neue Dateiname ist inzwischen belegt.');
    await this.mkdir(to.slice(0, to.lastIndexOf('/')));
    await this.app.fileManager.renameFile(this.file(from), to);
  }
  /** Cleans up only empty source folders after a completed user-confirmed reorganisation. */
  async removeEmptyFolder(path: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(safePath(path));
    if (folder instanceof TFolder && folder.children.length === 0) await this.app.vault.trash(folder, false);
  }
  /** Resolves current destinations relative to the source via the official MetadataCache. */
  resolveLink(link: string, source: string): string | null {
    let decoded: string;
    try { decoded = decodeURIComponent(link); } catch { return null; }
    return this.app.metadataCache.getFirstLinkpathDest(decoded, source)?.path ?? null;
  }
  /** Requires a visible TFile and never falls through to a raw adapter path. */
  private file(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(safePath(path));
    if (!(file instanceof TFile)) fail('LOCAL_CHANGED', 'Datei fehlt oder ist kein Dateiziel.');
    return file;
  }
}
