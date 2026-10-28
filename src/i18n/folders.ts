import { language, type Language } from './language';

/** Stable bilingual folder roles; object IDs and user-authored names are never translated. */
export const folderNames = {
  projects: { de: 'Schreibprojekte', en: 'Writing Projects' }, exports: { de: 'Exporte', en: 'Exports' },
  manuscript: { de: 'Manuskript', en: 'Manuscript' }, unassigned: { de: 'Ohne Kapitel', en: 'Without Chapter' },
  character: { de: 'Figuren', en: 'Characters' }, location: { de: 'Orte', en: 'Locations' }, object: { de: 'Gegenstände', en: 'Items' },
  timelineEvent: { de: 'Ereignisse', en: 'Events' }, arc: { de: 'Handlungsbögen', en: 'Story Arcs' },
  relationships: { de: 'Beziehungen', en: 'Relationships' }, notes: { de: 'Notizen', en: 'Notes' },
  researchItems: { de: 'Recherche', en: 'Research' }, custom: { de: 'Eigene Typen', en: 'Custom Types' }
} as const;
export type FolderRole = keyof typeof folderNames;
/** Returns the translated label for a known structural role. */
export function folderName(role: FolderRole, locale = language()): string { return folderNames[role][locale]; }
/** Recognizes both installed languages independently of the current UI preference. */
export function folderRole(name: string): FolderRole | undefined {
  return (Object.keys(folderNames) as FolderRole[]).find(key => Object.values(folderNames[key]).some(value => value.normalize('NFC').toLowerCase() === name.normalize('NFC').toLowerCase()));
}
/** Only built-in top-level defaults follow language changes; user-chosen roots remain unchanged. */
export function translatedRoot(path: string, role: 'projects' | 'exports', locale: Language): string {
  return Object.values(folderNames[role]).some(name => name === path) ? folderName(role, locale) : path;
}
