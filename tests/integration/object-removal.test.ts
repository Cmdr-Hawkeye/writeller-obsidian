import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import type { CatalogItem, Scene } from '../../src/domain/types';
import { inspectReferences, planObjectDeletion, planReferenceRepair, trashRemoved } from '../../src/projects/object-removal';
import { detachReferences } from '../../src/objects/detach';
import { utf8 } from '../../src/storage/vault-port';

/** A scene whose point of view, relationship, note target and text link all point at one character. */
async function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings });
  const pkg = createProject('Der Hafen'), id = pkg.project.id, instance = pkg.producer.instanceId;
  const anna = createRecord('catalogItems', id, instance, 'Anna', { type: 'character' }).record as CatalogItem;
  const scene = createRecord('scenes', id, instance, 'Ankunft').record as Scene;
  scene.povCharacterId = anna.id; scene.content = { format: 'markdown', text: `Am Kai wartet [Anna](entity:catalogItems/${anna.id}).` };
  setEntry(pkg, { collection: 'catalogItems', record: anna }); setEntry(pkg, { collection: 'scenes', record: scene });
  setEntry(pkg, createRecord('relationships', id, instance, 'appearsIn', { source: { collection: 'scenes', id: scene.id }, target: { collection: 'catalogItems', id: anna.id } }));
  const note = createRecord('notes', id, instance, 'Annas Herkunft'); if ('target' in note.record) note.record.target = { collection: 'catalogItems', id: anna.id };
  setEntry(pkg, note);
  await service.commit(await service.previewSave(pkg, null));
  const path = service.index.find(id, 'catalogItems', anna.id)!.path;
  return { vault, service, id, anna, scene, path };
}

describe('regular object deletion', () => {
  it('cleans every reference in one save and moves the notes to the trash', async () => {
    const { vault, service, id, anna, scene, path } = await setup();
    const relationship = service.index.notes.find(n => n.collection === 'relationships')!.path;
    const plan = await planObjectDeletion(service, id, `catalogItems/${anna.id}`);
    expect(plan.detachment).toMatchObject({ pov: 1, targets: 1, links: 1 });
    expect(plan.detachment.removed).toHaveLength(2);
    await service.commit(plan.preview); await trashRemoved(service, plan);
    expect(vault.data.has(path)).toBe(false); expect(vault.data.has(relationship)).toBe(false);
    const after = (await service.snapshot(id)).exchange, kept = after.scenes.find(s => s.id === scene.id)!;
    expect(after.catalogItems).toEqual([]); expect(after.relationships).toEqual([]);
    expect(kept.povCharacterId).toBeNull(); expect(kept.content.text).toBe('Am Kai wartet Anna.');
    expect(after.notes[0]!.target).toBeNull();
  });
  it('refuses to delete the project itself', async () => {
    const { service, id } = await setup();
    await expect(planObjectDeletion(service, id, `project/${id}`)).rejects.toThrow();
  });
  it('clears scene placement when a chapter or parent scene goes away', () => {
    const pkg = createProject('Kapitel'), chapter = createRecord('chapters', pkg.project.id, 'x', 'Eins');
    const parent = createRecord('scenes', pkg.project.id, 'x', 'Oben').record as Scene, child = createRecord('scenes', pkg.project.id, 'x', 'Unten').record as Scene;
    parent.chapterId = chapter.record.id; child.chapterId = chapter.record.id; child.parentSceneId = parent.id;
    setEntry(pkg, chapter); setEntry(pkg, { collection: 'scenes', record: parent }); setEntry(pkg, { collection: 'scenes', record: child });
    const result = detachReferences(pkg, [`chapters/${chapter.record.id}`, `scenes/${parent.id}`]);
    expect(pkg.scenes.map(s => [s.id, s.chapterId, s.parentSceneId])).toEqual([[child.id, null, null]]);
    expect(result.placement).toBe(2);
  });
});

describe('repair after a note was deleted by hand', () => {
  it('detects the dangling references and restores the object from its preserved data', async () => {
    const { vault, service, id, anna, scene, path } = await setup();
    vault.data.delete(path); service.index.invalidate(path);
    await expect(service.snapshot(id)).rejects.toThrow();
    const found = await inspectReferences(service, id);
    expect(found.missing).toContain(`catalogItems/${anna.id}`); expect(found.restorable).toContain(`catalogItems/${anna.id}`);
    const plan = await planReferenceRepair(service, id, true);
    expect(plan.restored).toEqual([`catalogItems/${anna.id}`]); expect(plan.moved).toEqual([]);
    await service.commit(plan.preview); await trashRemoved(service, plan);
    const after = (await service.snapshot(id)).exchange;
    expect(after.catalogItems.map(c => c.name)).toEqual(['Anna']);
    expect(after.scenes.find(s => s.id === scene.id)!.povCharacterId).toBe(anna.id);
    expect(vault.data.has(path)).toBe(true);
  });
  it('restores next to a plain file that took the old name', async () => {
    const { vault, service, id, anna, path } = await setup();
    vault.data.set(path, utf8('Neu angelegt')); service.index.invalidate(path);
    const plan = await planReferenceRepair(service, id, true);
    expect(plan.moved).toEqual([path.replace(/\.md$/, ' (2).md')]);
    await service.commit(plan.preview);
    expect((await service.snapshot(id)).exchange.catalogItems.map(c => c.id)).toEqual([anna.id]);
    expect(new TextDecoder().decode(vault.data.get(path))).toBe('Neu angelegt');
  });
  it('removes the references instead when asked to', async () => {
    const { vault, service, id, scene, path } = await setup();
    vault.data.delete(path); service.index.invalidate(path);
    const plan = await planReferenceRepair(service, id, false);
    expect(plan.restored).toEqual([]); expect(plan.trash).toHaveLength(1);
    await service.commit(plan.preview); await trashRemoved(service, plan);
    const after = (await service.snapshot(id)).exchange;
    expect(after.scenes.find(s => s.id === scene.id)!.povCharacterId).toBeNull();
    expect(after.relationships).toEqual([]); expect(after.notes[0]!.target).toBeNull();
  });
  it('clears a point of view that refers to a non-character', async () => {
    const { service, id, anna, scene } = await setup();
    const snapshot = await service.snapshot(id), item = snapshot.exchange.catalogItems.find(c => c.id === anna.id)!;
    item.type = 'location'; snapshot.exchange.scenes.find(s => s.id === scene.id)!.povCharacterId = null;
    await service.commit(await service.previewSave(snapshot.exchange, snapshot));
    const changed = await service.snapshot(id); changed.exchange.scenes.find(s => s.id === scene.id)!.povCharacterId = anna.id;
    const result = detachReferences(changed.exchange, []);
    expect(result.pov).toBe(1);
  });
});
