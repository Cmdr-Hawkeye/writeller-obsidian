import type { ExchangeRecord, Producer } from '../domain/types';
import type { RecordState } from '../storage/state-types';
import { jcs, recordHash } from '../exchange/hash';
import { clone } from '../domain/records';

export type Action = 'new' | 'incoming' | 'local' | 'unchanged' | 'conflict';
export type ConflictReason = 'origin' | 'deleted' | 'bothChanged' | 'unknownBase';
export interface RecordPlan { action: Action; reason: ConflictReason | null; incomingHash: string; localHash: string | null }
/** Pure manual-exchange table; dates never select a winner and absence never deletes. */
export async function planRecord(incoming: ExchangeRecord, local: ExchangeRecord | null, state: RecordState | null, deleted: boolean): Promise<RecordPlan> {
  const incomingHash = await recordHash(incoming), localHash = local ? await recordHash(local) : null;
  const result = (action: Action, reason: ConflictReason | null = null): RecordPlan => ({ action, reason, incomingHash, localHash });
  if (deleted) return result('conflict', 'deleted');
  if (!local) return result('new');
  if (jcs(incoming.origin) !== jcs(local.origin)) return result('conflict', 'origin');
  if (incomingHash === localHash) return result('unchanged');
  const known = new Set([state?.knownHashes.accepted, ...state?.knownHashes.exported ?? [], ...state?.peerBaselines.map(b => b.acceptedHash) ?? []]);
  const base = incoming.baseHash && known.has(incoming.baseHash) ? incoming.baseHash : null;
  if (!base) return result('conflict', 'unknownBase');
  if (localHash === base) return result('incoming');
  if (incomingHash === base) return result('local');
  return result('conflict', 'bothChanged');
}
/** Updates a peer's received basis only after an explicit successful import commit. */
export async function acceptRecord(state: RecordState, incoming: ExchangeRecord, peer: Producer): Promise<void> {
  const hash = await recordHash(incoming);
  state.lastAcceptedRecord = clone(incoming); state.knownHashes.accepted = hash;
  const baseline = { system: peer.system, instanceId: peer.instanceId, acceptedRecord: clone(incoming), acceptedHash: hash };
  const index = state.peerBaselines.findIndex(b => b.system === peer.system && b.instanceId === peer.instanceId);
  if (index < 0) state.peerBaselines.push(baseline); else state.peerBaselines[index] = baseline;
}
/** Chooses exactly one partner basis; export history is never an acknowledgement. */
export function exportBase(state: RecordState, peer: Pick<Producer, 'system' | 'instanceId'> | null): string | null {
  return peer ? state.peerBaselines.find(b => b.system === peer.system && b.instanceId === peer.instanceId)?.acceptedHash ?? null : null;
}
/** Keeps the last twenty distinct issued hashes and leaves every received basis untouched. */
export function rememberExport(state: RecordState, hash: string): void {
  state.knownHashes.exported = [...state.knownHashes.exported.filter(h => h !== hash), hash].slice(-20);
}
