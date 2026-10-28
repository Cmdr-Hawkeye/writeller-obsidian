import { tr } from '../i18n/translate';
import type { Collection, Entry } from '../domain/types';

export interface WritingKind { id: string; singular: string; plural: string; collection: Exclude<Collection, 'project'>; icon: string; type?: string }
const definitions: WritingKind[] = [
  { id: 'chapter', singular: 'Kapitel', plural: 'Kapitel', collection: 'chapters', icon: 'book-open' },
  { id: 'scene', singular: 'Szene', plural: 'Szenen', collection: 'scenes', icon: 'file-text' },
  { id: 'character', singular: 'Figur', plural: 'Figuren', collection: 'catalogItems', type: 'character', icon: 'user-round' },
  { id: 'location', singular: 'Ort', plural: 'Orte', collection: 'catalogItems', type: 'location', icon: 'map-pin' },
  { id: 'object', singular: 'Gegenstand', plural: 'Gegenstände', collection: 'catalogItems', type: 'object', icon: 'package' },
  { id: 'timelineEvent', singular: 'Ereignis', plural: 'Ereignisse', collection: 'catalogItems', type: 'timelineEvent', icon: 'calendar-days' },
  { id: 'arc', singular: 'Handlungsbogen', plural: 'Handlungsbögen', collection: 'catalogItems', type: 'arc', icon: 'route' },
  { id: 'note', singular: 'Notiz', plural: 'Notizen', collection: 'notes', icon: 'sticky-note' },
  { id: 'research', singular: 'Recherche', plural: 'Recherche', collection: 'researchItems', icon: 'search' },
  { id: 'relationship', singular: 'Beziehung', plural: 'Beziehungen', collection: 'relationships', icon: 'link' },
  { id: 'custom', singular: 'Eigene Objektart', plural: 'Eigene Typen', collection: 'catalogItems', icon: 'shapes' }
];
const statusDefinitions: Record<string, string> = { idea: 'Idee', planned: 'Geplant', outlined: 'Skizziert', drafting: 'In Arbeit', needsRevision: 'Überarbeiten', revised: 'Überarbeitet', reviewed: 'Geprüft', locked: 'Abgeschlossen', archived: 'Archiviert' };
/** Labels are resolved on access so open views follow language changes without reimporting modules. */
export const writingKinds: WritingKind[] = definitions.map(kind => ({ ...kind, get singular() { return tr(kind.singular); }, get plural() { return tr(kind.plural); } }));
/** Native dropdowns enumerate current labels while wire status values remain stable. */
export const statusLabels: Record<string, string> = Object.defineProperties({}, Object.fromEntries(Object.entries(statusDefinitions).map(([key, text]) => [key, { enumerable: true, get: () => tr(text) }])));
/** Looks up the writing concept without exposing collection names or IDs in ordinary UI. */
export function kindFor(entry: Entry): WritingKind {
  return writingKinds.find(k => k.collection === entry.collection && (entry.collection !== 'catalogItems' || k.type === entry.record.type))
    ?? writingKinds.find(k => k.id === 'custom')!;
}
/** Disambiguates same-name choices with readable ordinal numbers while opaque values stay internal. */
export function namedChoices<T>(items: T[], label: (item: T) => string): { label: string; value: T }[] {
  const totals = new Map<string, number>(), seen = new Map<string, number>();
  for (const item of items) totals.set(label(item), (totals.get(label(item)) ?? 0) + 1);
  return items.map(value => {
    const text = label(value), number = (seen.get(text) ?? 0) + 1; seen.set(text, number);
    return { label: `${text}${(totals.get(text) ?? 0) > 1 ? ` (${number})` : ''}`, value };
  });
}
