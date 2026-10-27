export type Code = 'INVALID_JSON' | 'LIMIT_EXCEEDED' | 'INVALID_FIELD' | 'UNSUPPORTED_VERSION'
  | 'PROJECT_MISMATCH' | 'DUPLICATE_ID' | 'MISSING_REFERENCE' | 'HIERARCHY_CYCLE' | 'INVALID_ASSET'
  | 'IDENTITY_CONFLICT' | 'CONTENT_CONFLICT' | 'LOCAL_CHANGED' | 'STATE_MISSING'
  | 'UNSUPPORTED_REPRESENTATION' | 'ANNOTATIONS_NEED_REVIEW';
export interface Diagnostic { code: Code; severity: 'error' | 'warning'; pointer: string; message: string }
/** A content-free error with machine-readable diagnostics for local UI display. */
export class ExchangeError extends Error {
  /** Accepts safe diagnostics; callers must not pass manuscript text or OS paths. */
  constructor(readonly diagnostics: Diagnostic[]) {
    super(diagnostics.map(d => `${d.code}: ${d.message}`).join('\n'));
    this.name = 'ExchangeError';
  }
}
/** Stops an unsafe operation; the pointer identifies data rather than a physical path. */
export function fail(code: Code, message: string, pointer = ''): never {
  throw new ExchangeError([{ code, severity: 'error', pointer, message }]);
}
/** Creates a presentation warning without granting permission to write. */
export function warning(code: Code, message: string, pointer = ''): Diagnostic {
  return { code, severity: 'warning', pointer, message };
}
