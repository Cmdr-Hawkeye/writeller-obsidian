import { tr } from '../i18n/translate';
import type { Exchange, ExchangeRecord, Collection } from '../domain/types';
import { ExchangeError, fail } from '../domain/diagnostics';
import { isObject } from './parser';
import { validateExchange, validateProject, validateChapter, validateScene, validateCatalog, validateRelationship, validateNote, validateResearch } from '#writeller-validators';

export { isInstant } from './instant.mjs';
const records = { project: validateProject, chapters: validateChapter, scenes: validateScene, catalogItems: validateCatalog,
  relationships: validateRelationship, notes: validateNote, researchItems: validateResearch };

/** Uses static generated validators; no schema compilation, dynamic code or remote resolution occurs. */
export function assertSchema(value: unknown): asserts value is Exchange {
  if (isObject(value) && value['format'] === 'writeller.project.v5') {
    fail('UNSUPPORTED_VERSION', tr('Dieses Projektarchiv benötigt den Writeller-Exchange-Export. Das Archiv wurde nicht verändert.'));
  }
  if (isObject(value) && value['format'] === 'writeller.exchange' && value['version'] !== '1.0.0') {
    fail('UNSUPPORTED_VERSION', tr('Nur Writeller Exchange 1.0.0 wird unterstützt.'));
  }
  if (!validateExchange(value)) throw new ExchangeError((validateExchange.errors ?? []).slice(0, 100).map(e => ({
    code: 'INVALID_FIELD', severity: 'error', pointer: e.instancePath,
    message: tr`Feldprüfung fehlgeschlagen (${e.keyword}). Pflichtfelder und Datentypen prüfen.`
  })));
}
/** Validates one complete record before graph validation without retaining an Ajv compiler instance. */
export function assertRecord(value: unknown, collection: Collection): asserts value is ExchangeRecord {
  if (!records[collection](value)) fail('INVALID_FIELD', tr('Datensatz entspricht nicht dem Austauschschema.'));
}
