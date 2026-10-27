import type { ExchangeRecord, JsonObject } from '../domain/types';
import { clone } from '../domain/records';
import { fail } from '../domain/diagnostics';

/** Applies the documented writable properties without treating unrelated Obsidian properties as content. */
export function applyProperties(record: ExchangeRecord, props: JsonObject): ExchangeRecord {
  const result = clone(record);
  const title = props['writeller-title'];
  if (typeof title !== 'string') fail('INVALID_FIELD', 'writeller-title fehlt oder ist kein Text.');
  if ('name' in result) result.name = title;
  else if ('title' in result) result.title = title;
  else if (title !== (result.label ?? result.relationshipType)) fail('UNSUPPORTED_REPRESENTATION', 'Beziehungstitel über label oder relationshipType im Eigenschaften-Editor ändern.');
  if ('status' in result) result.status = requiredString(props, 'writeller-status');
  if ('type' in result) result.type = requiredString(props, 'writeller-type');
  if ('orderIndex' in result) {
    const value = props['writeller-order'];
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('INVALID_FIELD', 'writeller-order muss eine Zahl sein.');
    result.orderIndex = value;
  }
  if ('content' in result) {
    const format = props['writeller-content-format'];
    if (format !== 'plain' && format !== 'markdown') fail('INVALID_FIELD', 'Inhaltsformat ausdrücklich als plain oder markdown angeben.');
    result.content.format = format;
  }
  if ('parentSceneId' in result) {
    result.chapterId = nullableString(props, 'writeller-chapter-id');
    result.parentSceneId = nullableString(props, 'writeller-parent-scene-id');
    result.povCharacterId = nullableString(props, 'writeller-pov-character-id');
  }
  return result;
}
/** Rejects property coercion rather than converting objects, booleans or null to strings. */
function requiredString(props: JsonObject, key: string): string {
  const value = props[key];
  if (typeof value !== 'string') fail('INVALID_FIELD', 'Verwaltete Texteigenschaft ist ungültig.');
  return value;
}
/** Nullable scene references must be present explicitly, including null. */
function nullableString(props: JsonObject, key: string): string | null {
  const value = props[key];
  if (value !== null && typeof value !== 'string') fail('INVALID_FIELD', 'Szenenbezug muss eine ID oder null sein.');
  return value;
}
