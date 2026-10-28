import { describe, expect, it } from 'vitest';
import { MeasuredVault } from '../helpers/measured-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import { text, utf8 } from '../../src/storage/vault-port';
import { ProjectIndex } from '../../src/projects/index';

/** Creates real identity/sidecar/journal data and unrelated Markdown without a native vault. */
async function setup() {
  const vault = new MeasuredVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), pkg = createProject('Messprojekt');
  for (let i = 0; i < 200; i++) vault.data.set(`Privat/Notiz ${i}.md`, utf8('Eigener Text'));
  await service.commit(await service.previewSave(pkg, null)); return { vault, service, pkg };
}
describe('bounded display work with fresh write protection', () => {
  it('reuses unchanged display sources and reads exactly one changed note', async () => {
    const { vault, service } = await setup(); vault.reset(); await service.index.refresh(); expect(vault.reads).toEqual([]);
    vault.data.set('Privat/Notiz 1.md', utf8('Neue Idee')); await service.index.refresh(); expect(vault.reads).toEqual(['Privat/Notiz 1.md']);
  });
  it('honors invalidation even if an adapter returns the same stat token', async () => {
    const { vault, service } = await setup(), files = vault.files.bind(vault); vault.files = () => files().map(file => ({ ...file, version: 'unchanged' }));
    await service.index.refresh(); vault.reset(); vault.data.set('Privat/Notiz 1.md', utf8('Neue Idee')); service.index.invalidate('Privat/Notiz 1.md');
    await service.index.refresh(); expect(vault.reads).toEqual(['Privat/Notiz 1.md']);
  });
  it('always rereads sources for authorization and rejects a same-stat edit made after preview', async () => {
    const { vault, service, pkg } = await setup(), files = vault.files.bind(vault); vault.files = () => files().map(file => ({ ...file, version: 'same' }));
    const snapshot = await service.displaySnapshot(pkg.project.id); setEntry(snapshot.exchange, createRecord('notes', pkg.project.id, pkg.producer.instanceId, 'Neue Notiz'));
    const preview = await service.previewSave(snapshot.exchange, snapshot), path = snapshot.state.manifestPath;
    vault.data.set(path, utf8(text(vault.data.get(path)!).replace('Messprojekt', 'Testprojekt'))); vault.reset();
    await expect(service.commit(preview)).rejects.toThrow('LOCAL_CHANGED'); expect(text(vault.data.get(path)!)).toContain('Testprojekt');
    expect(vault.reads.filter(path => path.startsWith('Privat/')).length).toBe(200);
  });
  it('detects a copied identity created after a warm display cache without relying on events', async () => {
    const { vault, service, pkg } = await setup(), snapshot = await service.displaySnapshot(pkg.project.id);
    const preview = await service.previewSave(snapshot.exchange, snapshot);
    vault.data.set('Privat/Kopie.md', vault.data.get(snapshot.state.manifestPath)!.slice());
    await expect(service.commit(preview)).rejects.toThrow('DUPLICATE_ID');
  });
  it('does not share a hint-only in-flight scan with a caller that needs fresh source authorization', async () => {
    const { vault } = await setup(), index = new ProjectIndex(vault); await index.rebuild();
    const files = vault.files.bind(vault); let release!: () => void, reached!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { reached = resolve; });
    const read = vault.read.bind(vault); vault.read = async path => { if (path === 'Privat/Notiz 0.md') { reached(); await pending; } return read(path); };
    index.invalidate('Privat/Notiz 0.md'); const hints = index.refresh(); await started; const fresh = index.rebuild(); release(); await Promise.all([hints, fresh]);
    expect(files().length).toBeGreaterThan(200); expect(vault.reads.filter(path => path === 'Privat/Notiz 0.md').length).toBeGreaterThanOrEqual(3);
  });
  it('never reopens completed original backups during ordinary snapshots, but recovery still verifies them', async () => {
    const { vault, service, pkg } = await setup(); vault.reset(); await service.snapshot(pkg.project.id);
    expect(vault.reads.some(path => path.endsWith('.bin'))).toBe(false);
    const backup = vault.files().find(file => file.path.endsWith('-after.bin'))!.path; vault.data.delete(backup);
    await expect(service.snapshot(pkg.project.id)).resolves.toBeDefined();
    const journal = vault.files().find(file => file.path.endsWith('/journal.json'))!.path;
    await expect(service.journal.recover(journal, pkg.project.id)).rejects.toThrow('STATE_MISSING');
  });
  it('blocks a pending journal introduced after a preview before writing any planned target', async () => {
    const { vault, service, pkg } = await setup(), snapshot = await service.snapshot(pkg.project.id);
    setEntry(snapshot.exchange, createRecord('notes', pkg.project.id, pkg.producer.instanceId, 'Neue Notiz')); const preview = await service.previewSave(snapshot.exchange, snapshot);
    const path = vault.files().find(file => file.path.endsWith('/journal.json'))!.path, journal = JSON.parse(text(vault.data.get(path)!)); journal.status = 'prepared'; vault.data.set(path, utf8(JSON.stringify(journal)));
    const writes = vault.writes; await expect(service.commit(preview)).rejects.toThrow('LOCAL_CHANGED'); expect(vault.writes).toBe(writes);
  });
  it('rejects malformed completion metadata rather than trusting a terminal status alone', async () => {
    const { vault, service, pkg } = await setup(), path = vault.files().find(file => file.path.endsWith('/journal.json'))!.path;
    const journal = JSON.parse(text(vault.data.get(path)!)); journal.journalVersion = 99; vault.data.set(path, utf8(JSON.stringify(journal)));
    await expect(service.snapshot(pkg.project.id)).rejects.toThrow('STATE_MISSING');
  });
});
