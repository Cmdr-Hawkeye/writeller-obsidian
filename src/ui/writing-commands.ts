import { Notice } from 'obsidian';
import { createProject, createRecord } from '../objects/factory';
import { writingKinds, kindFor, namedChoices } from '../objects/kinds';
import { clone, entries, recordKey, setEntry, title } from '../domain/records';
import type { Entry, Ref } from '../domain/types';
import { fail } from '../domain/diagnostics';
import { newId } from '../exchange/hash';
import { parseManaged, splitNote } from '../mapping/frontmatter';
import { chapterField, detailFields, detailHeading, applyDetails, wordGoal } from './writing-fields';
import { writingForm, type FormField, type FormValues } from './form';
import { choose } from './dialogs';
import type { CommandContext } from './command-context';

/** Everyday writing actions: familiar nouns, contextual project selection and ordinary Markdown notes. */
export class WritingCommands {
  /** Reuses the same checked persistence service as import/export. */
  constructor(private readonly ctx: CommandContext) {}
  /** Creates a book/project from one labelled form and opens its working overview. */
  async createProject(): Promise<void> {
    const values = await writingForm(this.ctx.app, 'Neues Schreibprojekt', [
      { key: 'title', label: 'Projekttitel', required: true, placeholder: 'Zum Beispiel: Mein erstes Buch' },
      { key: 'description', label: 'Worum geht es?', kind: 'area', placeholder: 'Eine kurze Idee für deine Geschichte. Optional.' },
      { key: 'wordTarget', label: 'Schreibziel in Wörtern', kind: 'number', description: 'Optional. Das Ziel lässt sich später ändern.' }
    ], 'Projekt erstellen', validateWriting);
    if (!values) return;
    const pkg = createProject(values['title']!.trim()); pkg.project.languageCode = 'de'; pkg.project.description = values['description'] ?? '';
    pkg.project.wordTarget = wordGoal(values['wordTarget']);
    await this.ctx.save(await this.ctx.service.previewSave(pkg, null));
    await this.ctx.openProjectView?.(pkg.project.id); new Notice('Dein Schreibprojekt ist bereit.');
  }
  /** Offers familiar object types for toolbar/context actions instead of a technical collection picker. */
  async pickKind(assignPath?: string): Promise<void> {
    const kind = await choose(this.ctx.app, 'Was möchtest du hinzufügen?', writingKinds.map(k => ({ label: k.singular, value: k.id })));
    if (kind) await this.add(kind, undefined, undefined, assignPath);
  }
  /** Adds one selected writing object, with visible chapter context and collision-safe readable paths. */
  async add(kindId: string, projectId?: string, chapterId?: string, assignPath?: string): Promise<void> {
    const kind = writingKinds.find(k => k.id === kindId); if (!kind) return;
    const snapshot = await this.ctx.project(projectId); if (!snapshot) return;
    const pkg = snapshot.exchange, fields: FormField[] = [{ key: 'title', label: kind.collection === 'catalogItems' ? 'Name' : 'Titel', value: assignPath?.split('/').at(-1)?.replace(/\.md$/, '') ?? '', required: true }];
    if (['chapters', 'catalogItems'].includes(kind.collection)) fields.push({ key: 'summary', label: 'Kurzbeschreibung', kind: 'area', placeholder: 'Optional. Du kannst die Notiz anschließend frei bearbeiten.' });
    if (kind.id === 'scene') fields.push(chapterField(pkg, chapterId ?? this.chapterContext(pkg.project.id, pkg.scenes) ?? pkg.chapters.at(-1)?.id ?? null));
    if (kind.id === 'research') fields.push({ key: 'uri', label: 'Quelle oder Link', placeholder: 'Optional. Es wird nichts automatisch heruntergeladen.' });
    if (kind.id === 'character') fields.push({ key: 'roleFunction', label: 'Rolle in der Geschichte', placeholder: 'Optional.' }, { key: 'motivation', label: 'Was treibt die Figur an?', placeholder: 'Optional.' });
    if (kind.id === 'custom') fields.push({ key: 'typeName', label: 'Eigene Objektart', placeholder: 'Zum Beispiel: Organisation', required: true });
    if (kind.id === 'relationship') fields.push(...this.relationshipFields(entries(pkg)));
    const values = await writingForm(this.ctx.app, `${kind.singular} hinzufügen · ${pkg.project.title}`, fields, `${kind.singular} hinzufügen`, validateWriting);
    if (!values) return;
    const type = kind.type ?? (kind.id === 'custom' ? customType(values['typeName']!, pkg.catalogItems) : undefined);
    const source = kind.id === 'relationship' ? refFor(values['source'], entries(pkg)) : undefined;
    const target = kind.id === 'relationship' ? refFor(values['target'], entries(pkg)) : undefined;
    const entry = createRecord(kind.collection, pkg.project.id, snapshot.state.localInstanceId, values['title']!.trim(),
      { ...(type ? { type } : {}), ...(source ? { source } : {}), ...(target ? { target } : {}) });
    if ('summary' in entry.record) entry.record.summary = values['summary'] ?? '';
    if ('orderIndex' in entry.record) entry.record.orderIndex = Math.max(-1, ...pkg[kind.collection === 'chapters' ? 'chapters' : 'scenes'].map(r => r.orderIndex)) + 1;
    if ('chapterId' in entry.record) entry.record.chapterId = values['chapterId'] || null;
    if ('uri' in entry.record) entry.record.uri = values['uri'] ?? '';
    if (kind.id === 'character' && 'fields' in entry.record) for (const key of ['roleFunction', 'motivation']) if (values[key]) entry.record.fields[key] = values[key];
    if ('relationshipType' in entry.record) entry.record.relationshipType = values['relationshipType']?.trim() || 'relatedTo';
    if (kind.id === 'custom') entry.record.extensions['org.writeller.obsidian'] = { customTypeName: values['typeName']!.trim() };
    const assignments = await this.assign(entry, assignPath);
    setEntry(pkg, entry); await this.ctx.save(await this.ctx.service.previewSave(pkg, snapshot, null, new Set(), assignments));
    const note = this.ctx.service.index.find(pkg.project.id, entry.collection, entry.record.id);
    if (note) await this.ctx.open(note.path);
  }
  /** Edits ordinary details without exposing identities, raw JSON or preservation internals. */
  async details(projectId?: string, key?: string): Promise<void> {
    const active = this.ctx.active(), snapshot = await this.ctx.project(projectId ?? active?.projectId); if (!snapshot) return;
    const entry = clone(this.ctx.service.entry(snapshot, key ?? (active?.projectId === snapshot.state.projectId ? recordKey(active.collection, active.id) : `project/${snapshot.state.projectId}`)));
    if ('status' in entry.record && entry.record.status === 'locked') new Notice('Diese Notiz ist als abgeschlossen markiert. Du kannst sie bewusst weiter bearbeiten.');
    const values = await writingForm(this.ctx.app, detailHeading(entry), detailFields(entry, snapshot.exchange), 'Änderungen speichern', validateWriting);
    if (!values) return;
    applyDetails(entry, values, snapshot.exchange); setEntry(snapshot.exchange, entry);
    await this.ctx.save(await this.ctx.service.previewSave(snapshot.exchange, snapshot));
  }
  /** Derives a visible default chapter from the active managed note, never from its folder name. */
  private chapterContext(projectId: string, scenes: { id: string; chapterId: string | null }[]): string | null {
    const active = this.ctx.active();
    if (active?.projectId !== projectId) return null;
    return active.collection === 'chapters' ? active.id : scenes.find(s => s.id === active.id)?.chapterId ?? null;
  }
  /** Preserves an ordinary existing note's body and user properties during explicit assignment. */
  private async assign(entry: Entry, path?: string): Promise<Map<string, string>> {
    const result = new Map<string, string>(); if (!path) return result;
    const bytes = await this.ctx.service.vault.read(path); if (!bytes) fail('LOCAL_CHANGED', 'Die ausgewählte Notiz fehlt.');
    const source = new TextDecoder().decode(bytes);
    if (parseManaged(path, source)) fail('IDENTITY_CONFLICT', 'Diese Notiz gehört bereits zu einem Schreibprojekt.');
    if ('content' in entry.record) entry.record.content.text = splitNote(source).body;
    else if ('summary' in entry.record) entry.record.summary = splitNote(source).body;
    else fail('UNSUPPORTED_REPRESENTATION', 'Für bestehende Notizen bitte eine Notizart mit frei bearbeitbarem Text wählen.');
    result.set(recordKey(entry.collection, entry.record.id), path); return result;
  }
  /** Selects both relationship endpoints by readable type/title while hidden values remain typed refs. */
  private relationshipFields(all: Entry[]): FormField[] {
    const options = namedChoices(all.filter(e => e.collection !== 'relationships'), e => `${e.collection === 'project' ? 'Projekt' : kindFor(e).singular} · ${title(e.record)}`)
      .map(c => ({ label: c.label, value: recordKey(c.value.collection, c.value.record.id) }));
    return [{ key: 'source', label: 'Von', kind: 'select', required: true, value: options[0]?.value ?? '', options },
      { key: 'target', label: 'Zu', kind: 'select', required: true, value: options[1]?.value ?? options[0]?.value ?? '', options },
      { key: 'relationshipType', label: 'Art der Beziehung', value: 'kennt', required: true }];
  }
}
/** Validates common new/edit form inputs while the user's typed text remains in the dialog. */
function validateWriting(values: FormValues): void {
  if (!values['title']?.trim() || [...values['title']].length > 500) fail('INVALID_FIELD', 'Bitte einen Titel mit höchstens 500 Zeichen eingeben.');
  wordGoal(values['wordTarget']);
  if (values['typeName'] && [...values['typeName']].length > 100) fail('INVALID_FIELD', 'Die Objektart darf höchstens 100 Zeichen lang sein.');
}
/** Resolves form values against the selected project, so arbitrary IDs cannot forge a relationship. */
function refFor(key: string | undefined, all: Entry[]): Ref {
  const entry = all.find(e => recordKey(e.collection, e.record.id) === key);
  if (!entry || entry.collection === 'relationships') fail('MISSING_REFERENCE', 'Bitte beide Beziehungspartner auswählen.');
  return { collection: entry.collection, id: entry.record.id };
}
/** Uses a readable type label for users and a stable namespaced code solely inside Exchange data. */
function customType(name: string, items: { type: string; extensions: Record<string, unknown> }[]): string {
  const existing = items.find(i => {
    const ext = i.extensions['org.writeller.obsidian']; return typeof ext === 'object' && ext !== null && 'customTypeName' in ext && ext.customTypeName === name.trim();
  });
  const slug = name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return existing?.type ?? `custom:obsidian.type-${slug || newId()}`;
}
