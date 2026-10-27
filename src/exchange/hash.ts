import canonicalize from 'canonicalize';
import type { ExchangeRecord } from '../domain/types';
import { fail } from '../domain/diagnostics';

/** RFC 8785 serialization of validated JSON; rejects non-JSON rather than dropping it. */
export function jcs(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) fail('INVALID_FIELD', 'Kein kanonisierbarer JSON-Wert.');
  return result;
}
/** Web Crypto SHA-256; fails closed when the host lacks secure cryptographic APIs. */
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
/** Hashes only domain fields; nested fields with excluded names remain significant. */
export async function recordHash(record: ExchangeRecord): Promise<string> {
  const fields = Object.fromEntries(Object.entries(record).filter(([k]) => !['baseHash', 'createdAt', 'updatedAt'].includes(k)));
  return sha256(jcs(fields));
}
/** Generates an opaque UUID v4 without device identifiers or weak random fallbacks. */
export function newId(): string { return globalThis.crypto.randomUUID(); }
/** Creates UTC microsecond-shaped timestamps; imported timestamps never pass through Date. */
export function now(): string { return new Date().toISOString().replace(/(\.\d{3})Z$/, '$1000Z'); }
