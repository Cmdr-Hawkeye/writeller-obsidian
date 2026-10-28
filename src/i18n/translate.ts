import core from './en-core.json';
import ui from './en-ui.json';
import { language } from './language';

const english: Readonly<Record<string, string>> = { ...core, ...ui };
/** Resolves a static source label; tagged interpolation keeps user text out of translation lookup. */
export function tr(source: string | TemplateStringsArray, ...values: unknown[]): string {
  const key = typeof source === 'string' ? source : source.reduce((text, part, i) => text + (i ? `{${i - 1}}` : '') + part, '');
  const translated = language() === 'en' ? english[key] ?? key : key;
  return translated.replace(/\{(\d+)\}/g, (placeholder: string, index: string) => Number(index) < values.length ? String(values[Number(index)]) : placeholder);
}
