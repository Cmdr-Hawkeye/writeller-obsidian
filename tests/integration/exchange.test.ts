import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { readExchange } from '../../src/exchange/codec';
import { entries, recordKey } from '../../src/domain/records';
import { recordHash } from '../../src/exchange/hash';
import { text, utf8 } from '../../src/storage/vault-port';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';

/** Loads only the independent synthetic fixtures, never a Writeller installation. */
const fixture = (name: string) => readExchange(readFileSync(new URL(`../fixtures/${name}.writeller-exchange.json`, import.meta.url)));
/** Runs the full preview/resolve/commit pipeline through the API fake. */
async function imported(name = 'harbor') {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = await fixture(name), plan = await service.previewImport(pkg, 'new'), preview = await service.resolve(plan);
  await service.commit(preview);
  return { vault, service, pkg, preview };
}
describe('API-Fake: Projektidentität und verlustarmer Austausch', () => {
  it('erhält alle semantischen Hashes und Bildbytes beim Roundtrip', async () => {
    const { vault, service, pkg } = await imported();
    const result = await service.previewExport(pkg.project.id, null);
    const before = new Map(entries(pkg).map(e => [recordKey(e.collection, e.record.id), e.record]));
    for (const e of entries(result.exchange)) expect(await recordHash(e.record)).toBe(await recordHash(before.get(recordKey(e.collection, e.record.id))!));
    expect(result.exchange.attachments).toEqual(pkg.attachments);
    const manuscripts = new Map([...vault.data].filter(([p]) => p.endsWith('.md')).map(([p, b]) => [p, text(b)]));
    await service.commit(result.preview);
    expect([...vault.data].filter(([p]) => p.endsWith('.md')).map(([p, b]) => [p, text(b)])).toEqual([...manuscripts]);
  });
  it('trennt Projekte bei gleichen Objekt-IDs, Ordnern und Titeln', async () => {
    const { vault, service, pkg } = await imported();
    const forest = await fixture('forest'); forest.project.title = pkg.project.title;
    await service.commit(await service.resolve(await service.previewImport(forest, 'new')));
    const other = service.index.notes.find(n => n.projectId === forest.project.id && n.collection === 'scenes')!;
    const bytes = vault.data.get(other.path)!; vault.data.delete(other.path);
    vault.data.set('Schreibprojekte/Fremder Ordner.md', bytes);
    const restarted = new TransferCoordinator(vault, { ...defaultSettings, dataFolder: 'Andere-Daten' });
    const a = await restarted.previewExport(pkg.project.id, null), b = await restarted.previewExport(forest.project.id, null);
    expect(a.exchange.scenes.every(s => s.projectId === pkg.project.id)).toBe(true);
    expect(b.exchange.scenes.every(s => s.projectId === forest.project.id)).toBe(true);
    expect(a.exchange.scenes.map(s => s.id).sort()).toEqual(b.exchange.scenes.map(s => s.id).sort());
  });
  it('erkennt Dateikopien und neue Duplikate nach Vorschau', async () => {
    const { vault, service, pkg } = await imported();
    const out = await service.previewExport(pkg.project.id, null);
    const note = service.index.notes.find(n => n.collection === 'scenes')!;
    vault.data.set('Kopie.md', utf8(note.source));
    await expect(service.commit(out.preview)).rejects.toThrow('DUPLICATE_ID');
  });
  it('reimportiert ohne neue Dateien oder Journal bei No-op', async () => {
    const { vault, service, pkg } = await imported();
    const writes = vault.writes, size = vault.data.size;
    const plan = await service.previewImport(pkg, 'update', pkg.project.id);
    expect(plan.rows.every(r => r.action === 'unchanged')).toBe(true);
    await service.commit(await service.resolve(plan));
    expect(vault.writes).toBe(writes); expect(vault.data.size).toBe(size);
  });
  it('übernimmt entfernten Edit auf bekannter unveränderter Basis', async () => {
    const { service, pkg } = await imported();
    const incoming = await fixture('harbor-edited');
    const plan = await service.previewImport(incoming, 'update', pkg.project.id);
    expect(plan.rows.find(r => r.key === 'scenes/scene-ankunft')?.action).toBe('incoming');
    await service.commit(await service.resolve(plan));
    expect((await service.snapshot(pkg.project.id)).exchange.scenes[0]?.content).toEqual(incoming.scenes[0]?.content);
  });
  it('meldet beidseitige Edits und erhält Annotationen bei einem lokalen Edit', async () => {
    const { vault, service, pkg } = await imported();
    const note = service.index.find(pkg.project.id, 'scenes', 'scene-ankunft')!;
    vault.data.set(note.path, utf8(note.source + '\nLokaler Zusatz.'));
    const plan = await service.previewImport(await fixture('harbor-edited'), 'update', pkg.project.id);
    expect(plan.rows.find(r => r.key === 'scenes/scene-ankunft')?.action).toBe('conflict');
    await expect(service.resolve(plan)).rejects.toThrow('CONTENT_CONFLICT');
    const snap = await service.snapshot(pkg.project.id), edited = snap.exchange.scenes.find(s => s.id === 'scene-ankunft')!;
    expect(edited.metadata['annotations']).toBeUndefined();
    expect(edited.extensions['org.writeller.text-review']).toBeDefined();
    const original = new Map(entries(pkg).map(e => [recordKey(e.collection, e.record.id), e.record]));
    for (const e of entries(snap.exchange).filter(e => e.record.id !== 'scene-ankunft')) expect(await recordHash(e.record)).toBe(await recordHash(original.get(recordKey(e.collection, e.record.id))!));
  });
  it('blockiert fremdes Zielprojekt und wiederverwendete Paket-ID mit neuem Inhalt', async () => {
    const { service, pkg } = await imported();
    await expect(service.previewImport(pkg, 'update', 'fremd')).rejects.toThrow('PROJECT_MISMATCH');
    const changed = structuredClone(pkg); changed.project.title = 'Anderer Titel';
    await expect(service.previewImport(changed, 'update', pkg.project.id)).rejects.toThrow('IDENTITY_CONFLICT');
  });
  it('legt gelöschtes Objekt nicht still wieder an', async () => {
    const { vault, service, pkg } = await imported();
    const note = service.index.find(pkg.project.id, 'researchItems', 'research-6')!;
    vault.data.delete(note.path);
    const plan = await service.previewImport(pkg, 'update', pkg.project.id);
    expect(plan.rows.find(r => r.key === 'researchItems/research-6')?.reason).toBe('deleted');
    await expect(service.resolve(plan)).rejects.toThrow('CONTENT_CONFLICT');
  });
  it('erkennt veränderte Quellen, fehlende Begleitdateien und Assets', async () => {
    const { vault, service, pkg } = await imported();
    const out = await service.previewExport(pkg.project.id, null);
    const note = service.index.find(pkg.project.id, 'project', pkg.project.id)!;
    vault.data.set(note.path, utf8(note.source + 'Bearbeitung'));
    await expect(service.commit(out.preview)).rejects.toThrow('LOCAL_CHANGED');
    vault.data.set(note.path, utf8(note.source));
    const snap = await service.snapshot(pkg.project.id), sidecar = snap.state.records.find(r => r.collection === 'scenes')!.sidecarPath;
    vault.data.delete(sidecar);
    await expect(service.previewExport(pkg.project.id, null)).rejects.toThrow('STATE_MISSING');
  });
  it('erstellt Projekte und alle Sammlungen ohne Writeller', async () => {
    const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
    const pkg = createProject('Eigenes Projekt');
    for (const collection of ['chapters', 'scenes', 'catalogItems', 'notes', 'researchItems'] as const) {
      setEntry(pkg, createRecord(collection, pkg.project.id, pkg.producer.instanceId, collection));
    }
    setEntry(pkg, createRecord('relationships', pkg.project.id, pkg.producer.instanceId, 'Verbindung', {
      source: { collection: 'scenes', id: pkg.scenes[0]!.id }, target: { collection: 'catalogItems', id: pkg.catalogItems[0]!.id }
    }));
    await service.commit(await service.previewSave(pkg, null));
    expect(entries((await service.snapshot(pkg.project.id)).exchange)).toHaveLength(7);
  });
});
