import type { Entry, Exchange, ExchangeRecord } from '../domain/types';
import { entries, recordKey, clone, setEntry } from '../domain/records';
import { fail, warning, type Diagnostic } from '../domain/diagnostics';
import { packageHash, validateExchange } from '../exchange/codec';
import { jcs, now } from '../exchange/hash';
import { planRecord, type RecordPlan } from './conflicts';
import type { Snapshot } from '../projects/snapshot';

export interface ImportRow extends RecordPlan { key: string; entry: Entry; local: ExchangeRecord | null }
export type Decision = { choice: 'local' | 'incoming' } | { choice: 'merge'; record: ExchangeRecord };
export interface ImportPlan { incoming: Exchange; local: Snapshot | null; rows: ImportRow[]; packageHash: string;
  envelopeConflict: boolean; warnings: Diagnostic[] }
/** Builds a no-write plan; reusing a package ID with different full-envelope bytes is an error. */
export async function planImport(incoming: Exchange, local: Snapshot | null): Promise<ImportPlan> {
  if (local && incoming.project.id !== local.exchange.project.id) fail('PROJECT_MISMATCH', 'Zielprojekt hat eine andere Identität. Unabhängige Kopie wählen.');
  const hash = await packageHash(incoming), prior = local?.state.packages.find(p => p.id === incoming.packageId);
  if (prior && prior.hash !== hash) fail('IDENTITY_CONFLICT', 'Paket-ID wurde mit anderem Inhalt erneut verwendet. Neue Austauschdatei anfordern.');
  const localEntries = new Map(local ? entries(local.exchange).map(e => [recordKey(e.collection, e.record.id), e.record]) : []);
  const deleted = new Set(local?.state.locallyDeleted ?? []);
  if (local) for (const r of local.state.records) if (!localEntries.has(recordKey(r.collection, r.id))) deleted.add(recordKey(r.collection, r.id));
  const rows: ImportRow[] = [];
  for (const entry of entries(incoming)) {
    const key = recordKey(entry.collection, entry.record.id), current = localEntries.get(key) ?? null;
    rows.push({ key, entry, local: current, ...await planRecord(entry.record, current, local?.records.get(key) ?? null, deleted.has(key)) });
  }
  const warnings = [...local?.warnings ?? []];
  if (incoming.researchItems.some(r => /^(?:[a-z]:[\\/]|\\\\|file:)/i.test(r.uri))) warnings.push(warning('UNSUPPORTED_REPRESENTATION', 'Recherche enthält historische lokale Dateipfade. Die Vorschau verändert oder öffnet sie nicht.'));
  for (const r of incoming.catalogItems) if (!['character', 'location', 'object', 'timelineEvent', 'arc'].includes(r.type)) warnings.push(warning('UNSUPPORTED_REPRESENTATION', 'Unbekannter Katalogtyp wird generisch erhalten.'));
  const envelopeConflict = !!local && Object.keys(incoming.extensions).some(k => Object.hasOwn(local.exchange.extensions, k) && jcs(incoming.extensions[k]) !== jcs(local.exchange.extensions[k]));
  return { incoming: clone(incoming), local, rows, packageHash: hash, envelopeConflict, warnings };
}
/** Applies explicit choices, retaining absent local objects, and validates the combined final graph. */
export async function resolveImport(plan: ImportPlan, decisions: Map<string, Decision>, envelopeChoice?: 'local' | 'incoming'): Promise<{ exchange: Exchange; acceptedKeys: Set<string>; warnings: Diagnostic[] }> {
  const result = clone(plan.local?.exchange ?? plan.incoming), acceptedKeys = new Set<string>(), warnings = [...plan.warnings];
  for (const row of plan.rows) {
    const decision = decisions.get(row.key);
    if (row.action === 'conflict' && !decision) fail('CONTENT_CONFLICT', 'Für jeden Konflikt eine Entscheidung auswählen.');
    const choice = decision?.choice ?? (row.action === 'local' ? 'local' : 'incoming');
    if (choice === 'local') continue;
    let record = clone(choice === 'merge' && decision?.choice === 'merge' ? decision.record : row.entry.record);
    if (record.id !== row.entry.record.id || ('projectId' in record && record.projectId !== result.project.id)) fail('PROJECT_MISMATCH', 'Vereinigung darf die Identität nicht ändern.');
    const sameOrigin = !row.local || jcs(record.origin) === jcs(row.local.origin);
    if (!sameOrigin && choice !== 'incoming') fail('IDENTITY_CONFLICT', 'Abweichende Origins nicht manuell vermischen. Eine vollständige Linie auswählen oder unabhängig kopieren.');
    if (!sameOrigin) warnings.push(warning('IDENTITY_CONFLICT', 'Eingehende Identitätslinie ausdrücklich ausgewählt. Frühere lokale Origin und Basen bleiben in der Journalsicherung; sie werden nicht zur neuen gemeinsamen Basis.'));
    if (choice === 'merge') record.updatedAt = now();
    if (row.local && sameOrigin) {
      if (record.createdAt !== row.local.createdAt) warnings.push(warning('INVALID_FIELD', 'Bekannte lokale Erstellzeit bleibt erhalten.'));
      record.createdAt = row.local.createdAt;
      if (record.updatedAt < record.createdAt) record.updatedAt = now();
      if (row.action === 'unchanged') record = clone(row.local);
    }
    setEntry(result, { collection: row.entry.collection, record } as Entry);
    acceptedKeys.add(row.key);
  }
  // Missing incoming objects and unused local assets remain present, never remote-deleted.
  const assets = new Map(result.attachments.map(a => [a.id, a]));
  plan.incoming.attachments.forEach(a => assets.set(a.id, clone(a)));
  result.attachments = [...assets.values()];
  if (plan.envelopeConflict && !envelopeChoice) fail('CONTENT_CONFLICT', 'Abweichende Paket-Erweiterungen benötigen eine Entscheidung.');
  const localExtensions = plan.local?.exchange.extensions ?? {};
  result.extensions = Object.fromEntries(envelopeChoice === 'local' ? [...Object.entries(plan.incoming.extensions), ...Object.entries(localExtensions)] : [...Object.entries(localExtensions), ...Object.entries(plan.incoming.extensions)]);
  await validateExchange(result);
  return { exchange: result, acceptedKeys, warnings };
}
