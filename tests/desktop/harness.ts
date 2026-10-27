import { Plugin, apiVersion, TFile } from 'obsidian';
import { ObsidianVault } from '../../src/obsidian/vault';
import { TransferCoordinator } from '../../src/transfer/coordinator';
import { defaultSettings } from '../../src/projects/layout';
import { entries, recordKey, setEntry } from '../../src/domain/records';
import { recordHash } from '../../src/exchange/hash';
import { createProject, createRecord } from '../../src/objects/factory';
import { splitNote } from '../../src/mapping/frontmatter';
import { pluginVersion } from '../../src/domain/version';

/** Real desktop API smoke harness, installed only into the generated isolated synthetic vault. */
export default class DesktopSmoke extends Plugin {
  /** Runs after layout readiness and writes a local structured report; never contacts a service. */
  override onload(): void {
    this.app.workspace.onLayoutReady(() => { void this.run(); });
  }
  /** Tests real Vault/processFrontMatter/MetadataCache behaviour, not a fake adapter. */
  private async run(): Promise<void> {
    const checks: string[] = [], report = { appVersion: apiVersion, pluginVersion, realDesktopApi: true, manualUi: false, checks, passed: false, error: '' };
    try {
      const service = new TransferCoordinator(new ObsidianVault(this.app), { ...defaultSettings });
      const original = await service.readImport('Writeller-Austausch/harbor.writeller-exchange.json');
      await service.commit(await service.resolve(await service.previewImport(original, 'new')));
      checks.push('Vollständiger Import aller Sammlungen und PNG mit echter Vault API');
      const snapshot = await service.snapshot(original.project.id), out = await service.previewExport(original.project.id, null);
      const hashes = new Map(await Promise.all(entries(original).map(async e => [recordKey(e.collection, e.record.id), await recordHash(e.record)] as const)));
      for (const e of entries(out.exchange)) this.assert(await recordHash(e.record) === hashes.get(recordKey(e.collection, e.record.id)), 'Roundtrip-Hash');
      this.assert(JSON.stringify(out.exchange.attachments) === JSON.stringify(original.attachments), 'Bildbytes');
      await service.commit(out.preview); checks.push('Export-Roundtrip: alle Sollhashes und Bildbytes erhalten');
      const pkg = snapshot.exchange; pkg.scenes[0]!.title = 'Geänderter Szenentitel';
      await service.commit(await service.previewSave(pkg, snapshot));
      const scene = service.index.find(original.project.id, 'scenes', pkg.scenes[0]!.id)!;
      this.assert(scene.properties['writeller-title'] === 'Geänderter Szenentitel', 'processFrontMatter');
      checks.push('Bestehende Properties mit FileManager.processFrontMatter und Journal geändert');
      const forest = await service.readImport('Writeller-Austausch/forest.writeller-exchange.json');
      await service.commit(await service.resolve(await service.previewImport(forest, 'new')));
      this.assert((await service.snapshot(forest.project.id)).exchange.scenes.every(s => s.projectId === forest.project.id), 'Projekttrennung');
      checks.push('Zwei Projekte mit identischen Objekt-IDs bleiben getrennt');
      const note = this.app.vault.getAbstractFileByPath(scene.path);
      if (!(note instanceof TFile)) throw new Error('TFile fehlt');
      await this.app.fileManager.renameFile(note, 'Verschobene Szene.md');
      await this.pause(500); await service.index.rebuild();
      this.assert(service.index.find(original.project.id, 'scenes', pkg.scenes[0]!.id)?.path === 'Verschobene Szene.md', 'Rename');
      checks.push('FileManager.renameFile erhält die logische Identität');
      const local = createProject('Ohne Writeller');
      for (const collection of ['chapters', 'scenes', 'catalogItems', 'notes', 'researchItems'] as const) setEntry(local, createRecord(collection, local.project.id, local.producer.instanceId, collection));
      await service.commit(await service.previewSave(local, null));
      checks.push('Lokale Erstellung ohne Writeller, Lizenz oder Server');
      const snap = await service.snapshot(local.project.id), entry = createRecord('notes', local.project.id, snap.state.localInstanceId, 'Zugeordnete Notiz');
      if ('content' in entry.record) entry.record.content.text = 'Eigener lokaler Text.';
      setEntry(snap.exchange, entry);
      await service.commit(await service.previewSave(snap.exchange, snap, null, new Set(), new Map([[recordKey(entry.collection, entry.record.id), 'Testnotiz.md']])));
      const assigned = this.app.vault.getAbstractFileByPath('Testnotiz.md');
      if (!(assigned instanceof TFile)) throw new Error('Zugeordnete TFile fehlt');
      const props = splitNote(await this.app.vault.read(assigned)).properties;
      this.assert(props['eigene-property'] === 'bleibt erhalten', 'Fremde Property');
      checks.push('Normale Notiz zugeordnet; eigene Obsidian-Property erhalten');
      report.passed = true;
    } catch (error) { report.error = error instanceof Error ? error.message : 'Unbekannter Fehler'; }
    const path = 'SMOKE-ERGEBNIS.json', existing = this.app.vault.getAbstractFileByPath(path), data = JSON.stringify(report, null, 2);
    if (existing instanceof TFile) await this.app.vault.process(existing, () => data); else await this.app.vault.create(path, data);
  }
  /** Fails the local report at the first incorrect assertion. */
  private assert(ok: boolean, label: string): void { if (!ok) throw new Error(`Desktop-Smoke fehlgeschlagen: ${label}`); }
  /** Allows the actual host metadata event queue to settle after rename. */
  private pause(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
}
