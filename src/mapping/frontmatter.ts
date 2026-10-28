import { tr } from '../i18n/translate';
import { parseDocument, stringify } from 'yaml';
import type { Collection, ExchangeRecord, JsonObject } from '../domain/types';
import { collections } from '../domain/types';
import { isObject } from '../exchange/parser';
import { fail } from '../domain/diagnostics';

export interface ManagedNote { path: string; projectId: string; collection: Collection; id: string; properties: JsonObject; body: string; source: string }
export interface NoteParts { properties: JsonObject; body: string; header: string }
/** Splits YAML without normalizing any byte in the manuscript body; aliases are disabled. */
export function splitNote(source: string): NoteParts {
  const match = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(source);
  if (!match) return { properties: {}, body: source, header: '' };
  if (match[0].length > 128 * 1024) fail('LIMIT_EXCEEDED', tr('Frontmatter ist zu groß.'));
  const doc = parseDocument(match[1] ?? '', { uniqueKeys: true, schema: 'core', strict: true });
  if (doc.errors.length) fail('INVALID_FIELD', tr('Frontmatter reparieren: ungültige oder doppelte Properties.'));
  let value: unknown;
  try { value = doc.toJS({ maxAliasCount: 0 }); } catch { fail('INVALID_FIELD', tr('YAML-Aliase werden für verwaltete Properties nicht unterstützt.')); }
  if (!isObject(value)) fail('INVALID_FIELD', tr('Frontmatter muss ein Objekt sein.'));
  return { properties: value, body: source.slice(match[0].length), header: match[0] };
}
/** Extracts mandatory ownership values. Unmanaged notes return null; partial identities fail. */
export function parseManaged(path: string, source: string): ManagedNote | null {
  const parts = splitNote(source), props = parts.properties;
  if (!Object.keys(props).some(k => k.startsWith('writeller-'))) return null;
  const projectId = props['writeller-project-id'], id = props['writeller-id'], collection = props['writeller-collection'];
  const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(v);
  if (props['writeller-schema'] !== 1 || !validId(projectId) || !validId(id) || !collections.includes(collection as Collection)) fail('INVALID_FIELD', tr('Identitätsproperties fehlen oder sind ungültig. Projektprüfung öffnen.'));
  if (collection === 'project' && id !== projectId) fail('PROJECT_MISMATCH', tr('Projektmanifest hat widersprüchliche IDs.'));
  return { path, projectId, id, collection: collection as Collection, properties: props, body: parts.body, source };
}
/** Projects only collection-specific public properties; unrelated user properties stay outside export. */
export function recordProperties(collection: Collection, record: ExchangeRecord, projectId: string, statePath?: string): JsonObject {
  const props: JsonObject = { 'writeller-schema': 1, 'writeller-project-id': projectId, 'writeller-id': record.id,
    'writeller-collection': collection, 'writeller-title': 'name' in record ? record.name : 'title' in record ? record.title : record.label ?? record.relationshipType };
  if ('status' in record) props['writeller-status'] = record.status;
  if ('orderIndex' in record) props['writeller-order'] = record.orderIndex;
  if ('type' in record) props['writeller-type'] = record.type;
  if ('content' in record) props['writeller-content-format'] = record.content.format;
  if ('parentSceneId' in record) {
    props['writeller-chapter-id'] = record.chapterId; props['writeller-parent-scene-id'] = record.parentSceneId;
    props['writeller-pov-character-id'] = record.povCharacterId;
  }
  if (collection === 'project' && statePath) props['writeller-state-path'] = statePath;
  return props;
}
/** Renders a new note or preserves all non-writeller YAML properties through a validated rebuild. */
export function renderNote(properties: JsonObject, body: string, existing = ''): string {
  const other = Object.fromEntries(Object.entries(splitNote(existing).properties).filter(([k]) => !k.startsWith('writeller-')));
  return `---\n${stringify(Object.fromEntries([...Object.entries(other), ...Object.entries(properties)]), { schema: 'core', lineWidth: 0 })}---\n${body}`;
}
