import { Notice } from 'obsidian';
import { entries, recordKey, setEntry, clone } from '../domain/records';
import type { Entry } from '../domain/types';
import { fail, ExchangeError } from '../domain/diagnostics';
import { assertRecord } from '../exchange/schema';
import { isObject, parseJson } from '../exchange/parser';
import { jcs, now } from '../exchange/hash';
import { changeCatalogType, forkProject, transferObject } from '../projects/fork';
import { snapshotProject } from '../projects/snapshot';
import { incomingReferences } from '../objects/references';
import { writingKinds } from '../objects/kinds';
import { CommandContext } from './command-context';
import { choose, input } from './dialogs';

/** Local writing operations share the same schema, graph validation and journal as imports. */
export class LocalCommands {
  /** Binds only UI helpers; no independent storage or implicit active-project state is created. */
  constructor(private readonly ctx: CommandContext) {}
  /** Offers all known catalog types and an explicitly namespaced custom type. */
  private async catalogType(): Promise<string | null> {
    const type = await choose(this.ctx.app, 'Notizart', [...writingKinds.filter(k => k.type).map(k => ({ label: k.singular, value: k.type! })), { label: 'Eigener Typ …', value: 'custom' }]);
    return type === 'custom' ? input(this.ctx.app, 'Typ als custom:namensraum.name', 'custom:example.organization') : type;
  }
  /** Changes catalog types only after incoming POV references have been checked. */
  async changeType(path?: string): Promise<void> {
    const note = this.ctx.active(path); if (!note || note.collection !== 'catalogItems') return;
    const snapshot = await this.ctx.service.snapshot(note.projectId), type = await this.catalogType(); if (!type) return;
    changeCatalogType(snapshot.exchange, note.id, type);
    await this.ctx.commit(await this.ctx.service.previewSave(snapshot.exchange, snapshot), 'Notizart ändern', ['Der Notiztext und zusätzliche Angaben bleiben erhalten.']);
  }
  /** Edits full JSON, retaining arbitrary typed fields and rejecting identity changes. */
  async properties(path?: string): Promise<void> {
    const note = this.ctx.active(path); if (!note) return;
    let snapshot;
    try { snapshot = await this.ctx.service.snapshot(note.projectId); }
    catch (error) {
      if (!(error instanceof ExchangeError) || !error.diagnostics.some(d => d.code === 'UNSUPPORTED_REPRESENTATION' || d.code === 'INVALID_FIELD')) throw error;
      snapshot = await snapshotProject(this.ctx.service.vault, this.ctx.service.index, note.projectId, false, new Map(), recordKey(note.collection, note.id));
      new Notice('Die Notiz hat nicht zugeordnete Änderungen. Der JSON-Editor zeigt erhaltene Daten. Erst bestätigte Daten ersetzen die Ansicht; deren bisherigen Quelltext sichert das Journal.', 12000);
    }
    const entry = this.ctx.service.entry(snapshot, recordKey(note.collection, note.id));
    if ('status' in entry.record && entry.record.status === 'locked') new Notice('Inhalt ist fachlich als locked markiert. Änderungen sind eine bewusste Bearbeitung.', 8000);
    let replacement = clone(entry.record);
    if (entry.collection === 'relationships') {
      const action = await choose(this.ctx.app, 'Beziehung bearbeiten', [{ label: 'JSON mit vollständigen Eigenschaften', value: 'json' }, { label: 'Typisierte Endpunkte auswählen', value: 'endpoints' }]);
      if (!action) return;
      if (action === 'endpoints') {
        const source = await this.ctx.endpoint(entries(snapshot.exchange), 'Quellobjekt'), target = await this.ctx.endpoint(entries(snapshot.exchange), 'Zielobjekt');
        if (!source || !target || !('relationshipType' in replacement)) return;
        replacement.source = source; replacement.target = target;
      }
    }
    const json = await input(this.ctx.app, 'Eigenschaften bearbeiten – JSON-Werte bleiben typgetreu', JSON.stringify(replacement, null, 2), true, async value => {
      const parsed = parseJson(value); assertRecord(parsed, entry.collection);
      if (parsed.id !== entry.record.id || jcs(parsed.origin) !== jcs(entry.record.origin) || parsed.createdAt !== entry.record.createdAt ||
        ('projectId' in parsed && parsed.projectId !== note.projectId)) fail('IDENTITY_CONFLICT', 'IDs, Origin, Erstellzeit und Projektbesitz sind unveränderlich.');
      if (!isObject(parsed)) fail('INVALID_FIELD', 'Vollständiges Objekt erwartet.');
      replacement = parsed; replacement.updatedAt = now();
    });
    if (json === null) return;
    setEntry(snapshot.exchange, { collection: entry.collection, record: replacement } as Entry);
    const preview = await this.ctx.service.previewSave(snapshot.exchange, snapshot);
    preview.warnings.push(...snapshot.warnings);
    await this.ctx.commit(preview, 'Eigenschaften übernehmen');
  }
  /** Creates a complete new identity graph while reporting opaque unverified metadata references. */
  async copyProject(): Promise<void> {
    const snapshot = await this.ctx.project(); if (!snapshot) return;
    const result = forkProject(snapshot.exchange, snapshot.state.localInstanceId), preview = await this.ctx.service.previewSave(result.exchange, null);
    preview.warnings.push(...result.warnings);
    await this.ctx.commit(preview, 'Projekt kopieren', [snapshot.exchange.project.title, 'Die Kopie lässt sich eigenständig bearbeiten. Dein Original bleibt unverändert.']);
  }
  /** Copies a detached object with a new target identity; source content is never deleted. */
  async transfer(path?: string): Promise<void> {
    const note = this.ctx.active(path); if (!note) return;
    const source = await this.ctx.service.snapshot(note.projectId), target = await this.ctx.project(undefined, true, note.projectId); if (!target) return;
    const entry = transferObject(source.exchange, this.ctx.service.entry(source, recordKey(note.collection, note.id)), target.exchange);
    setEntry(target.exchange, entry);
    const preview = await this.ctx.service.previewSave(target.exchange, target);
    for (const [p, bytes] of source.files) preview.guards.set(p, bytes);
    const inbound = incomingReferences(source.exchange, { collection: note.collection, id: note.id });
    await this.ctx.commit(preview, 'Notiz in anderes Projekt kopieren', [target.exchange.project.title, `${inbound.length} Verknüpfungen bleiben mit dem Original verbunden.`, 'Die ursprüngliche Notiz bleibt erhalten. Zusätzliche Angaben aus anderen Anwendungen können weiterhin auf das ursprüngliche Projekt verweisen.']);
  }
}
