import type { Exchange, Entry, Producer } from '../domain/types';
import { entries, recordKey, clone } from '../domain/records';
import { fail, type Diagnostic } from '../domain/diagnostics';
import { newId, now, recordHash } from '../exchange/hash';
import { readExchange, validateExchange, writeExchange } from '../exchange/codec';
import type { Settings, Layout } from '../projects/layout';
import { newLayout, extendLayout } from '../projects/layout';
import { ProjectIndex } from '../projects/index';
import { snapshotProject, type Snapshot } from '../projects/snapshot';
import { forkProject } from '../projects/fork';
import { planImport, resolveImport, type ImportPlan, type Decision } from './import-plan';
import { planPersistence, type PersistencePlan } from './persistence';
import { exportBase, rememberExport } from './conflicts';
import { JournalService, type Mutation } from '../storage/journal';
import type { VaultPort } from '../storage/vault-port';
import { equalBytes, utf8 } from '../storage/vault-port';
import { safePath, isBelow } from '../storage/paths';
import { NameAllocator } from '../projects/names';
import { holdAnnotations } from '../mapping/annotations';

export interface CommitPreview { projectId: string; layout: Layout; persistence: PersistencePlan; source: Snapshot | null;
  indexFingerprint: string; warnings: Diagnostic[]; guards: Map<string, Uint8Array> }
