export interface VaultFile { path: string; markdown: boolean }
/** Storage boundary: implementations must enforce create exclusivity and synchronous text CAS. */
export interface VaultPort {
  /** Inventories visible files only; paths are local hints, never object identities. */
  files(): VaultFile[];
  /** Returns fresh bytes or null for missing files; errors must not look like absence. */
  read(path: string): Promise<Uint8Array | null>;
  /** Creates required visible folders; rejects an existing file in a folder position. */
  mkdir(path: string): Promise<void>;
  /** Creates a new file exclusively; may never replace an existing path. */
  create(path: string, bytes: Uint8Array, binary: boolean): Promise<void>;
  /** Atomically compares text in Vault.process; throws LOCAL_CHANGED on mismatch. */
  compareAndSwap(path: string, before: string, after: string): Promise<void>;
  /** Moves an owned recovery-created file into local trash after a fresh byte check. */
  trash(path: string, expected: Uint8Array): Promise<void>;
  /** Moves a checked managed file with the host's normal link-update behaviour; collisions block. */
  move(from: string, to: string, expected: Uint8Array): Promise<void>;
  /** Removes an empty owned organisation folder only; never recursively removes contents. */
  removeEmptyFolder?(path: string): Promise<void>;
  /** Resolves a local link via the host metadata API relative to the source file. */
  resolveLink(link: string, source: string): string | null;
}
/** UTF-8 encoding is shared by journals, indexes and fake/real adapters. */
export function utf8(text: string): Uint8Array { return new TextEncoder().encode(text); }
/** Strict decoding prevents corrupted sidecars from silently losing bytes. */
export function text(bytes: Uint8Array): string { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
/** Compares content synchronously inside API callbacks without asynchronous hashing. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean { return a.length === b.length && a.every((v, i) => v === b[i]); }
