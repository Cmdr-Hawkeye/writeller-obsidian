import { tr } from '../i18n/translate';
import type { Entry, Exchange } from '../domain/types';
import { title, entries, recordKey } from '../domain/records';
import { kindFor, namedChoices, statusLabels } from '../objects/kinds';
import type { FormField, FormValues } from './form';
import { fail } from '../domain/diagnostics';

/** Nullable word goals are exact integers; empty input means no goal rather than zero. */
export function wordGoal(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) fail('INVALID_FIELD', tr('Das Schreibziel muss eine ganze, nicht negative Wortzahl sein.'));
  return result;
}
/** Provides human property fields, preserving all other Exchange data in the full record. */
export function detailFields(entry: Entry, pkg: Exchange): FormField[] {
  const record = entry.record;
  const fields: FormField[] = [{ key: 'title', label: entry.collection === 'catalogItems' ? tr('Name') : tr('Titel'), value: title(record), required: true }];
  if ('status' in record) fields.push({ key: 'status', label: tr('Stand'), kind: 'select', value: record.status,
    options: Object.entries({ ...statusLabels, ...(!Object.hasOwn(statusLabels, record.status) ? { [record.status]: record.status } : {}) }).map(([value, label]) => ({ label, value })) });
  if ('summary' in record) fields.push({ key: 'summary', label: tr('Kurzbeschreibung'), kind: 'area', value: record.summary });
  if (entry.collection === 'project') fields.push({ key: 'description', label: tr('Worum geht es?'), kind: 'area', value: entry.record.description },
    { key: 'wordTarget', label: tr('Schreibziel in Wörtern'), kind: 'number', value: entry.record.wordTarget?.toString() ?? '', description: tr('Optional. Du kannst auch ohne festes Ziel schreiben.') });
  if (entry.collection === 'scenes') {
    fields.push(chapterField(pkg, entry.record.chapterId));
    fields.push({ key: 'goal', label: tr('Was soll in dieser Szene geschehen?'), kind: 'area', value: entry.record.goal ?? '' });
  }
  if (entry.collection === 'catalogItems' && entry.record.type === 'character') for (const [key, label] of [['roleFunction', tr('Rolle in der Geschichte')], ['motivation', tr('Was treibt die Figur an?')]] as const) {
    const value = entry.record.fields[key];
    if (value === undefined || typeof value === 'string') fields.push({ key, label, value: value ?? '' });
  }
  if (entry.collection === 'researchItems') fields.push({ key: 'uri', label: tr('Quelle oder Link'), value: entry.record.uri });
  if (entry.collection === 'relationships') {
    const options = namedChoices(entries(pkg).filter(e => e.collection !== 'relationships'), e => `${e.collection === 'project' ? tr('Projekt') : kindFor(e).singular} · ${title(e.record)}`)
      .map(c => ({ label: c.label, value: recordKey(c.value.collection, c.value.record.id) }));
    fields.push({ key: 'source', label: tr('Von'), kind: 'select', value: recordKey(entry.record.source.collection, entry.record.source.id), options },
      { key: 'target', label: tr('Zu'), kind: 'select', value: recordKey(entry.record.target.collection, entry.record.target.id), options },
      { key: 'relationshipType', label: tr('Art der Beziehung'), value: entry.record.relationshipType, required: true },
      { key: 'description', label: tr('Beschreibung'), kind: 'area', value: entry.record.description ?? '' },
      { key: 'direction', label: tr('Richtung'), kind: 'select', value: entry.record.direction, options: [{ label: tr('Gerichtet (von → zu)'), value: 'directed' }, { label: tr('Wechselseitig'), value: 'undirected' }] });
  }
  return fields;
}
/** Lists chapters by title, with an explicit unassigned option and no visible identifiers. */
export function chapterField(pkg: Exchange, selected: string | null): FormField {
  return { key: 'chapterId', label: tr('Kapitel'), kind: 'select', value: selected ?? '', options: [{ label: tr('Noch keinem Kapitel zuordnen'), value: '' },
    ...namedChoices([...pkg.chapters].sort((a, b) => a.orderIndex - b.orderIndex), c => c.title).map(c => ({ label: c.label, value: c.value.id }))] };
}
/** Applies only displayed editable fields; immutable identities and complex foreign values stay intact. */
export function applyDetails(entry: Entry, values: FormValues, pkg?: Exchange): void {
  const r = entry.record;
  if ('title' in r) r.title = values['title']?.trim() ?? r.title;
  else if ('name' in r) r.name = values['title']?.trim() ?? r.name;
  else r.label = values['title'] ?? r.label;
  if ('status' in r && values['status'] !== undefined) r.status = values['status'];
  if ('summary' in r && values['summary'] !== undefined) r.summary = values['summary'];
  if (entry.collection === 'project') { entry.record.description = values['description'] ?? entry.record.description; entry.record.wordTarget = wordGoal(values['wordTarget']); }
  if (entry.collection === 'scenes') {
    const chapterId = values['chapterId'] || null;
    if (chapterId !== entry.record.chapterId && entry.record.parentSceneId) fail('INVALID_FIELD', tr('Eine Unterszene bleibt im Kapitel ihrer übergeordneten Szene.'));
    entry.record.chapterId = chapterId; entry.record.goal = values['goal'] || null;
  }
  if (entry.collection === 'catalogItems') for (const key of ['roleFunction', 'motivation']) {
    if (values[key] !== undefined) entry.record.fields[key] = values[key];
  }
  if (entry.collection === 'researchItems') entry.record.uri = values['uri'] ?? entry.record.uri;
  if (entry.collection === 'relationships') {
    if (!pkg) fail('MISSING_REFERENCE', tr('Zum Bearbeiten einer Verbindung muss ihr Projekt geöffnet sein.'));
    for (const field of ['source', 'target'] as const) {
      const chosen = entries(pkg).find(e => recordKey(e.collection, e.record.id) === values[field]);
      if (!chosen || chosen.collection === 'relationships') fail('MISSING_REFERENCE', tr('Bitte gültige Beziehungspartner auswählen.'));
      entry.record[field] = { collection: chosen.collection, id: chosen.record.id };
    }
    entry.record.relationshipType = values['relationshipType']?.trim() || entry.record.relationshipType;
    entry.record.description = values['description'] || null;
    entry.record.direction = values['direction'] === 'undirected' ? 'undirected' : 'directed';
  }
}
/** Returns the familiar noun for dialog headings. */
export function detailHeading(entry: Entry): string { return entry.collection === 'project' ? tr('Projekt bearbeiten') : tr`${kindFor(entry).singular} bearbeiten`; }
