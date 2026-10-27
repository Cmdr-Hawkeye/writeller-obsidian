import type { Exchange, Entry } from '../domain/types';
import { clone, recordKey, setEntry } from '../domain/records';
import { fail, warning, type Diagnostic } from '../domain/diagnostics';
import { newId, now, recordHash, sha256, jcs } from '../exchange/hash';
import { validateExchange } from '../exchange/codec';
import { assertSchema } from '../exchange/schema';
import { assertImages } from '../exchange/images';
import { encodeBase64 } from '../exchange/images';
import { reverseBody } from '../mapping/projection';
import { applyProperties } from '../mapping/properties';
import { holdAnnotations } from '../mapping/annotations';
import { parseLocalJson } from '../storage/local-json';
import { isObject } from '../exchange/parser';
import { loadLayoutJournal } from '../storage/layout-journal-format';
import { pluginVersion } from '../domain/version';
import type { ProjectIndex } from './index';
import { loadProjectState, decodeRecordState } from '../storage/state';
import type { ProjectState, RecordState } from '../storage/state-types';
import type { VaultPort } from '../storage/vault-port';
import { text } from '../storage/vault-port';
import { safePath, sidecarPath, isBelow } from '../storage/paths';

export interface Snapshot { exchange: Exchange; state: ProjectState; statePath: string; root: string;
  records: Map<string, RecordState>; fingerprint: string; files: Map<string, Uint8Array>; warnings: Diagnostic[] }
