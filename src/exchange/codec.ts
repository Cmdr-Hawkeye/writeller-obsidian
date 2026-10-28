import { tr } from '../i18n/translate';
import type { Exchange } from '../domain/types';
import { parseJson } from './parser';
import { assertSchema } from './schema';
import { assertSemantics } from './semantics';
import { assertImages } from './images';
import { jcs, sha256 } from './hash';
import { fail } from '../domain/diagnostics';

/** Validates a full envelope from unknown JSON, including graph and image bytes. */
export async function validateExchange(value: unknown): Promise<Exchange> {
  // Serialization reuses the same scalar, size and nesting checks for programmatic input.
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value, (_key: string, field: unknown) => {
      if (field === undefined || typeof field === 'bigint' || typeof field === 'function' || typeof field === 'symbol' || typeof field === 'number' && !Number.isFinite(field)) fail('INVALID_FIELD', tr('Wert ist kein endlicher JSON-Datentyp.'));
      return field;
    });
  } catch { fail('INVALID_FIELD', tr('Wert ist kein vollständiger JSON-Baum.')); }
  if (serialized === undefined) fail('INVALID_FIELD', tr('JSON-Objekt fehlt.'));
  const parsed = parseJson(serialized);
  assertSchema(parsed); assertSemantics(parsed); await assertImages(parsed.attachments);
  return parsed;
}
/** Reads bytes completely before returning a package; no writes occur in this layer. */
export async function readExchange(bytes: Uint8Array | string): Promise<Exchange> {
  const value = parseJson(bytes);
  assertSchema(value); assertSemantics(value); await assertImages(value.attachments);
  return value;
}
/** Writes every explicit nullable field after validation; emits UTF-8 JSON without BOM. */
export async function writeExchange(value: Exchange): Promise<string> {
  await validateExchange(value);
  return JSON.stringify(value, null, 2) + '\n';
}
/** Package identity covers the complete envelope, including export time and bases. */
export function packageHash(value: Exchange): Promise<string> { return sha256(jcs(value)); }
