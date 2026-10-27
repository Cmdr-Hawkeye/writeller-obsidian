import type { Snapshot } from './snapshot';
import type { Settings } from './layout';
import { newLayout } from './layout';
import { clone, entries, recordKey, title } from '../domain/records';
import { projectRecord } from '../mapping/projection';
import { splitNote } from '../mapping/frontmatter';
import { utf8 } from '../storage/vault-port';
import type { VaultPort } from '../storage/vault-port';
import { equalBytes } from '../storage/vault-port';
import { sha256 } from '../exchange/hash';
import type { ProjectIndex } from './index';

export interface LayoutMove { from: string; to: string; bytes: Uint8Array }
export interface LayoutWrite { path: string; before: Uint8Array; after: Uint8Array }
export interface OrganizePlan { snapshot: Snapshot; moves: LayoutMove[]; writes: LayoutWrite[]; indexFingerprint: string; manifestPath: string }
/** Plans readable file paths while keeping every identity, full foreign record and exchange baseline. */
export async function planOrganization(vault: VaultPort, index: ProjectIndex, snapshot: Snapshot, settings: Settings): Promise<OrganizePlan> {
  const owned = new Set(snapshot.state.records.map(r => r.notePath));
  const layout = await newLayout(snapshot.exchange, { ...settings, dataFolder: snapshot.root.slice(0, snapshot.root.lastIndexOf('/')) }, vault.files().filter(f => !owned.has(f.path)).map(f => f.path));
  const locations = new Map(layout.state.records.map(r => [recordKey(r.collection, r.id), r]));
  const moves: LayoutMove[] = [], writes: LayoutWrite[] = [], state = clone(snapshot.state);
  for (const entry of entries(snapshot.exchange)) {
    const key = recordKey(entry.collection, entry.record.id), old = snapshot.state.records.find(r => recordKey(r.collection, r.id) === key)!;
    const location = locations.get(key)!, before = snapshot.files.get(old.notePath)!;
    if (old.notePath !== location.notePath) moves.push({ from: old.notePath, to: location.notePath, bytes: before });
    const projected = projectRecord(entry, { entityPath: k => locations.get(k)?.notePath, assetPath: hash => state.assets.find(a => a.id === hash)?.path,
      entityLabel: k => { const found = entries(snapshot.exchange).find(e => recordKey(e.collection, e.record.id) === k); return found ? title(found.record) : undefined; } });
    const source = utf8(splitNote(new TextDecoder().decode(before)).header + projected.projection.body);
    if (!equalBytes(before, source)) writes.push({ path: location.notePath, before, after: source });
    const stored = clone(snapshot.records.get(key)!); stored.record = clone(entry.record); stored.projection = projected.projection;
    const sideBefore = snapshot.files.get(old.sidecarPath)!;
    const sideAfter = utf8(JSON.stringify(stored, null, 2));
    if (!equalBytes(sideBefore, sideAfter)) writes.push({ path: old.sidecarPath, before: sideBefore, after: sideAfter });
    const target = state.records.find(r => recordKey(r.collection, r.id) === key)!; target.notePath = location.notePath;
  }
  state.manifestPath = layout.state.manifestPath;
  const before = snapshot.files.get(snapshot.statePath)!, after = utf8(JSON.stringify(state, null, 2));
  if (!equalBytes(before, after)) writes.push({ path: snapshot.statePath, before, after });
  return { snapshot, moves, writes, indexFingerprint: await index.fingerprint(), manifestPath: state.manifestPath };
}
/** Verifies all source and backing files again after the user has reviewed a reorganisation. */
export async function organizationFresh(vault: VaultPort, index: ProjectIndex, plan: OrganizePlan): Promise<boolean> {
  await index.rebuild(); index.assertClean();
  if (await index.fingerprint() !== plan.indexFingerprint) return false;
  for (const [path, bytes] of plan.snapshot.files) {
    const current = await vault.read(path);
    if (!current || await sha256(current) !== await sha256(bytes)) return false;
  }
  return true;
}
