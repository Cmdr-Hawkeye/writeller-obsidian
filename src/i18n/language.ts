export type Language = 'de' | 'en';
export type LanguagePreference = 'auto' | Language;
let current: Language = 'de';
/** Resolves the host's ISO code; every non-German language deliberately uses English. */
export function resolveLanguage(preference: LanguagePreference, hostLanguage: string): Language {
  return preference === 'auto' ? hostLanguage.toLowerCase().split(/[-_]/)[0] === 'de' ? 'de' : 'en' : preference;
}
/** Updates presentation language only; callers coordinate any persisted folder changes separately. */
export function setLanguage(language: Language): void { current = language; }
/** Pure accessor shared by UI labels and newly allocated project structure paths. */
export function language(): Language { return current; }
