import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/fake-vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { createProject, createRecord } from '../../src/objects/factory';
import { setEntry } from '../../src/domain/records';
import { discoverNotes, suggestNote } from '../../src/projects/note-discovery';
import { utf8 } from '../../src/storage/vault-port';

/** Creates valid projects through ordinary persistence; only unmanaged test notes bypass the service. */
async function setup() {
  const vault = new FakeVault(), service = new TransferCoordinator(vault, { ...defaultSettings }), pkg = createProject('Mein Buch');
  const chapter = createRecord('chapters', pkg.project.id, pkg.producer.instanceId, 'Ankunft'); setEntry(pkg, chapter);
  await service.commit(await service.previewSave(pkg, null));
  const manifest = service.index.manifests()[0]!, root = manifest.path.slice(0, manifest.path.lastIndexOf('/'));
  return { vault, service, pkg, chapter, root };
}
describe('gewöhnliche Markdown-Dateien im tatsächlichen Projektordner', () => {
  it('schlägt passende Schreibtypen vor und nimmt keine fremden Vault-Notizen auf', async () => {
    const { vault, service, pkg, root } = await setup();
    for (const path of ['Figuren/Bernd das Brot.md', 'Orte/Hafen.md', 'Notizen/Idee.md', 'Recherche/Quelle.md', 'Sonstiges/Skizze.md']) vault.data.set(`${root}/${path}`, utf8('Text'));
    vault.data.set('Willkommen.md', utf8('Privat')); await service.index.rebuild();
    expect(discoverNotes(vault, service.index, pkg.project.id).map(c => [c.title, c.kindId])).toEqual([
      ['Bernd das Brot', 'character'], ['Idee', 'note'], ['Hafen', 'location'], ['Quelle', 'research'], ['Skizze', 'note']
    ]);
    expect(service.index.notes).toHaveLength(2); // Discovery never writes identities.
  });
  it('erkennt Kapitel aus verwalteten Notizen und lässt Szenen ohne Kapitel ausdrücklich unzugeordnet', async () => {
    const { service, pkg, chapter, root } = await setup();
    const chapterPath = service.index.find(pkg.project.id, 'chapters', chapter.record.id)!.path;
    expect(suggestNote(service.index, chapterPath.replace(/Ankunft\.md$/, 'Nebel.md'))).toMatchObject({ kindId: 'scene', chapterId: chapter.record.id });
    expect(suggestNote(service.index, `${root}/Manuskript/Ohne Kapitel/Nebel.md`)).toMatchObject({ kindId: 'scene', chapterId: null });
  });
  it('folgt einem verschobenen Projektmanifest statt dem eingestellten Standardordner', async () => {
    const { vault, service, pkg } = await setup(), manifest = service.index.manifests()[0]!;
    await vault.move(manifest.path, 'Anderswo/Mein Buch.md', vault.data.get(manifest.path)!); await service.index.rebuild();
    expect(suggestNote(service.index, 'Anderswo/Figuren/Lina.md')).toMatchObject({ projectId: pkg.project.id, kindId: 'character' });
    expect(suggestNote(service.index, 'Schreibprojekte/Mein Buch/Figuren/Lina.md')).toBeNull();
  });
  it('trennt gleichnamige Projekte und verwendet für verschachtelte Projekte die nächste eindeutige Wurzel', async () => {
    const { vault, service, pkg, root } = await setup(), second = createProject('Mein Buch');
    await service.commit(await service.previewSave(second, null));
    const secondManifest = service.index.find(second.project.id, 'project', second.project.id)!;
    await vault.move(secondManifest.path, `${root}/Unterprojekt/Mein Buch.md`, vault.data.get(secondManifest.path)!);
    vault.data.set(`${root}/Unterprojekt/Figuren/Zweite Figur.md`, utf8('Text')); await service.index.rebuild();
    expect(discoverNotes(vault, service.index, pkg.project.id)).toEqual([]);
    expect(discoverNotes(vault, service.index, second.project.id)[0]).toMatchObject({ title: 'Zweite Figur', projectId: second.project.id });
  });
  it('fordert bei gemeinsam genutztem Ordner einen ausdrücklichen Projektkontext', async () => {
    const { vault, service, pkg, root } = await setup(), second = createProject('Anderes Buch');
    await service.commit(await service.previewSave(second, null));
    const secondManifest = service.index.find(second.project.id, 'project', second.project.id)!;
    await vault.move(secondManifest.path, `${root}/Anderes Buch.md`, vault.data.get(secondManifest.path)!); await service.index.rebuild();
    const path = `${root}/Figuren/Bernd.md`; vault.data.set(path, utf8('Text'));
    expect(suggestNote(service.index, path)).toBeNull();
    expect(discoverNotes(vault, service.index, pkg.project.id)[0]).toMatchObject({ projectId: pkg.project.id, ambiguousProject: true });
  });
  it('deutet verwaltete Notizen anderer Projekte im gleichen Ordner nicht um und erfasst niemals den ganzen Vault', async () => {
    const { vault, service, pkg, root } = await setup(), second = createProject('Anderes Buch');
    const figure = createRecord('catalogItems', second.project.id, second.producer.instanceId, 'Eigene Figur'); setEntry(second, figure);
    await service.commit(await service.previewSave(second, null));
    const note = service.index.find(second.project.id, figure.collection, figure.record.id)!;
    await vault.move(note.path, `${root}/Figuren/Andere Figur.md`, vault.data.get(note.path)!); await service.index.rebuild();
    expect(discoverNotes(vault, service.index, pkg.project.id)).toEqual([]);
    const manifest = service.index.find(pkg.project.id, 'project', pkg.project.id)!;
    await vault.move(manifest.path, 'Mein Buch.md', vault.data.get(manifest.path)!); await service.index.rebuild();
    expect(suggestNote(service.index, 'Persönlich/Privat.md', pkg.project.id)).toBeNull();
  });
});
