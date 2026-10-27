import { describe, expect, it } from 'vitest';
import { createProject } from '../../src/objects/factory';
import { clone } from '../../src/domain/records';
import { recordHash } from '../../src/exchange/hash';
import { planRecord, rememberExport, exportBase, acceptRecord } from '../../src/transfer/conflicts';
import type { RecordState } from '../../src/storage/state-types';

/** Produces a clean portable record history without timestamps choosing any winner. */
function data() {
  const p = createProject('Basis'), record = p.project;
  const state: RecordState = { stateVersion: 1, collection: 'project', id: record.id, record: clone(record), lastAcceptedRecord: null,
    knownHashes: { accepted: null, exported: [] }, peerBaselines: [], projection: null };
  return { record, state, peer: { system: 'synthetic', instanceId: 'peer-1', version: '1.0.0' } };
}
describe('manuelle Konflikttabelle und Partnerbasen', () => {
  it('neu, unverändert, remote, lokal, beidseitig, unbekannt und gelöscht', async () => {
    const { record, state } = data(), base = await recordHash(record);
    const incoming = clone(record), local = clone(record); incoming.title = 'Fremd'; incoming.baseHash = base;
    expect((await planRecord(record, null, null, false)).action).toBe('new');
    expect((await planRecord(record, local, state, false)).action).toBe('unchanged');
    expect((await planRecord(incoming, local, state, false)).reason).toBe('unknownBase');
    rememberExport(state, base);
    expect((await planRecord(incoming, local, state, false)).action).toBe('incoming');
    local.title = 'Lokal';
    expect((await planRecord(incoming, local, state, false)).reason).toBe('bothChanged');
    expect((await planRecord({ ...record, baseHash: base }, local, state, false)).action).toBe('local');
    expect((await planRecord(record, null, state, true)).reason).toBe('deleted');
    incoming.origin.instanceId = 'fremde-origin';
    expect((await planRecord(incoming, local, state, false)).reason).toBe('origin');
  });
  it('Export ist keine Empfangsbestätigung; mindestens 20 ausgegebene Hashes bleiben', async () => {
    const { record, state, peer } = data(); await acceptRecord(state, record, peer);
    const accepted = state.knownHashes.accepted;
    for (let i = 0; i < 25; i++) rememberExport(state, i.toString(16).padStart(64, '0'));
    expect(state.knownHashes.exported).toHaveLength(20);
    expect(state.knownHashes.accepted).toBe(accepted); expect(exportBase(state, peer)).toBe(accepted); expect(exportBase(state, null)).toBeNull();
  });
  it('führt Basen nach zuletzt exportierendem Partner und erhält immutable Origin', async () => {
    const { record, state, peer } = data(); await acceptRecord(state, record, peer);
    const edited = clone(record); edited.title = 'Anderer Partner';
    await acceptRecord(state, edited, { ...peer, instanceId: 'peer-2' });
    expect(exportBase(state, peer)).toBe(await recordHash(record));
    expect(exportBase(state, { ...peer, instanceId: 'peer-2' })).toBe(await recordHash(edited));
    expect(state.record.origin).toEqual(record.origin);
  });
  it('Zeitversatz und unbekannte/veraltete Basis entscheiden keine Konflikte', async () => {
    const { record, state } = data(), incoming = clone(record); incoming.title = 'Edit'; incoming.updatedAt = '9999-12-31T23:59:59.999999Z';
    incoming.baseHash = '0'.repeat(64);
    expect((await planRecord(incoming, record, state, false)).action).toBe('conflict');
  });
});
