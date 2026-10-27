import type { Collection, ExchangeRecord } from '../domain/types';
import { collections } from '../domain/types';
import { recordKey } from '../domain/records';
import { fail } from '../domain/diagnostics';
import { isObject } from '../exchange/parser';
import { parseLocalJson } from './local-json';
import { assertRecord } from '../exchange/schema';
import { jcs, recordHash, sha256 } from '../exchange/hash';
import { safePath, sidecarPath } from './paths';
import type { ProjectState, RecordState } from './state-types';
import type { VaultPort } from './vault-port';
import { text } from './vault-port';

const hashPattern = /^[a-f0-9]{64}$/;
/** Loads a versioned state file through an explicit manifest hint and verifies project ownership. */
export async function loadProjectState(vault: VaultPort, path: string, projectId: string): Promise<ProjectState> {
  safePath(path);
  if (!path.endsWith(`/${await sha256(projectId)}/state.json`)) fail('PROJECT_MISMATCH', 'Zustandspfad gehört nicht zur Projekt-ID.');
  const bytes = await vault.read(path);
  if (!bytes) fail('STATE_MISSING', 'Projektbegleitdaten fehlen. Original-Import zur Reparatur auswählen.');
  try {
    const state = decodeProjectState(text(bytes), projectId), root = path.slice(0, -11);
    for (const r of state.records) if (r.sidecarPath !== await sidecarPath(root, r.collection, r.id)) fail('PROJECT_MISMATCH', 'Begleitpfad gehört nicht zum Projekt.');
    for (const a of state.assets) {
      const name = `${a.id}.${a.mimeType === 'image/png' ? 'png' : 'jpg'}`;
      if (a.path !== `${root}/assets/${name}` && a.path !== `${root}/assets/originals/${name}`) fail('PROJECT_MISMATCH', 'Assetpfad gehört nicht zum Projekt.');
    }
    return state;
  }
  catch { fail('STATE_MISSING', 'Projektzustand ist beschädigt oder hat eine unbekannte Version. Original-Import zur Reparatur verwenden.'); }
}
/** Local v1 migration boundary; unknown versions are rejected rather than defaulted. */
export function decodeProjectState(source: string, projectId: string): ProjectState {
  const s = parseLocalJson(source);
  if (!isObject(s) || s['stateVersion'] !== 1 || s['projectId'] !== projectId || typeof s['localInstanceId'] !== 'string' ||
    typeof s['manifestPath'] !== 'string' || !Array.isArray(s['records']) || !Array.isArray(s['packages']) ||
    !Array.isArray(s['assets']) || !Array.isArray(s['locallyDeleted']) || !isObject(s['extensions']) ||
    !(s['pendingJournal'] === null || typeof s['pendingJournal'] === 'string')) fail('STATE_MISSING', 'Ungültiger lokaler Zustand.');
  safePath(s['manifestPath']);
  const keys = new Set<string>();
  for (const r of s['records']) {
    if (!isObject(r) || !collections.includes(r['collection'] as Collection) || typeof r['id'] !== 'string' ||
      typeof r['notePath'] !== 'string' || typeof r['sidecarPath'] !== 'string') fail('STATE_MISSING', 'Ungültiger Zustandsindex.');
    safePath(r['notePath']); safePath(r['sidecarPath']);
    const key = recordKey(r['collection'] as Collection, r['id']);
    if (keys.has(key)) fail('STATE_MISSING', 'Doppelter Zustandsindex.');
    keys.add(key);
  }
  for (const p of s['packages']) if (!isObject(p) || typeof p['id'] !== 'string' || typeof p['hash'] !== 'string' || !hashPattern.test(p['hash'])) fail('STATE_MISSING', 'Paketregister ist beschädigt.');
  for (const a of s['assets']) {
    if (!isObject(a) || typeof a['id'] !== 'string' || !hashPattern.test(a['id']) || typeof a['path'] !== 'string' ||
      !['image/png', 'image/jpeg'].includes(String(a['mimeType'])) || typeof a['width'] !== 'number' || typeof a['height'] !== 'number') fail('STATE_MISSING', 'Bildregister ist beschädigt.');
    safePath(a['path']);
  }
  if (s['locallyDeleted'].some(k => typeof k !== 'string' || !/^(?:project|chapters|scenes|catalogItems|relationships|notes|researchItems)\/[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(k))) fail('STATE_MISSING', 'Löschmarkierungen sind beschädigt.');
  return s as unknown as ProjectState;
}
/** Validates complete sidecars, including all stored peer records and hash integrity. */
export async function decodeRecordState(source: string, collection: Collection, id: string, projectId: string): Promise<RecordState> {
  const s = parseLocalJson(source);
  if (!isObject(s) || s['stateVersion'] !== 1 || s['collection'] !== collection || s['id'] !== id ||
    !isObject(s['knownHashes']) || !Array.isArray(s['peerBaselines']) || !('lastAcceptedRecord' in s)) fail('STATE_MISSING', 'Begleitdatensatz fehlt oder ist beschädigt.');
  checkRecord(s['record'], collection, id, projectId);
  if (s['lastAcceptedRecord'] !== null) checkRecord(s['lastAcceptedRecord'], collection, id, projectId);
  const known = s['knownHashes'];
  if (!(known['accepted'] === null || typeof known['accepted'] === 'string' && hashPattern.test(known['accepted'])) ||
    !Array.isArray(known['exported']) || known['exported'].length > 20 || known['exported'].some(h => typeof h !== 'string' || !hashPattern.test(h))) fail('STATE_MISSING', 'Hashhistorie ist beschädigt.');
  if (s['lastAcceptedRecord'] !== null && await recordHash(s['lastAcceptedRecord'] as unknown as ExchangeRecord) !== known['accepted']) fail('STATE_MISSING', 'Akzeptierter Hash ist beschädigt.');
  const origin = jcs((s['record'] as unknown as ExchangeRecord).origin);
  if (s['lastAcceptedRecord'] !== null && jcs((s['lastAcceptedRecord'] as unknown as ExchangeRecord).origin) !== origin) fail('STATE_MISSING', 'Akzeptierte Origin stimmt nicht überein.');
  const peers = new Set<string>();
  for (const b of s['peerBaselines']) {
    if (!isObject(b) || typeof b['system'] !== 'string' || typeof b['instanceId'] !== 'string' || typeof b['acceptedHash'] !== 'string') fail('STATE_MISSING', 'Partnerbasis ist beschädigt.');
    checkRecord(b['acceptedRecord'], collection, id, projectId);
    const key = jcs([b['system'], b['instanceId']]);
    if (peers.has(key) || jcs((b['acceptedRecord'] as unknown as ExchangeRecord).origin) !== origin || await recordHash(b['acceptedRecord'] as unknown as ExchangeRecord) !== b['acceptedHash']) fail('STATE_MISSING', 'Partnerbasis ist doppelt oder beschädigt.');
    peers.add(key);
  }
  const projection = s['projection'];
  if (projection !== null) {
    if (!isObject(projection) || typeof projection['body'] !== 'string' || typeof projection['protected'] !== 'boolean' || !Array.isArray(projection['links'])) fail('STATE_MISSING', 'Projektion ist beschädigt.');
    for (const link of projection['links']) {
      if (!isObject(link) || typeof link['localPath'] !== 'string' || typeof link['originalUrl'] !== 'string' || typeof link['image'] !== 'boolean') fail('STATE_MISSING', 'Linkprojektion ist beschädigt.');
      safePath(link['localPath']);
    }
  }
  return s as unknown as RecordState;
}
/** Confirms a stored record's exact schema, collection and immutable project identity. */
function checkRecord(value: unknown, collection: Collection, id: string, projectId: string): void {
  assertRecord(value, collection);
  if (value.id !== id || (collection === 'project' ? value.id !== projectId : !('projectId' in value) || value.projectId !== projectId)) fail('PROJECT_MISMATCH', 'Begleitdatensatz gehört zu einer anderen Identität.');
}
