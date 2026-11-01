import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import { planDeletion } from '../../src/projects/deletion';
import { DeletionJournalService } from '../../src/storage/deletion-journal';
import { loadDeletionJournal } from '../../src/storage/deletion-format';
import { pendingJournals } from '../../src/storage/recovery-index';
import { utf8, text } from '../../src/storage/vault-port';
import { sha256 } from '../../src/exchange/hash';

/** Creates isolated real projects including a scene and historical write-ahead data. */
async function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = createProject('Der Hafen'), other = createProject('Ein anderes Buch');
  setEntry(pkg, createRecord('scenes', pkg.project.id, pkg.producer.instanceId, 'Ankunft'));
  await service.commit(await service.previewSave(pkg, null)); await service.commit(await service.previewSave(other, null));
  return { vault, service, pkg, other, deletion: new DeletionJournalService(vault) };
}
/** Simulates a process stopping before automatic rollback, leaving a durable discoverable journal. */
async function interrupted() {
  const state = await setup(), plan = await planDeletion(state.service, state.pkg.project.id);
  const trash = state.vault.trash.bind(state.vault); let removed = 0;
  vi.spyOn(state.vault, 'trash').mockImplementation(async (path, bytes) => {
    if (++removed === 3) throw new Error('process stopped'); await trash(path, bytes);
  });
  vi.spyOn(state.deletion, 'recover').mockRejectedValue(new Error('process stopped'));
  await expect(state.deletion.commit(state.service, plan)).rejects.toThrow('process stopped');
  const journal = (await pendingJournals(state.vault))[0]!;
  vi.restoreAllMocks(); return { ...state, plan, journal };
}
describe('confirmed recoverable project deletion', () => {
  it('deletes identity-owned notes even when moved, private data and history; preserves other projects, exports and unassigned files', async () => {
    const { vault, service, pkg, other, deletion } = await setup();
    const scene = service.index.notes.find(note => note.projectId === pkg.project.id && note.collection === 'scenes')!;
    vault.data.set('Anderswo/Ankunft.md', vault.data.get(scene.path)!); vault.data.delete(scene.path);
    const ordinary = 'Schreibprojekte/Der Hafen/Notizen/Idee.md', exported = 'Exporte/Der Hafen.writeller-exchange.json';
    vault.data.set(ordinary, utf8('Eigene Notiz')); vault.data.set(exported, utf8('export'));
    const before = await service.snapshot(other.project.id), plan = await planDeletion(service, pkg.project.id);
    const preserved = new Map([...vault.data].filter(([path]) => !plan.files.has(path)));
    await deletion.commit(service, plan);
    expect(service.index.manifests().map(note => note.projectId)).toEqual([other.project.id]);
    expect(vault.data).toEqual(preserved); expect(await pendingJournals(vault)).toEqual([]);
    expect((await service.snapshot(other.project.id)).exchange.project).toEqual(before.exchange.project);
    // Retained exports can intentionally import a deleted project again using its original identity.
    await service.commit(await service.previewSave(pkg, null)); expect(service.index.manifests()).toHaveLength(2);
  });
  it('rejects source edits after confirmation without deleting any files', async () => {
    const { vault, service, pkg, deletion } = await setup(), plan = await planDeletion(service, pkg.project.id);
    const target = plan.snapshot.state.manifestPath; vault.data.set(target, utf8(text(vault.data.get(target)!) + '\nNeuer Text'));
    const before = new Map(vault.data);
    await expect(deletion.commit(service, plan)).rejects.toThrow(/LOCAL_CHANGED/); expect(vault.data).toEqual(before);
  });
  it('rejects a new private data file after preview and leaves it intact', async () => {
    const { vault, service, pkg, deletion } = await setup(), plan = await planDeletion(service, pkg.project.id);
    vault.data.set(`${plan.snapshot.root}/später.json`, utf8('{}')); const before = new Map(vault.data);
    await expect(deletion.commit(service, plan)).rejects.toThrow(/LOCAL_CHANGED/); expect(vault.data).toEqual(before);
  });
  it('rechecks changes made during backup creation before the first removal', async () => {
    const { vault, service, pkg, deletion } = await setup(), plan = await planDeletion(service, pkg.project.id);
    vault.beforeWrite = () => { vault.data.set(plan.snapshot.state.manifestPath, utf8(text(plan.files.get(plan.snapshot.state.manifestPath)!) + '\nSpäte Änderung')); };
    await expect(deletion.commit(service, plan)).rejects.toThrow(/LOCAL_CHANGED/);
    for (const path of plan.files.keys()) expect(vault.data.has(path)).toBe(true);
    expect(await pendingJournals(vault)).toEqual([]);
  });
  it('rolls back a native trash failure with all original bytes intact', async () => {
    const { vault, service, pkg, deletion } = await setup(), plan = await planDeletion(service, pkg.project.id), before = new Map(vault.data);
    const trash = vault.trash.bind(vault); let removed = 0;
    vi.spyOn(vault, 'trash').mockImplementation(async (path, bytes) => { if (++removed === 3) throw new Error('trash unavailable'); await trash(path, bytes); });
    await expect(deletion.commit(service, plan)).rejects.toThrow('trash unavailable');
    expect(vault.data).toEqual(before); expect(await pendingJournals(vault)).toEqual([]); vi.restoreAllMocks();
  });
  it('restores the entire project when writing the completion marker fails after the manifest was removed', async () => {
    const { vault, service, pkg, deletion } = await setup(), plan = await planDeletion(service, pkg.project.id), before = new Map(vault.data);
    const swap = vault.compareAndSwap.bind(vault); let failed = false;
    vi.spyOn(vault, 'compareAndSwap').mockImplementation(async (path, previous, next) => {
      if (!failed && path.includes('/project-deletions/') && next.includes('"committed"')) { failed = true; throw new Error('completion marker failed'); }
      await swap(path, previous, next);
    });
    await expect(deletion.commit(service, plan)).rejects.toThrow('completion marker failed');
    expect(vault.data).toEqual(before); expect(await pendingJournals(vault)).toEqual([]); vi.restoreAllMocks();
  });
  it('discovers an interrupted deletion without the manifest and restores it through the ordinary recovery command service', async () => {
    const { vault, service, pkg, plan, journal } = await interrupted();
    // An interrupted deletion must still be found after a crash removed the manifest too.
    vault.data.delete(plan.snapshot.state.manifestPath);
    const preview = await service.previewSave(createProject('Neu'), null);
    await expect(service.commit(preview)).rejects.toThrow(/LOCAL_CHANGED/);
    const result = await service.journal.recover(journal.path, pkg.project.id); expect(result.conflicts).toEqual([]);
    for (const [path, bytes] of plan.files) expect(vault.data.get(path)).toEqual(bytes);
    expect(await pendingJournals(vault)).toEqual([]); expect((await service.snapshot(pkg.project.id)).exchange.project.title).toBe('Der Hafen');
  });
  it('preserves later edits during recovery and keeps the conflict discoverable until resolved', async () => {
    const { vault, service, pkg, plan, journal } = await interrupted(), target = [...plan.files.keys()][0]!;
    vault.data.set(target, utf8('Externe Änderung'));
    const result = await service.journal.recover(journal.path, pkg.project.id); expect(result.conflicts).toContain(target);
    expect(text(vault.data.get(target)!)).toBe('Externe Änderung'); expect(await pendingJournals(vault)).toHaveLength(1);
    vault.data.delete(target); expect((await service.journal.recover(journal.path, pkg.project.id)).conflicts).toEqual([]);
  });
  it('rejects corrupted backups and foreign restore targets before any recovery writes', async () => {
    const { vault, service, pkg, other, journal } = await interrupted();
    const foreign = service.index.manifests().find(note => note.projectId === other.project.id)!;
    const header = JSON.parse(text(vault.data.get(journal.path)!)); header.entries[0].path = foreign.path;
    const foreignBytes = vault.data.get(foreign.path)!;
    vault.data.set(header.entries[0].backup, foreignBytes); header.entries[0].hash = await sha256(foreignBytes);
    vault.data.set(journal.path, utf8(JSON.stringify(header))); const before = new Map(vault.data);
    await expect(loadDeletionJournal(vault, journal.path, pkg.project.id)).rejects.toThrow(/STATE_MISSING/); expect(vault.data).toEqual(before);
    header.entries[0].path = 'Andere/Kopie.md'; vault.data.set(header.entries[0].backup, utf8('beschädigt'));
    await expect(loadDeletionJournal(vault, journal.path, pkg.project.id)).rejects.toThrow(/STATE_MISSING/);
  });
});
