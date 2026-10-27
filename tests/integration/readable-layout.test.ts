import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { entries, recordKey, setEntry } from '../../src/domain/records';
import { readExchange } from '../../src/exchange/codec';
import { sha256, recordHash } from '../../src/exchange/hash';
import { projectRecord } from '../../src/mapping/projection';
import { renderNote, recordProperties } from '../../src/mapping/frontmatter';
import { planOrganization, organizationFresh } from '../../src/projects/organize-plan';
import { LayoutJournalService } from '../../src/storage/layout-journal';
import { pendingJournals } from '../../src/storage/recovery-index';
import { utf8, text } from '../../src/storage/vault-port';
import { NameAllocator, readableName } from '../../src/projects/names';
import { moveInManuscript } from '../../src/objects/reorder';

/** Produces a real old-layout fixture from independent Exchange data, not a user vault. */
async function legacy(vault = new FakeVault()) {
  const service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = await readExchange(readFileSync(new URL('../fixtures/harbor.writeller-exchange.json', import.meta.url)));
  await service.commit(await service.resolve(await service.previewImport(pkg, 'new')));
  const snapshot = await service.snapshot(pkg.project.id), base = `Schreibprojekte/Hafen-${await sha256(pkg.project.id)}`;
  const locations = new Map<string, string>();
  for (const r of snapshot.state.records) locations.set(recordKey(r.collection, r.id), `${base}/${r.collection}/${await sha256(r.id)}.md`);
  for (const e of entries(pkg)) {
    const key = recordKey(e.collection, e.record.id), old = snapshot.state.records.find(r => recordKey(r.collection, r.id) === key)!;
    const projected = projectRecord(e, { entityPath: k => locations.get(k), assetPath: hash => snapshot.state.assets.find(a => a.id === hash)?.path });
    const stored = snapshot.records.get(key)!; stored.projection = projected.projection;
    vault.data.delete(old.notePath); old.notePath = locations.get(key)!;
    vault.data.set(old.notePath, utf8(renderNote(recordProperties(e.collection, e.record, pkg.project.id, snapshot.statePath), projected.projection.body)));
    vault.data.set(old.sidecarPath, utf8(JSON.stringify(stored, null, 2)));
  }
  snapshot.state.manifestPath = locations.get(`project/${pkg.project.id}`)!;
  vault.data.set(snapshot.statePath, utf8(JSON.stringify(snapshot.state, null, 2)));
  return { service, pkg, vault };
}
describe('menschenlesbare Schreibprojekte', () => {
  it('verwendet Titel und echte Namenskollisionen statt Identitätssuffixen', async () => {
    const names = new NameAllocator(['Projekte/Buch/Buch.md', 'Notizen/Lina.md']);
    expect(names.allocate('Projekte', 'Buch')).toBe('Projekte/Buch (2)');
    expect(names.allocate('Notizen', 'lina', '.md')).toBe('Notizen/lina (2).md');
    expect(readableName('CON')).toBe('Notiz CON');
    expect(readableName('Schiff / Meer')).toBe('Schiff – Meer');
    expect(readableName('a'.repeat(79) + '🌊')).not.toMatch(/[\uD800-\uDBFF]$/u);
  });
  it('legt Kapitel, Szenen und bekannte Katalogarten in den verständlichen Ordnern ab', async () => {
    const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), pkg = createProject('Mein erstes Buch');
    const chapter = createRecord('chapters', pkg.project.id, pkg.producer.instanceId, 'Die Ankunft'); setEntry(pkg, chapter);
    const scene = createRecord('scenes', pkg.project.id, pkg.producer.instanceId, 'Nebel am Hafen');
    if (scene.collection !== 'scenes') throw new Error('Testinvariante'); scene.record.chapterId = chapter.record.id; setEntry(pkg, scene);
    for (const [type, title] of [['character', 'Lina'], ['location', 'Alter Hafen'], ['object', 'Kompass'], ['timelineEvent', 'Sturm'], ['arc', 'Vertrauen']]) setEntry(pkg, createRecord('catalogItems', pkg.project.id, pkg.producer.instanceId, title!, { type: type! }));
    await service.commit(await service.previewSave(pkg, null));
    const paths = vault.files().filter(f => f.markdown).map(f => f.path);
    expect(paths).toContain('Schreibprojekte/Mein erstes Buch/Mein erstes Buch.md');
    expect(paths).toContain('Schreibprojekte/Mein erstes Buch/Manuskript/01 - Die Ankunft/01 - Nebel am Hafen.md');
    expect(paths).toContain('Schreibprojekte/Mein erstes Buch/Figuren/Lina.md');
    expect(paths).toContain('Schreibprojekte/Mein erstes Buch/Orte/Alter Hafen.md');
    expect(paths.every(p => !/[a-f0-9]{32,}/.test(p))).toBe(true);
  });
  it('erweitert ein umgezogenes Projekt am tatsächlichen Manifest statt einen neuen Projektordner zu erfinden', async () => {
    const { vault, service, pkg } = await legacy();
    const before = await service.snapshot(pkg.project.id), manifest = before.state.manifestPath;
    vault.data.set('Eigene Ordnung/Mein Buch.md', vault.data.get(manifest)!); vault.data.delete(manifest);
    const snapshot = await service.snapshot(pkg.project.id);
    setEntry(snapshot.exchange, createRecord('notes', pkg.project.id, snapshot.state.localInstanceId, 'Neue Idee'));
    await service.commit(await service.previewSave(snapshot.exchange, snapshot));
    expect(vault.data.has('Eigene Ordnung/Notizen/Neue Idee.md')).toBe(true);
  });
  it('ordnet alte Hash-Dateinamen ausdrücklich um und erhält alle Fachhashes, Ursprünge und Basen', async () => {
    const { vault, service, pkg } = await legacy(), snapshot = await service.snapshot(pkg.project.id);
    const plan = await planOrganization(vault, service.index, snapshot, service.settings);
    expect(await organizationFresh(vault, service.index, plan)).toBe(true);
    expect(plan.moves.length).toBe(entries(pkg).length);
    await new LayoutJournalService(vault).commit(plan);
    const after = await service.snapshot(pkg.project.id);
    for (const e of entries(after.exchange)) {
      const before = entries(pkg).find(b => b.collection === e.collection && b.record.id === e.record.id)!;
      expect(await recordHash(e.record)).toBe(await recordHash(before.record));
      expect(after.records.get(recordKey(e.collection, e.record.id))?.peerBaselines).toEqual(snapshot.records.get(recordKey(e.collection, e.record.id))?.peerBaselines);
    }
    expect(after.exchange.attachments).toEqual(pkg.attachments);
    expect((await pendingJournals(vault)).length).toBe(0);
    expect((await planOrganization(vault, service.index, after, service.settings)).moves).toEqual([]);
  });
  it('rollt einen injizierten Umbenennungsfehler zurück und erkennt eine nachträgliche Änderung vor Start', async () => {
    const { vault, service, pkg } = await legacy(), snap = await service.snapshot(pkg.project.id), plan = await planOrganization(vault, service.index, snap, service.settings);
    const move = vault.move.bind(vault); let count = 0;
    vault.move = async (...args) => { if (++count === 2) throw new Error('injected rename failure'); await move(...args); };
    await expect(new LayoutJournalService(vault).commit(plan)).rejects.toThrow();
    for (const [path, bytes] of snap.files) expect(await vault.read(path)).toEqual(bytes);
    expect(await pendingJournals(vault)).toEqual([]);
    vault.data.set(plan.moves[0]!.from, utf8('Zwischenzeitliche Änderung'));
    expect(await organizationFresh(vault, service.index, plan)).toBe(false);
  });
  it('kann einen Prozessabbruch nach einer Umbenennung über den allgemeinen Recovery-Befehl wiederherstellen', async () => {
    const { vault, service, pkg } = await legacy(), snap = await service.snapshot(pkg.project.id), plan = await planOrganization(vault, service.index, snap, service.settings);
    const move = vault.move.bind(vault), read = vault.read.bind(vault); let dead = false;
    vault.move = async (...args) => { await move(...args); dead = true; throw new Error('process exited'); };
    vault.read = async path => { if (dead) throw new Error('process exited'); return read(path); };
    await expect(new LayoutJournalService(vault).commit(plan)).rejects.toThrow();
    const restarted = new FakeVault(); restarted.data = new Map(vault.data);
    const pending = await pendingJournals(restarted); expect(pending).toHaveLength(1);
    const coordinator = new TransferCoordinator(restarted, { ...defaultSettings });
    expect((await coordinator.journal.recover(pending[0]!.path, pkg.project.id)).conflicts).toEqual([]);
    for (const [path, bytes] of snap.files) expect(await restarted.read(path)).toEqual(bytes);
  });
  it('bewahrt fremde Nachbearbeitung nach einer unterbrochenen Umbenennung', async () => {
    const { vault, service, pkg } = await legacy(), snap = await service.snapshot(pkg.project.id), plan = await planOrganization(vault, service.index, snap, service.settings);
    const move = vault.move.bind(vault); let step = 0;
    vault.move = async (...args) => { await move(...args); if (++step === 1) { vault.data.set(args[1], utf8('Fremde Nachbearbeitung')); throw new Error('interrupted'); } };
    await expect(new LayoutJournalService(vault).commit(plan)).rejects.toThrow();
    expect(text((await vault.read(plan.moves[0]!.to))!)).toBe('Fremde Nachbearbeitung');
    expect(await pendingJournals(vault)).toHaveLength(1);
  });
  it('ordnet nur Geschwisterszenen um, nicht die Kapitelzugehörigkeit', async () => {
    const { pkg } = await legacy(), scene = pkg.scenes[1]!;
    expect(moveInManuscript(pkg, { collection: 'scenes', record: scene }, -1)).toBe(false);
    expect(scene.chapterId).toBe(pkg.scenes[0]!.chapterId);
    expect(moveInManuscript(pkg, { collection: 'chapters', record: pkg.chapters[1]! }, -1)).toBe(true);
    expect(pkg.chapters[1]!.orderIndex).toBe(0);
  });
});
