import { tr } from '../i18n/translate';
import type { Exchange } from '../domain/types';
import { entries, recordKey, clone, title } from '../domain/records';
import { fail, type Diagnostic } from '../domain/diagnostics';
import { jcs, recordHash, sha256 } from '../exchange/hash';
import { projectRecord } from '../mapping/projection';
import { recordProperties, renderNote } from '../mapping/frontmatter';
import { decodeBase64 } from '../exchange/images';
import type { Layout } from '../projects/layout';
import type { ProjectIndex } from '../projects/index';
import type { Snapshot } from '../projects/snapshot';
import { safePath, sidecarPath } from '../storage/paths';
import type { RecordState } from '../storage/state-types';
import type { Mutation } from '../storage/journal';
import { acceptRecord } from './conflicts';
import type { VaultPort } from '../storage/vault-port';
import { text, utf8 } from '../storage/vault-port';
import { decodeRecordState } from '../storage/state';

export interface PersistencePlan { mutations: Mutation[]; warnings: Diagnostic[]; records: Map<string, RecordState> }
/** Constructs after-images only; writes are exclusively owned by JournalService after preview. */
export async function planPersistence(vault: VaultPort, index: ProjectIndex, pkg: Exchange, layout: Layout,
  local: Snapshot | null, incoming: Exchange | null, acceptedKeys: Set<string> = new Set(), assignedPaths = new Set<string>()): Promise<PersistencePlan> {
  const state = layout.state, mutations: Mutation[] = [], warnings: Diagnostic[] = [], records = new Map<string, RecordState>();
  const locations = new Map(state.records.map(r => [recordKey(r.collection, r.id), r]));
  state.manifestPath = locations.get(`project/${pkg.project.id}`)!.notePath;
  for (const asset of pkg.attachments) {
    const path = safePath(state.assets.find(a => a.id === asset.id)?.path ?? `${layout.root}/assets/${asset.id}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`);
    if (!state.assets.some(a => a.id === asset.id)) state.assets.push({ id: asset.id, path, mimeType: asset.mimeType, width: asset.width, height: asset.height });
    const existing = await vault.read(path), bytes = decodeBase64(asset.data);
    if (existing && await sha256(existing) !== asset.id) fail('INVALID_ASSET', tr('Vorhandene Assetdatei ist verändert. Original reparieren.'));
    if (!existing) mutations.push({ path, before: null, after: bytes, binary: true });
  }
  for (const e of entries(pkg)) {
    const key = recordKey(e.collection, e.record.id), location = locations.get(key);
    if (!location) fail('STATE_MISSING', tr('Schreibplan enthält keine Objektzuordnung.'));
    const path = await sidecarPath(layout.root, e.collection, e.record.id);
    if (path !== location.sidecarPath) fail('PROJECT_MISMATCH', tr('Begleitpfad gehört nicht zur Projektidentität.'));
    const prior = local?.records.get(key);
    const stored = prior && jcs(prior.record.origin) === jcs(e.record.origin) ? prior : undefined;
    const recordState: RecordState = stored ? clone(stored) : { stateVersion: 1, collection: e.collection, id: e.record.id,
      record: clone(e.record), lastAcceptedRecord: null, knownHashes: { accepted: null, exported: [] }, peerBaselines: [], projection: null };
    const projected = projectRecord(e, {
      entityPath: k => locations.get(k)?.notePath,
      assetPath: hash => state.assets.find(a => a.id === hash)?.path,
      entityLabel: k => { const entry = entries(pkg).find(e => recordKey(e.collection, e.record.id) === k); return entry ? title(entry.record) : undefined; }
    });
    warnings.push(...projected.warnings);
    const note = index.find(pkg.project.id, e.collection, e.record.id);
    if (note) location.notePath = note.path;
    const before = await vault.read(location.notePath), oldSource = note?.source ?? (before ? text(before) : '');
    if (before && !note && !assignedPaths.has(location.notePath)) fail('IDENTITY_CONFLICT', tr('Geplanter Notizpfad ist durch eine fremde Datei belegt. Kein Überschreiben.'));
    const unchanged = stored && await recordHash(e.record) === await recordHash(stored.record) && stored.projection?.body === note?.body && jcs(projected.projection) === jcs(stored.projection);
    const source = unchanged ? oldSource : renderNote(recordProperties(e.collection, e.record, pkg.project.id, layout.statePath), projected.projection.body, oldSource);
    recordState.record = clone(e.record);
    recordState.projection = unchanged ? stored.projection : projected.projection;
    if (incoming && acceptedKeys.has(key)) {
      const received = entries(incoming).find(r => r.collection === e.collection && r.record.id === e.record.id)?.record;
      if (received) {
        if (jcs(received.origin) !== jcs(recordState.record.origin)) fail('IDENTITY_CONFLICT', tr('Abweichende Origin darf nicht als gemeinsame Basis gespeichert werden.'));
        await acceptRecord(recordState, received, incoming.producer);
      }
    }
    records.set(key, recordState);
    if (!before || text(before) !== source) mutations.push({ path: location.notePath, before, after: utf8(source), binary: false });
    const sideBefore = await vault.read(path), sideAfter = utf8(JSON.stringify(recordState, null, 2));
    // Never commit a sidecar that a restart could not read under local state budgets.
    await decodeRecordState(text(sideAfter), e.collection, e.record.id, pkg.project.id);
    if (sideBefore && !local) fail('IDENTITY_CONFLICT', tr('Datenordner enthält bereits Begleitdaten. Explizite Reparatur verwenden.'));
    if (!sideBefore || text(sideBefore) !== text(sideAfter)) mutations.push({ path, before: sideBefore, after: sideAfter, binary: false });
  }
  const before = await vault.read(layout.statePath);
  mutations.push({ path: layout.statePath, before, after: utf8(JSON.stringify(state, null, 2)), binary: false });
  return { mutations, warnings, records };
}
