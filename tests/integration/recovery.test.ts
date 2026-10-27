import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { JournalService, type Mutation } from '../../src/storage/journal';
import { projectDataPath } from '../../src/storage/paths';
import { text, utf8 } from '../../src/storage/vault-port';
import { loadJournal } from '../../src/storage/journal-format';
import { sha256 } from '../../src/exchange/hash';

/** Simulates process death after a successful physical write and before the next JS instruction. */
class CrashVault extends FakeVault {
  targetStep = 0;
  crashAt = Infinity;
  crashed = false;
  /** In a dead process even automatic rollback cannot run. */
  override async read(path: string): Promise<Uint8Array | null> {
    if (this.crashed) throw new Error('process exited');
    return super.read(path);
  }
  /** Crashes after target creation, excluding journal staging writes. */
  override async create(path: string, bytes: Uint8Array, binary: boolean): Promise<void> {
    await super.create(path, bytes, binary); this.afterTarget(path);
  }
  /** Includes state finalization and journal commit confirmation in crash boundaries. */
  override async compareAndSwap(path: string, before: string, after: string): Promise<void> {
    await super.compareAndSwap(path, before, after); this.afterTarget(path);
  }
  /** Stops exactly at a configured durable boundary. */
  private afterTarget(path: string): void {
    if (path.includes('/journal/') && !path.endsWith('/journal.json')) return;
    if (++this.targetStep === this.crashAt) { this.crashed = true; throw new Error('process exited'); }
  }
}
describe('API-Fake: Write-ahead-Journal und Recovery', () => {
  it('kann jeden physischen Zielschritt eines Commits nach Prozessabsturz rekonstruieren', async () => {
    const root = await projectDataPath('Daten', 'p');
    for (let step = 1; step <= 6; step++) {
      const vault = new CrashVault(); vault.data.set('Notizen/A.md', utf8('vorher')); vault.crashAt = step;
      const changes: Mutation[] = [
        { path: 'Notizen/A.md', before: utf8('vorher'), after: utf8('nachher'), binary: false },
        { path: 'Notizen/B.md', before: null, after: utf8('neu'), binary: false },
        { path: `${root}/state.json`, before: null, after: utf8(JSON.stringify({ projectId: 'p', pendingJournal: null })), binary: false }
      ];
      const service = new JournalService(vault);
      await service.commit(root, 'p', changes).catch(() => {});
      const restarted = new FakeVault(); restarted.data = new Map(vault.data);
      const journalPath = restarted.files().find(f => f.path.endsWith('/journal.json'))!.path;
      const before = await loadJournal(restarted, journalPath, 'p');
      const result = await new JournalService(restarted).recover(journalPath, 'p');
      expect(result.conflicts).toEqual([]);
      if (before.status === 'committed') {
        expect(text((await restarted.read('Notizen/A.md'))!)).toBe('nachher');
        expect(JSON.parse(text((await restarted.read(`${root}/state.json`))!)).pendingJournal).toBeNull();
      } else {
        expect(text((await restarted.read('Notizen/A.md'))!)).toBe('vorher');
        expect(await restarted.read('Notizen/B.md')).toBeNull();
        expect(await restarted.read(`${root}/state.json`)).toBeNull();
      }
    }
  });
  it('überschreibt fremde Nachbearbeitung nicht und behält Originalbytes', async () => {
    const vault = new CrashVault(), root = await projectDataPath('Daten', 'p');
    vault.data.set('A.md', utf8('Original')); vault.crashAt = 2;
    await new JournalService(vault).commit(root, 'p', [{ path: 'A.md', before: utf8('Original'), after: utf8('Import'), binary: false }]).catch(() => {});
    const restarted = new FakeVault(); restarted.data = new Map(vault.data); restarted.data.set('A.md', utf8('Fremde Nachbearbeitung'));
    const path = restarted.files().find(f => f.path.endsWith('/journal.json'))!.path;
    expect((await new JournalService(restarted).recover(path, 'p')).conflicts).toEqual(['A.md']);
    expect(text((await restarted.read('A.md'))!)).toBe('Fremde Nachbearbeitung');
    const journal = await loadJournal(restarted, path, 'p');
    expect(text((await restarted.read(journal.entries[0]!.beforePath!))!)).toBe('Original');
  });
  it('verweigert beschädigte Backups vor jeder Änderung', async () => {
    const vault = new CrashVault(), root = await projectDataPath('Daten', 'p');
    vault.data.set('A.md', utf8('Original')); vault.crashAt = 2;
    await new JournalService(vault).commit(root, 'p', [{ path: 'A.md', before: utf8('Original'), after: utf8('Import'), binary: false }]).catch(() => {});
    const restarted = new FakeVault(); restarted.data = new Map(vault.data);
    const backup = restarted.files().find(f => f.path.endsWith('-before.bin'))!.path;
    restarted.data.set(backup, utf8('beschädigt'));
    const path = restarted.files().find(f => f.path.endsWith('/journal.json'))!.path;
    const writes = restarted.writes;
    await expect(new JournalService(restarted).recover(path, 'p')).rejects.toThrow('STATE_MISSING');
    expect(restarted.writes).toBe(writes);
  });
  it('rollt bei injiziertem Schreibfehler automatisch zurück', async () => {
    const root = await projectDataPath('Daten', 'p');
    const probe = new FakeVault(); probe.data.set('A.md', utf8('vorher'));
    const change = { path: 'A.md', before: utf8('vorher'), after: utf8('nachher'), binary: false };
    await new JournalService(probe).commit(root, 'p', [change]);
    for (let step = 1; step <= probe.writes; step++) {
      const vault = new FakeVault(); vault.data.set('A.md', utf8('vorher')); vault.failAt = step;
      await expect(new JournalService(vault).commit(root, 'p', [change])).rejects.toThrow();
      expect(await sha256((await vault.read('A.md'))!)).toBe(await sha256('vorher'));
    }
  });
});
