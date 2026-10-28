import type { Diagnostic } from '../domain/diagnostics';
import { ExchangeError } from '../domain/diagnostics';
import { parseManaged, type ManagedNote } from '../mapping/frontmatter';
import { language } from '../i18n/language';

export interface ParsedNote { version: string | undefined; locale: string; source?: string; note: ManagedNote | null; problems: Diagnostic[] }
/** Parsed source reuse is independent of the optional filesystem hint; fresh reads still win. */
export function parsedNote(path: string, source: string, version: string | undefined, previous?: ParsedNote): ParsedNote {
  if (previous?.source === source && previous.locale === language()) return { ...previous, version };
  try {
    const note = parseManaged(path, source);
    // Ordinary note bodies need not be retained in a second in-memory index.
    return { version, locale: language(), ...(note ? { source } : {}), note, problems: [] };
  } catch (error) {
    if (!(error instanceof ExchangeError)) throw error;
    return { version, locale: language(), source, note: null, problems: error.diagnostics };
  }
}
