import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings, newLayout } from '../../src/projects/layout';
import { readExchange } from '../../src/exchange/codec';
import { snapshotProject } from '../../src/projects/snapshot';
import { recordKey } from '../../src/domain/records';
import { newId } from '../../src/exchange/hash';
import { utf8, text } from '../../src/storage/vault-port';
import { reverseBody } from '../../src/mapping/projection';

/** Imports a synthetic package before exercising explicit user decisions. */
async function setup(name = 'minimal') {
  const pkg = await readExchange(readFileSync(new URL(`../fixtures/${name}.writeller-exchange.json`, import.meta.url)));
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  await service.commit(await service.resolve(await service.previewImport(pkg, 'new')));
  return { pkg, vault, service };
}
describe('explizite Konflikt- und Repräsentationsentscheidungen', () => {
  it('übernimmt eine bewusst ausgewählte Origin-Linie ohne Vermischen alter Basen', async () => {
    const { pkg, service } = await setup();
    const incoming = structuredClone(pkg); incoming.packageId = newId(); incoming.scenes[0]!.origin.instanceId = 'andere-linie';
    const plan = await service.previewImport(incoming, 'update', pkg.project.id), row = plan.rows.find(r => r.entry.collection === 'scenes')!;
    expect(row.reason).toBe('origin');
    await expect(service.resolve(plan)).rejects.toThrow('CONTENT_CONFLICT');
    const preview = await service.resolve(plan, new Map([[row.key, { choice: 'incoming' as const }]]));
    await service.commit(preview);
    const snap = await service.snapshot(pkg.project.id), state = snap.records.get(row.key)!;
    expect(snap.exchange.scenes[0]!.origin.instanceId).toBe('andere-linie');
    expect(state.knownHashes.exported).toEqual([]);
    expect(state.peerBaselines.every(b => b.acceptedRecord.origin.instanceId === 'andere-linie')).toBe(true);
  });
  it('lässt fehlende lokale Objekte weg und stellt sie nur nach expliziter Entscheidung wieder her', async () => {
    const { pkg, vault, service } = await setup(), note = service.index.find(pkg.project.id, 'scenes', pkg.scenes[0]!.id)!;
    vault.data.delete(note.path);
    const plan = await service.previewImport(pkg, 'update', pkg.project.id), key = recordKey('scenes', pkg.scenes[0]!.id);
    await service.commit(await service.resolve(plan, new Map([[key, { choice: 'local' as const }]])));
    expect((await service.snapshot(pkg.project.id)).exchange.scenes).toEqual([]);
    const again = await service.previewImport(pkg, 'update', pkg.project.id);
    expect(again.rows.find(r => r.key === key)?.reason).toBe('deleted');
    await service.commit(await service.resolve(again, new Map([[key, { choice: 'incoming' as const }]])));
    expect((await service.snapshot(pkg.project.id)).exchange.scenes).toHaveLength(1);
  });
  it('schützt fremde Kollisionen am geplanten Notizpfad', async () => {
    const { pkg } = await setup(), vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
    const layout = await newLayout(pkg, defaultSettings), path = layout.state.records[0]!.notePath;
    vault.data.set(path, utf8('Fremde normale Notiz'));
    const preview = await service.resolve(await service.previewImport(pkg, 'new'));
    expect(preview.layout.state.manifestPath).not.toBe(path);
    expect(preview.layout.state.manifestPath).toContain('(2)');
    await service.commit(preview);
    expect(text((await vault.read(path))!)).toBe('Fremde normale Notiz');
  });
  it('ermöglicht einen ausdrücklichen JSON-Entscheid nach bearbeiteter erzeugter Ansicht', async () => {
    const { pkg, vault, service } = await setup('harbor'), relation = service.index.notes.find(n => n.collection === 'relationships')!;
    vault.data.set(relation.path, utf8(relation.source + '\nNicht zugeordnet.'));
    await expect(service.snapshot(pkg.project.id)).rejects.toThrow('UNSUPPORTED_REPRESENTATION');
    const snapshot = await snapshotProject(vault, service.index, pkg.project.id, false, new Map(), recordKey(relation.collection, relation.id));
    const preview = await service.previewSave(snapshot.exchange, snapshot);
    expect(snapshot.warnings.some(w => w.code === 'UNSUPPORTED_REPRESENTATION')).toBe(true);
    await service.commit(preview);
    expect((await service.snapshot(pkg.project.id)).exchange.relationships).toEqual(pkg.relationships);
  });
  it('blockiert mehrdeutiges Bildlayout und erlaubt dessen explizite URI-Zuordnung', async () => {
    const { pkg } = await setup('harbor'), scene = pkg.scenes[0]!, hash = pkg.attachments[0]!.id;
    const projection = { body: 'vorher', protected: false, links: [
      { localPath: 'bild.png', image: true, originalUrl: `asset:${hash}?width=70&align=center` },
      { localPath: 'bild.png', image: true, originalUrl: `asset:${hash}?width=40&align=left` }
    ] };
    const body = '![Bild](bild.png)\n\nZusatz';
    await expect(reverseBody(scene, body, projection, { entityUrl: () => null, assetHash: () => hash })).rejects.toThrow('UNSUPPORTED_REPRESENTATION');
    await expect(reverseBody(scene, `![Bild](asset:${hash}?width=40&align=left)\n\nZusatz`, projection, { entityUrl: () => null, assetHash: () => hash })).resolves.toBeDefined();
  });
  it('lässt literale Wikilinks im Code bei Textänderung unverändert', async () => {
    const { pkg } = await setup();
    const record = pkg.scenes[0]!; record.content.format = 'markdown';
    const body = '`[[Wörtlich]]`\n\n[[Ziel|Text]]\n';
    const result = await reverseBody(record, body, null, { entityUrl: link => link === 'Ziel' ? `entity:scenes/${record.id}` : null, assetHash: () => null });
    if (!('content' in result.record)) throw new Error('Testinvariante');
    expect(result.record.content.text).toContain('`[[Wörtlich]]`');
    expect(result.record.content.text).toContain(`[Text](<entity:scenes/${record.id}>)`);
  });
});
