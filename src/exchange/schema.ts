import Ajv2020 from 'ajv/dist/2020';
import schema from './writeller-exchange.schema.json';
import type { Exchange, ExchangeRecord, Collection } from '../domain/types';
import { ExchangeError, fail } from '../domain/diagnostics';
import { isObject } from './parser';

/** Calendar validator avoids Date coercion and preserves six fractional digits. */
export function isInstant(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{6}Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (!year || !month || !day || hour === undefined || minute === undefined || second === undefined) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day <= days && hour < 24 && minute < 60 && second < 60;
}
const ajv = new Ajv2020({ allErrors: false, strict: true, ownProperties: true, validateFormats: true });
ajv.addFormat('date-time', { type: 'string', validate: isInstant });
// The supplied schema stays byte-identical. Its repeated Base64 quartet regex can
// exhaust V8's regexp stack on valid large images. A linear character/padding filter
// precedes the stricter length, pad-bit and decoding checks in images.ts.
const localSchema = structuredClone(schema);
localSchema.$defs.attachment.properties.data.pattern = '^[A-Za-z0-9+/]*={0,2}$';
const validate = ajv.compile<Exchange>(localSchema);
const definitions = { project: 'project', chapters: 'chapter', scenes: 'scene', catalogItems: 'catalogItem',
  relationships: 'relationship', notes: 'note', researchItems: 'researchItem' } as const;

/** Validates exact version before core fields. No remote schema resolution or coercion occurs. */
export function assertSchema(value: unknown): asserts value is Exchange {
  if (isObject(value) && value['format'] === 'writeller.project.v5') {
    fail('UNSUPPORTED_VERSION', 'Dieses Projektarchiv benötigt den Writeller-Exchange-Export. Das Archiv wurde nicht verändert.');
  }
  if (isObject(value) && value['format'] === 'writeller.exchange' && value['version'] !== '1.0.0') {
    fail('UNSUPPORTED_VERSION', 'Nur Writeller Exchange 1.0.0 wird unterstützt.');
  }
  if (!validate(value)) throw new ExchangeError((validate.errors ?? []).slice(0, 100).map(e => ({
    code: 'INVALID_FIELD', severity: 'error', pointer: e.instancePath,
    message: `Feldprüfung fehlgeschlagen (${e.keyword}). Pflichtfelder und Datentypen prüfen.`
  })));
}
/** Validates one fully specified record for the JSON editor; graph validation follows separately. */
export function assertRecord(value: unknown, collection: Collection): asserts value is ExchangeRecord {
  const validator = ajv.getSchema(`${schema.$id}#/$defs/${definitions[collection]}`);
  if (!validator?.(value)) fail('INVALID_FIELD', 'Datensatz entspricht nicht dem Austauschschema.');
}
