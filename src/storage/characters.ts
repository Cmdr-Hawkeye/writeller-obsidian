/** Tests portable filename controls by code point, keeping control bytes out of regular expressions. */
export function isControlCharacter(character: string): boolean { const code = character.charCodeAt(0); return code < 32 || code === 127; }
/** Replaces each portable filename hazard without touching ordinary Unicode text. */
export function replaceNameCharacters(value: string, replacement: string): string {
  return [...value].map(character => isControlCharacter(character) || '\\/:*?"<>|'.includes(character) ? replacement : character).join('');
}
