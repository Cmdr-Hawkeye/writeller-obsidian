import { fail } from '../domain/diagnostics';
import type { JsonValue, JsonObject } from '../domain/types';

export interface JsonLimits { bytes: number; depth: number; string: number; strings: number }
export const limits: JsonLimits = { bytes: 128 * 1024 ** 2, depth: 64, string: 8 * 1024 ** 2, strings: 25 * 1024 ** 2 };
/** Decodes strict UTF-8 and bounded JSON. Duplicate keys, invalid scalars and unsafe integers fail. */
export function parseJson(input: Uint8Array | string, budget: JsonLimits = limits): JsonValue {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (bytes.byteLength > budget.bytes) fail('LIMIT_EXCEEDED', 'JSON-Datei überschreitet das Bytebudget.');
  let text: string;
  try { text = typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail('INVALID_JSON', 'Ungültiges UTF-8.'); }
  return new JsonReader(text.replace(/^\uFEFF/, ''), budget).read();
}
/** Own-key JSON object guard shared by schema and portable-state boundaries. */
export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
class JsonReader {
  private pos = 0;
  private stringBytes = 0;
  /** Creates a reader over decoded text; it performs no external reads. */
  constructor(private readonly text: string, private readonly budget: JsonLimits) {}
  /** Parses exactly one value; trailing non-whitespace is invalid. */
  read(): JsonValue {
    const result = this.value(0, '');
    this.space();
    if (this.pos !== this.text.length) this.invalid();
    return result;
  }
  /** Reads a JSON value while tracking container depth and location for image budgets. */
  private value(depth: number, pointer: string): JsonValue {
    this.space();
    const c = this.text[this.pos];
    if (c === '{' || c === '[') {
      if (depth + 1 > this.budget.depth) fail('LIMIT_EXCEEDED', 'JSON überschreitet das Tiefenbudget.', pointer);
      return c === '{' ? this.object(depth + 1, pointer) : this.array(depth + 1, pointer);
    }
    if (c === '"') return this.string(pointer, false);
    for (const [token, result] of [['true', true], ['false', false], ['null', null]] as const) {
      if (this.text.startsWith(token, this.pos)) { this.pos += token.length; return result; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.pos));
    if (!match) this.invalid();
    this.pos += match[0].length;
    const number = Number(match[0]);
    if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) {
      fail('INVALID_FIELD', 'Zahl ist nicht sicher als Binary64 darstellbar.', pointer);
    }
    return number;
  }
  /** Defines data properties explicitly; __proto__ never mutates an object prototype. */
  private object(depth: number, pointer: string): JsonObject {
    this.pos++;
    const result: JsonObject = Object.create(null) as JsonObject;
    this.space();
    if (this.take('}')) return result;
    while (true) {
      this.space();
      const key = this.string(pointer, true);
      if (Object.hasOwn(result, key)) fail('INVALID_JSON', 'Doppelter JSON-Schlüssel.', pointer);
      this.space();
      if (!this.take(':')) this.invalid();
      result[key] = this.value(depth, `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`);
      this.space();
      if (this.take('}')) return result;
      if (!this.take(',')) this.invalid();
    }
  }
  /** Reads arrays without holes or trailing commas; array order is retained. */
  private array(depth: number, pointer: string): JsonValue[] {
    this.pos++;
    const result: JsonValue[] = [];
    this.space();
    if (this.take(']')) return result;
    while (true) {
      result.push(this.value(depth, `${pointer}/${result.length}`));
      this.space();
      if (this.take(']')) return result;
      if (!this.take(',')) this.invalid();
    }
  }
  /** Delegates escape decoding to JSON.parse after finding the exact string token. */
  private string(pointer: string, key: boolean): string {
    if (!this.take('"')) this.invalid();
    const start = this.pos - 1;
    let escaped = false;
    while (this.pos < this.text.length) {
      const c = this.text[this.pos++];
      if (c === '"' && !escaped) {
        let result: unknown;
        try { result = JSON.parse(this.text.slice(start, this.pos)); } catch { this.invalid(); }
        if (typeof result !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(result)) this.invalid();
        const count = new TextEncoder().encode(result).length;
        if (key || !/^\/attachments\/\d+\/data$/.test(pointer)) {
          if (count > this.budget.string) fail('LIMIT_EXCEEDED', 'Einzelstring überschreitet das Budget.', pointer);
          if (!key) this.stringBytes += count;
          if (this.stringBytes > this.budget.strings) fail('LIMIT_EXCEEDED', 'JSON-Stringbudget überschritten.');
        }
        return result;
      }
      escaped = c === '\\' && !escaped;
    }
    return this.invalid();
  }
  /** Advances over only the four whitespace characters allowed by JSON. */
  private space(): void { while ([' ', '\t', '\n', '\r'].includes(this.text[this.pos] ?? '')) this.pos++; }
  /** Consumes one expected delimiter and reports whether it was present. */
  private take(c: string): boolean {
    if (this.text[this.pos] !== c) return false;
    this.pos++; return true;
  }
  /** Emits a content-free syntax error without echoing private input. */
  private invalid(): never { return fail('INVALID_JSON', 'Ungültige JSON-Syntax oder Unicode-Zeichen.'); }
}