/** Reconstructs a consistent project from current notes plus loss-preserving sidecars. */
export async function snapshotProject(vault: VaultPort, index: ProjectIndex, projectId: string, allowDangling = false, assetOriginals = new Map<string, Uint8Array>(), editorKey: string | null = null): Promise<Snapshot> {
  await index.rebuild(); index.assertClean();
  const manifest = index.find(projectId, 'project', projectId);
  if (!manifest) fail('STATE_MISSING', 'Projektmanifest fehlt. Original-Import reparieren oder Manifest wiederherstellen.');
  const hint = manifest.properties['writeller-state-path'];
  if (typeof hint !== 'string') fail('STATE_MISSING', 'Projektmanifest benötigt writeller-state-path.');
  const statePath = safePath(hint), root = statePath.slice(0, -'/state.json'.length);
  const state = await loadProjectState(vault, statePath, projectId);
  await assertNoPending(vault, root, projectId);
  const files = new Map<string, Uint8Array>(), records = new Map<string, RecordState>(), warnings: Diagnostic[] = [];
  const stateBytes = await vault.read(statePath);
  if (stateBytes) files.set(statePath, stateBytes);
  const exchange: Exchange = { format: 'writeller.exchange', version: '1.0.0', packageId: newId(), exportedAt: now(),
    producer: { system: 'obsidian', version: pluginVersion, instanceId: state.localInstanceId }, scope: { projectId, mode: 'snapshot' },
    project: {} as Exchange['project'], chapters: [], scenes: [], catalogItems: [], relationships: [], notes: [], researchItems: [], attachments: [], extensions: clone(state.extensions) };
  for (const note of index.notes.filter(n => n.projectId === projectId)) {
    if (isBelow(note.path, root)) fail('PROJECT_MISMATCH', 'Verwaltete Notiz liegt im Begleitdatenordner. Notiz in einen Inhaltsordner verschieben.');
    const key = recordKey(note.collection, note.id), path = await sidecarPath(root, note.collection, note.id);
    const bytes = await vault.read(path);
    if (!bytes) fail('STATE_MISSING', 'Begleitdatei fehlt. Original-Import zur Reparatur verwenden.');
    const stored = await decodeRecordState(text(bytes), note.collection, note.id, projectId);
    files.set(path, bytes); files.set(note.path, new TextEncoder().encode(note.source));
    const result = editorKey === key ? { record: clone(stored.record), warnings: [warning('UNSUPPORTED_REPRESENTATION', 'Nicht zugeordnete Änderungen dieser Notiz werden erst durch die ausdrücklich bestätigten JSON-Daten ersetzt. Vorheriger Quelltext bleibt im Journal gesichert.')] } : await reverseBody(applyProperties(stored.record, note.properties), note.body, stored.projection, {
      entityUrl: link => {
        const destination = vault.resolveLink(link, note.path), target = index.notes.find(n => n.path === destination);
        return target?.projectId === projectId ? `entity:${target.collection}/${target.id}` : null;
      },
      assetHash: link => state.assets.find(a => a.path === vault.resolveLink(link, note.path))?.id ?? null
    });
    if ('content' in stored.record && 'content' in result.record && stored.record.content.format !== result.record.content.format) result.warnings.push(...await holdAnnotations(result.record, stored.record.content.text));
    if (await recordHash(result.record) !== await recordHash(stored.record)) result.record.updatedAt = now() < result.record.createdAt ? result.record.createdAt : now();
    warnings.push(...result.warnings); records.set(key, stored);
    setEntry(exchange, { collection: note.collection, record: result.record } as Entry);
    const location = state.records.find(r => r.collection === note.collection && r.id === note.id);
    if (location) location.notePath = note.path;
    else state.records.push({ collection: note.collection, id: note.id, notePath: note.path, sidecarPath: path });
  }
  state.manifestPath = manifest.path;
  for (const location of state.records) {
    const key = recordKey(location.collection, location.id);
    if (records.has(key)) continue;
    if (!state.locallyDeleted.includes(key)) state.locallyDeleted.push(key);
    const bytes = await vault.read(location.sidecarPath);
    if (bytes) {
      files.set(location.sidecarPath, bytes);
      records.set(key, await decodeRecordState(text(bytes), location.collection, location.id, projectId));
    }
  }
  for (const asset of state.assets) {
    if (!asset.path.startsWith(root + '/assets/')) fail('PROJECT_MISMATCH', 'Bildpfad liegt außerhalb der Projekteigendaten.');
    const bytes = await vault.read(asset.path);
    if (!bytes) fail('STATE_MISSING', 'Erhaltene Bilddatei fehlt. Original-Import zur Reparatur verwenden.');
    files.set(asset.path, bytes);
    let preserved = bytes;
    if (await sha256(bytes) !== asset.id) {
      const original = assetOriginals.get(asset.id);
      if (!original || await sha256(original) !== asset.id) fail('UNSUPPORTED_REPRESENTATION', 'Assetdatei wurde verändert. „Geänderte Bilder aufnehmen“ ausführen und Original-Exchange-Datei zur Erhaltung auswählen.');
      preserved = original;
    }
    exchange.attachments.push({ id: asset.id, projectId, mimeType: asset.mimeType, width: asset.width, height: asset.height, data: encodeBase64(preserved) });
  }
  if (allowDangling) { assertSchema(exchange); await assertImages(exchange.attachments); }
  else await validateExchange(exchange);
  const fingerprint = await snapshotFingerprint(index, files);
  return { exchange, state, statePath, root, records, files, fingerprint, warnings };
}
/** Combines source identity inventory and every sidecar/asset version used by a preview. */
export async function snapshotFingerprint(index: ProjectIndex, files: Map<string, Uint8Array>): Promise<string> {
  return sha256(jcs([await index.fingerprint(), await Promise.all([...files].map(async ([p, b]) => [p, await sha256(b)]))]));
}
/** Pending journals block ordinary operations until explicit recovery has completed. */
export async function assertNoPending(vault: VaultPort, root: string, projectId: string): Promise<void> {
  const { loadJournal } = await import('../storage/journal-format');
  for (const file of vault.files().filter(f => f.path.startsWith(root + '/journal/') && f.path.endsWith('/journal.json'))) {
    const bytes = await vault.read(file.path), header = bytes ? parseLocalJson(text(bytes)) : null;
    const journal = isObject(header) && header['kind'] === 'layout' ? await loadLayoutJournal(vault, file.path, projectId) : await loadJournal(vault, file.path, projectId);
    if (journal.status === 'prepared' || journal.status === 'recoveryConflict') fail('LOCAL_CHANGED', 'Unvollständiger Vorgang vorhanden. „Import wiederherstellen“ ausführen.');
  }
}
