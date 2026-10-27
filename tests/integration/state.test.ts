import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encode } from 'fast-png';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { readExchange, validateExchange } from '../../src/exchange/codec';
import { decodeProjectState, decodeRecordState } from '../../src/storage/state';
import { previewRepair } from '../../src/projects/repair';
import { previewChangedAssets } from '../../src/projects/assets';
import { forkProject, changeCatalogType, transferObject } from '../../src/projects/fork';
import { recordHash } from '../../src/exchange/hash';
import { text, utf8 } from '../../src/storage/vault-port';
import { entries } from '../../src/domain/records';

/** Builds an isolated synthetic imported project for state migration and repair checks. */
async function setup() {
  const pkg = await readExchange(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url)));
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  await service.commit(await service.resolve(await service.previewImport(pkg, 'new')));
  return { pkg, vault, service };
}
describe('portable v1-Zustände, Migration und unabhängige Kopien', () => {
  it('lädt v1 verlustfrei und lehnt fremde Versionen und Besitz ab', async () => {
    const { pkg, service } = await setup(), snap = await service.snapshot(pkg.project.id);
    expect(decodeProjectState(JSON.stringify(snap.state), pkg.project.id)).toEqual(snap.state);
    expect(() => decodeProjectState(JSON.stringify({ ...snap.state, stateVersion: 2 }), pkg.project.id)).toThrow('STATE_MISSING');
    expect(() => decodeProjectState(JSON.stringify(snap.state), 'fremd')).toThrow();
    const stored = [...snap.records.values()][0]!;
    expect(await decodeRecordState(JSON.stringify(stored), stored.collection, stored.id, pkg.project.id)).toEqual(stored);
    await expect(decodeRecordState(JSON.stringify({ ...stored, stateVersion: 2 }), stored.collection, stored.id, pkg.project.id)).rejects.toThrow();
  });
  it('repariert fehlende Begleitdatei aus Original und behält bearbeitete Notiz', async () => {
    const { pkg, vault, service } = await setup(), snap = await service.snapshot(pkg.project.id);
    const note = service.index.find(pkg.project.id, 'scenes', 'scene-ankunft')!, location = snap.state.records.find(r => r.id === note.id)!;
    vault.data.set(note.path, utf8(note.source + '\nBewusst lokaler Zusatz.'));
    vault.data.delete(location.sidecarPath);
    await expect(service.snapshot(pkg.project.id)).rejects.toThrow('STATE_MISSING');
    await service.commit(await previewRepair(service, pkg));
    const repaired = await service.snapshot(pkg.project.id);
    expect(repaired.exchange.scenes.find(s => s.id === note.id)!.content.text).toContain('Bewusst lokaler Zusatz.');
    expect(repaired.exchange.catalogItems).toEqual(pkg.catalogItems);
  });
  it('repariert verlorenen Projektzustand ohne Plugin-Einstellungen', async () => {
    const { pkg, vault, service } = await setup(), snap = await service.snapshot(pkg.project.id);
    vault.data.delete(snap.statePath);
    const restarted = new TransferCoordinator(vault, { ...defaultSettings, dataFolder: 'Anders' });
    await restarted.commit(await previewRepair(restarted, pkg));
    expect((await restarted.snapshot(pkg.project.id)).exchange.attachments).toEqual(pkg.attachments);
  });
  it('forkt typisierte Refs und Origins, erhält partId und opaque JSON', async () => {
    const { pkg } = await setup(), result = forkProject(pkg, 'neue-instanz').exchange;
    await validateExchange(result);
    expect(result.project.id).not.toBe(pkg.project.id);
    expect(result.project.extensions['org.writeller.fork']).toEqual({ projectId: pkg.project.id });
    expect(result.chapters[0]!.partId).toBe(pkg.chapters[0]!.partId);
    expect(result.catalogItems[0]!.fields).toEqual(pkg.catalogItems[0]!.fields);
    expect(entries(result).every(e => e.record.baseHash === null && e.record.origin.instanceId === 'neue-instanz')).toBe(true);
    expect(result.attachments[0]!.data).toBe(pkg.attachments[0]!.data);
    expect(result.scenes[0]!.content.text).not.toContain('entity:catalogItems/location-turm');
    expect(result.scenes[0]!.content.text).toContain('entity:catalogItems/nicht-vorhanden');
  });
  it('prüft Typwechsel und Objekttransfer auf eingehende und ausgehende Refs', async () => {
    const { pkg } = await setup();
    expect(() => changeCatalogType(pkg, 'character-lina', 'location')).toThrow('MISSING_REFERENCE');
    const target = forkProject(pkg, 'andere').exchange;
    expect(() => transferObject(pkg, { collection: 'scenes', record: pkg.scenes[0]! }, target)).toThrow();
  });
  it('identifiziert geänderte Bildbytes neu und erhält Original sowie Layout', async () => {
    const { pkg, vault, service } = await setup(), snap = await service.snapshot(pkg.project.id);
    const asset = snap.state.assets[0]!;
    const changed = encode({ width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]), channels: 4, depth: 8 });
    vault.data.set(asset.path, changed);
    await expect(service.previewExport(pkg.project.id, null)).rejects.toThrow('UNSUPPORTED_REPRESENTATION');
    const preview = await previewChangedAssets(service, pkg); await service.commit(preview);
    const repaired = await service.snapshot(pkg.project.id);
    expect(repaired.exchange.attachments).toHaveLength(pkg.attachments.length + 1);
    expect(repaired.exchange.attachments.find(a => a.id === asset.id)!.data).toBe(pkg.attachments[0]!.data);
    const scene = repaired.exchange.scenes.find(s => s.id === 'scene-ankunft')!;
    expect(scene.content.text).toContain('?width=70&align=center');
    expect(scene.content.text).not.toContain('asset:' + asset.id);
    expect(scene.extensions['org.writeller.text-review']).toBeDefined();
    expect(await vault.read(asset.path)).toEqual(changed);
  });
  it('blockiert nachträglich manipulierte Begleitpfade und verändert keine fremde Datei', async () => {
    const { pkg, vault, service } = await setup(), snap = await service.snapshot(pkg.project.id);
    const state = structuredClone(snap.state); state.records[0]!.sidecarPath = 'Fremde-Datei.json';
    vault.data.set(snap.statePath, utf8(JSON.stringify(state)));
    vault.data.set('Fremde-Datei.json', utf8('unberührt'));
    await expect(service.previewExport(pkg.project.id, null)).rejects.toThrow('STATE_MISSING');
    expect(text((await vault.read('Fremde-Datei.json'))!)).toBe('unberührt');
  });
  it('behält erhaltene Bildbytes und Hashes auch bei unbenutzten Bildern', async () => {
    const { pkg, service } = await setup(), snapshot = await service.snapshot(pkg.project.id);
    const out = await service.previewExport(pkg.project.id, null);
    expect(await recordHash(out.exchange.project)).toBe(await recordHash(snapshot.exchange.project));
    expect(out.exchange.attachments).toEqual(pkg.attachments);
  });
});