/** Coordinates manual previews and commits. Every public mutation requires a concrete preview. */
export class TransferCoordinator {
  readonly index: ProjectIndex;
  readonly journal: JournalService;
  /** Composes pure domain planning with an injectable Vault port and current settings. */
  constructor(readonly vault: VaultPort, readonly settings: Settings) {
    this.index = new ProjectIndex(vault); this.journal = new JournalService(vault);
  }
  /** Reads a selected visible-vault JSON file with a strict suffix and complete validation. */
  async readImport(path: string): Promise<Exchange> {
    safePath(path);
    if (path.endsWith('.writeller.json')) fail('UNSUPPORTED_VERSION', 'Dieses Projektarchiv benötigt den Writeller-Exchange-Export. Das Archiv wurde nicht verändert.');
    const bytes = await this.vault.read(path);
    if (!bytes) fail('INVALID_FIELD', 'Ausgewählte Datei fehlt.');
    const pkg = await readExchange(bytes);
    if (!path.endsWith('.writeller-exchange.json')) fail('INVALID_FIELD', 'Exchange-Datei benötigt die Endung .writeller-exchange.json.');
    return pkg;
  }
  /** Selects explicit identity mode before computing conflicts; same-name matching is forbidden. */
  async previewImport(pkg: Exchange, mode: 'new' | 'update' | 'copy', targetId?: string): Promise<ImportPlan> {
    await validateExchange(pkg); await this.index.rebuild(); this.index.assertClean();
    if (mode === 'copy') pkg = forkProject(pkg, newId()).exchange;
    const existing = this.index.find(pkg.project.id, 'project', pkg.project.id);
    if (mode !== 'update' && existing) fail('IDENTITY_CONFLICT', 'Diese Projekt-ID ist bereits bekannt. Aktualisieren oder unabhängig kopieren wählen.');
    if (mode === 'update' && targetId !== pkg.project.id) fail('PROJECT_MISMATCH', 'Nur das Projekt mit exakt gleicher ID kann aktualisiert werden.');
    const local = mode === 'update' ? await snapshotProject(this.vault, this.index, pkg.project.id, true) : null;
    const plan = await planImport(pkg, local);
    if (mode === 'copy') plan.warnings.push({ code: 'UNSUPPORTED_REPRESENTATION', severity: 'warning', pointer: '', message: 'Zusätzliche Angaben aus anderen Anwendungen bleiben erhalten. Darin können noch Verweise auf das ursprüngliche Projekt stehen; bitte bei Bedarf prüfen.' });
    return plan;
  }
  /** Resolves all conflicts and produces exact file after-images for the final confirmation. */
  async resolve(plan: ImportPlan, decisions = new Map<string, Decision>(), envelopeChoice?: 'local' | 'incoming'): Promise<CommitPreview> {
    const resolved = await resolveImport(plan, decisions, envelopeChoice);
    const preview = await this.previewSave(resolved.exchange, plan.local, plan.incoming, resolved.acceptedKeys);
    const state = preview.layout.state;
    if (!state.packages.some(p => p.id === plan.incoming.packageId)) state.packages.push({ id: plan.incoming.packageId, hash: plan.packageHash });
    state.locallyDeleted = state.locallyDeleted.filter(k => !resolved.acceptedKeys.has(k));
    if (plan.local) {
      const existing = new Set(entries(resolved.exchange).map(e => recordKey(e.collection, e.record.id)));
      for (const r of plan.local.state.records) if (!existing.has(recordKey(r.collection, r.id))) {
        const key = recordKey(r.collection, r.id);
        if (!state.locallyDeleted.includes(key)) state.locallyDeleted.push(key);
      }
    }
    this.updateStateMutation(preview);
    preview.warnings.push(...resolved.warnings);
    return preview;
  }
  /** Plans local creation/editing or a resolved import with no writes before confirmation. */
  async previewSave(pkg: Exchange, local: Snapshot | null, incoming: Exchange | null = null, acceptedKeys = new Set<string>(), assignments = new Map<string, string>()): Promise<CommitPreview> {
    const editingWarnings: Diagnostic[] = [];
    if (local && !incoming) for (const e of entries(pkg)) {
      const original = local.records.get(recordKey(e.collection, e.record.id))?.record;
      if (original && 'content' in original && 'content' in e.record && (original.content.text !== e.record.content.text || original.content.format !== e.record.content.format)) editingWarnings.push(...await holdAnnotations(e.record, original.content.text));
      if (original && await recordHash(e.record) !== await recordHash(original)) e.record.updatedAt = now() < e.record.createdAt ? e.record.createdAt : now();
    }
    await validateExchange(pkg);
    await this.index.rebuild(); this.index.assertClean();
    const occupied = this.vault.files().map(f => f.path);
    const layout: Layout = local ? { root: local.root, statePath: local.statePath, state: clone(local.state) } : await newLayout(pkg, this.settings, occupied);
    if (!local && this.index.notes.some(n => n.projectId === pkg.project.id)) fail('IDENTITY_CONFLICT', 'Projektidentität ist inzwischen vorhanden. Neue Vorschau oder Aktualisierung wählen.');
    if (!local && await this.vault.read(layout.statePath)) fail('IDENTITY_CONFLICT', 'Datenordner wird bereits von einem Projekt beansprucht. Zustand reparieren.');
    if (local) for (const location of layout.state.records) {
      const note = this.index.find(pkg.project.id, location.collection, location.id);
      if (note) location.notePath = note.path;
    }
    await extendLayout(layout, pkg, occupied);
    for (const [key, path] of assignments) {
      const location = layout.state.records.find(r => recordKey(r.collection, r.id) === key);
      if (!location) fail('MISSING_REFERENCE', 'Zuordnungsziel fehlt.');
      location.notePath = safePath(path);
    }
    if (layout.state.records.some(r => isBelow(r.notePath, layout.root))) fail('PROJECT_MISMATCH', 'Datenordner darf keine verwalteten Inhaltsnotizen enthalten.');
    layout.state.extensions = clone(pkg.extensions);
    const persistence = await planPersistence(this.vault, this.index, pkg, layout, local, incoming, acceptedKeys, new Set(assignments.values()));
    return { projectId: pkg.project.id, layout, persistence, source: local, indexFingerprint: await this.index.fingerprint(),
      warnings: [...persistence.warnings, ...editingWarnings], guards: new Map(local?.files ?? []) };
  }
  /** Rejects any changed source, mapping, identity or sidecar after async preview work. */
  async assertFresh(preview: CommitPreview): Promise<void> {
    await this.index.rebuild(); this.index.assertClean();
    if (await this.index.fingerprint() !== preview.indexFingerprint) fail('LOCAL_CHANGED', 'Notizen oder Identitäten seit der Vorschau geändert. Neue Vorschau erstellen.');
    for (const [path, bytes] of preview.guards) {
      const current = await this.vault.read(path);
      if (!current || !equalBytes(bytes, current)) fail('LOCAL_CHANGED', 'Projektbegleitdaten seit der Vorschau geändert. Neue Vorschau erstellen.');
    }
  }
  /** Commits a confirmed preview serially through a write-ahead journal, then refreshes identity. */
  async commit(preview: CommitPreview): Promise<void> {
    await this.assertFresh(preview);
    if (!preview.source) {
      const base = preview.layout.state.manifestPath.slice(0, preview.layout.state.manifestPath.lastIndexOf('/'));
      for (const folder of ['Manuskript', 'Figuren', 'Orte', 'Gegenstände', 'Ereignisse', 'Handlungsbögen', 'Notizen', 'Recherche']) await this.vault.mkdir(`${base}/${folder}`);
    }
    await this.journal.commit(preview.layout.root, preview.projectId, preview.persistence.mutations);
    await this.index.rebuild();
  }
  /** Prepares a selected-partner export without mutating manuscripts or received baselines. */
  async previewExport(projectId: string, peer: Pick<Producer, 'system' | 'instanceId'> | null): Promise<{ preview: CommitPreview; path: string; exchange: Exchange }> {
    const snapshot = await snapshotProject(this.vault, this.index, projectId), pkg = clone(snapshot.exchange);
    pkg.packageId = newId(); pkg.exportedAt = now();
    const writes: Mutation[] = [];
    for (const e of entries(pkg)) {
      const key = recordKey(e.collection, e.record.id), state = clone(snapshot.records.get(key)!);
      e.record.baseHash = exportBase(state, peer);
      rememberExport(state, await recordHash(e.record));
      state.record = clone(e.record);
      const note = this.index.find(projectId, e.collection, e.record.id);
      if (state.projection && note) state.projection.body = note.body;
      const location = snapshot.state.records.find(r => r.collection === e.collection && r.id === e.record.id);
      if (!location) fail('STATE_MISSING', 'Objektindex fehlt. Projektzustand reparieren.');
      writes.push({ path: location.sidecarPath, before: await this.vault.read(location.sidecarPath), after: utf8(JSON.stringify(state, null, 2)), binary: false });
    }
    const path = new NameAllocator(this.vault.files().map(f => f.path)).allocate(safePath(this.settings.exchangeFolder), pkg.project.title, '.writeller-exchange.json');
    writes.push({ path, before: null, after: utf8(await writeExchange(pkg)), binary: false });
    writes.push({ path: snapshot.statePath, before: snapshot.files.get(snapshot.statePath) ?? null, after: utf8(JSON.stringify(snapshot.state, null, 2)), binary: false });
    const layout = { root: snapshot.root, statePath: snapshot.statePath, state: clone(snapshot.state) };
    const preview: CommitPreview = { projectId, layout, source: snapshot, indexFingerprint: await this.index.fingerprint(), warnings: snapshot.warnings,
      persistence: { mutations: writes, warnings: snapshot.warnings, records: snapshot.records }, guards: new Map(snapshot.files) };
    return { preview, path, exchange: pkg };
  }
  /** Rewrites only the planned state after packet registry and deletion decisions are complete. */
  private updateStateMutation(preview: CommitPreview): void {
    const mutation = preview.persistence.mutations.find(m => m.path === preview.layout.statePath);
    if (mutation) mutation.after = utf8(JSON.stringify(preview.layout.state, null, 2));
  }
  /** Gets a current loss-preserving snapshot for commands and property forms. */
  snapshot(projectId: string): Promise<Snapshot> { return snapshotProject(this.vault, this.index, projectId); }
  /** Looks up one typed entry from a current project snapshot for object commands. */
  entry(snapshot: Snapshot, key: string): Entry {
    const entry = entries(snapshot.exchange).find(e => recordKey(e.collection, e.record.id) === key);
    if (!entry) fail('MISSING_REFERENCE', 'Objekt fehlt im aktuellen Projekt.');
    return entry;
  }
}
