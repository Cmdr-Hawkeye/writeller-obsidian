import { tr } from '../i18n/translate';
import { fail } from '../domain/diagnostics';
import { sha256 } from '../exchange/hash';
import type { Collection } from '../domain/types';
import { isControlCharacter } from './characters';

/** Validates vault-relative, NFC paths before normalization; rejects portable filename hazards. */
export function safePath(value: string): string {
  if (!value || value !== value.normalize('NFC') || value.length > 900 || [...value].some(isControlCharacter) || /[\\:*?"<>|]/.test(value) || value.startsWith('/') || value.endsWith('/')) {
    fail('INVALID_FIELD', tr('Ungültiger vaultrelativer Pfad. Sichtbaren Ordner ohne Sonderzeichen wählen.'));
  }
  for (const segment of value.split('/')) {
    if (!segment || segment === '.' || segment === '..' || segment.startsWith('.') || /[. ]$/.test(segment) ||
      /^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[0-9¹²³]|lpt[0-9¹²³])[ .]*(?:\.|$)/i.test(segment)) fail('INVALID_FIELD', tr('Unsicherer oder reservierter Dateiname.'));
  }
  return value;
}
/** Portable collision key catches case-insensitive and canonically equivalent file names. */
export function collisionKey(path: string): string { return path.normalize('NFC').toLowerCase(); }
/** Returns whether a validated child resides below a validated folder. */
export function isBelow(path: string, folder: string): boolean { return collisionKey(path).startsWith(collisionKey(folder) + '/'); }
/** The project hash owns every sidecar, journal and asset location. */
export async function projectDataPath(folder: string, projectId: string): Promise<string> { return safePath(`${safePath(folder)}/${await sha256(projectId)}`); }
/** Includes collection and project ownership even when object ID strings are identical. */
export async function sidecarPath(root: string, collection: Collection, id: string): Promise<string> {
  return safePath(`${root}/records/${collection}/${await sha256(id)}.json`);
}
