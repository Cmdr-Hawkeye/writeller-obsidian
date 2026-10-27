import { parseJson, type JsonLimits } from '../exchange/parser';
import type { JsonValue } from '../domain/types';

// Local wrappers repeat received records and add depth; exchange limits must not be
// incorrectly applied to those copies. Bounds still prevent unbounded mobile allocation.
export const localJsonLimits: JsonLimits = { bytes: 512 * 1024 ** 2, depth: 72, string: 32 * 1024 ** 2, strings: 256 * 1024 ** 2 };
/** Parses portable state with explicit larger local budgets; never relaxes public Exchange validation. */
export function parseLocalJson(input: string | Uint8Array): JsonValue { return parseJson(input, localJsonLimits); }
