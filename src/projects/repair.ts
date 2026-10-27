import type { Exchange, Entry } from '../domain/types';
import { clone, entries, recordKey, setEntry } from '../domain/records';
import { fail, warning, type Diagnostic } from '../domain/diagnostics';
import { jcs, newId, recordHash, sha256 } from '../exchange/hash';
import { validateExchange } from '../exchange/codec';
import { loadProjectState, decodeRecordState } from '../storage/state';
import type { RecordState } from '../storage/state-types';
import { safePath, sidecarPath } from '../storage/paths';
import { text, utf8 } from '../storage/vault-port';
import { applyProperties } from '../mapping/properties';
import { projectRecord, reverseBody } from '../mapping/projection';
import { newLayout } from './layout';
import { assertNoPending, type Snapshot } from './snapshot';
import type { TransferCoordinator, CommitPreview } from '../transfer/coordinator';
import { acceptRecord } from '../transfer/conflicts';
import { encodeBase64 } from '../exchange/images';

/** Repairs only from an explicit full original import; never invents empty preservation records. */
export async function previewRepair(service: TransferCoordinator, original: Exchange): Promise<CommitPreview> {
  await service.index.rebuild(); service.index.assertClean();
  const projectId = original.project.id, manifest = service.index.find(projectId, 'project', projectId);
  if (!manifest) fail('STATE_MISSING', 'Passendes Projektmanifest fehlt. Als neues Projekt oder unabhängige Kopie importieren.');
  const hint = manifest.properties['writeller-state-path'];
  if (typeof hint !== 'string') fail('STATE_MISSING', 'Zustandspfad im Manifest zuerst aus einer Sicherung wiederherstellen.');
  const statePath = safePath(hint), root = statePath.slice(0, -11), dataFolder = root.slice(0, root.lastIndexOf('/'));
  await assertNoPending(service.vault, root, projectId);
  const layout = await newLayout(original, { ...service.settings, dataFolder });
  if (layout.statePath !== statePath) fail('PROJECT_MISMATCH', 'Originaldatei und Zustandspfad gehören nicht zusammen.');
  try { layout.state = await loadProjectState(service.vault, statePath, projectId); }
  catch { /* Explicit original-based repair creates v1 state; damaged bytes remain journal-backed. */ }
  const sources = new Map<string, Uint8Array>(), states = new Map<string, RecordState>(), warnings: Diagnostic[] = [];
  const oldState = await service.vault.read(statePath); if (oldState) sources.set(statePath, oldState);
  const pkg = clone(original); pkg.chapters = []; pkg.scenes = []; pkg.catalogItems = []; pkg.relationships = []; pkg.notes = []; pkg.researchItems = [];
  pkg.extensions = clone(layout.state.extensions);
  for (const asset of layout.state.assets) {
    if (pkg.attachments.some(a => a.id === asset.id)) continue;
    const bytes = await service.vault.read(asset.path);
    if (!bytes || await sha256(bytes) !== asset.id) fail('STATE_MISSING', 'Zusätzlich erhaltene Bilddatei fehlt oder ist verändert. Passendes Original auswählen.');
    sources.set(asset.path, bytes);
    pkg.attachments.push({ id: asset.id, projectId, mimeType: asset.mimeType, width: asset.width, height: asset.height, data: encodeBase64(bytes) });
  }
  const originalEntries = new Map(entries(original).map(e => [recordKey(e.collection, e.record.id), e]));
  for (const note of service.index.notes.filter(n => n.projectId === projectId)) {
    const key = recordKey(note.collection, note.id), path = await sidecarPath(root, note.collection, note.id);
    const bytes = await service.vault.read(path), fromOriginal = originalEntries.get(key);
    let stored: RecordState | null = null;
    if (bytes) {
      sources.set(path, bytes);
      try { stored = await decodeRecordState(text(bytes), note.collection, note.id, projectId); }
      catch { /* Damaged sidecars can only be replaced by a full matching original below. */ }
    }
    if (!stored && !fromOriginal) fail('STATE_MISSING', 'Original enthält nicht alle fehlenden Begleitdatensätze. Weitere passende Sicherung wählen.');
    if (stored && fromOriginal && jcs(stored.record.origin) !== jcs(fromOriginal.record.origin)) fail('IDENTITY_CONFLICT', 'Original und erhaltener Datensatz haben unterschiedliche Origins.');
    const entry = fromOriginal ?? { collection: note.collection, record: stored!.record } as Entry;
    if (!stored) {
      const projected = projectRecord(entry, { entityPath: k => {
        const e = originalEntries.get(k); return e ? service.index.find(projectId, e.collection, e.record.id)?.path : undefined;
      }, assetPath: hash => `${root}/assets/${hash}.${original.attachments.find(a => a.id === hash)?.mimeType === 'image/jpeg' ? 'jpg' : 'png'}` });
      stored = { stateVersion: 1, collection: note.collection, id: note.id, record: clone(entry.record), lastAcceptedRecord: null,
        knownHashes: { accepted: null, exported: [] }, peerBaselines: [], projection: projected.projection };
      await acceptRecord(stored, entry.record, original.producer);
      warnings.push(warning('STATE_MISSING', 'Vollständiger Begleitdatensatz aus Original rekonstruiert. Aktuelle Notiz bleibt maßgeblich.'));
    }
    const current = await reverseBody(applyProperties(stored.record, note.properties), note.body, stored.projection, {
      entityUrl: link => {
        const target = service.index.notes.find(n => n.path === service.vault.resolveLink(link, note.path));
        return target?.projectId === projectId ? `entity:${target.collection}/${target.id}` : null;
      }, assetHash: link => layout.state.assets.find(a => a.path === service.vault.resolveLink(link, note.path))?.id ?? null
    });
    if (await recordHash(current.record) !== await recordHash(stored.record)) warnings.push(warning('CONTENT_CONFLICT', 'Notiz weicht vom Reparaturoriginal ab. Aktueller Notizinhalt wird erhalten; Originalbasis bleibt getrennt.'));
    states.set(key, stored); setEntry(pkg, { collection: note.collection, record: current.record } as Entry);
    sources.set(note.path, utf8(note.source));
    const location = layout.state.records.find(r => recordKey(r.collection, r.id) === key);
    if (location) { location.notePath = note.path; location.sidecarPath = path; }
    else layout.state.records.push({ collection: note.collection, id: note.id, notePath: note.path, sidecarPath: path });
  }
  pkg.packageId = newId(); await validateExchange(pkg);
  const snapshot: Snapshot = { exchange: pkg, state: layout.state, statePath, root, records: states,
    files: sources, fingerprint: '', warnings };
  const preview = await service.previewSave(pkg, snapshot);
  preview.warnings.push(...warnings);
  return preview;
}
