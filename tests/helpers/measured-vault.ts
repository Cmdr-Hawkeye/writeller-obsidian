import { FakeVault } from './fake-vault';

/** Counts concrete storage work independently of machine speed; never reads a personal vault. */
export class MeasuredVault extends FakeVault {
  private readonly versions = new WeakMap<Uint8Array, number>();
  private sequence = 0;
  reads: string[] = [];
  inventories = 0;
  /** Counts every requested read, including original backups, so history amplification is visible. */
  override async read(path: string): Promise<Uint8Array | null> { this.reads.push(path); return super.read(path); }
  /** Counts inventory allocations separately from byte reads. */
  override files() {
    this.inventories++;
    return super.files().map(file => {
      const bytes = this.data.get(file.path)!;
      let version = this.versions.get(bytes); if (version === undefined) { version = ++this.sequence; this.versions.set(bytes, version); }
      return { ...file, version: String(version) };
    });
  }
  /** Starts the next isolated operation measurement. */
  reset(): void { this.reads = []; this.inventories = 0; }
}
