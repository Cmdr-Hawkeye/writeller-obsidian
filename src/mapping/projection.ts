import { tr } from '../i18n/translate';
import { clone } from '../domain/records';
import type { Entry, ExchangeRecord } from '../domain/types';
import { fail, warning, type Diagnostic } from '../domain/diagnostics';
import { holdAnnotations } from './annotations';
import type { Projection, ProjectionLink } from '../storage/state-types';
import { markdownInfo, replaceSpans, linkWithUrl } from './markdown';

export interface ProjectionContext {
  entityPath(key: string): string | undefined;
  assetPath(hash: string): string | undefined;
  entityLabel?(key: string): string | undefined;
}
export interface ReverseContext {
  entityUrl(link: string): string | null;
  assetHash(link: string): string | null;
}
/** Selects the one canonical body field; relationship bodies are generated views only. */
export function recordBody(record: ExchangeRecord): string {
  if ('content' in record) return record.content.text;
  if ('summary' in record) return record.summary;
  if ('description' in record && 'title' in record) return record.description;
  if ('relationshipType' in record) return tr`${record.relationshipType}\n\n${record.description ?? ''}\n\nDiese Verbindung bearbeitest du über „Details bearbeiten“.`;
  return '';
}
/** Safely projects semantic links while preserving every untouched character and original content. */
export function projectRecord(entry: Entry, context: ProjectionContext): { projection: Projection; warnings: Diagnostic[] } {
  const body = entry.collection === 'relationships' ? relationshipBody(entry.record, context) : recordBody(entry.record), info = markdownInfo(body), warnings: Diagnostic[] = [];
  const semantic = 'content' in entry.record && entry.record.content.format === 'markdown';
  if (info.html || info.links.some(l => l.image && !l.url.startsWith('asset:') || /^(?:javascript|vbscript|data):/i.test(l.url))) {
    // Obsidian can load remote embeds from Markdown, so expose source inside an inert fence.
    const fence = '`'.repeat(Math.max(3, ...Array.from(body.matchAll(/`+/g), m => m[0].length + 1)));
    warnings.push(warning('UNSUPPORTED_REPRESENTATION', tr('HTML oder externes Bild als nicht ladender Quelltext dargestellt. Original bleibt erhalten.')));
    return { projection: { body: `${fence}text\n${body}\n${fence}`, protected: true, links: [] }, warnings };
  }
  if (info.extensionSyntax) warnings.push(warning('UNSUPPORTED_REPRESENTATION', tr('Obsidian-Erweiterungssyntax bleibt als Quelltext erhalten; Darstellung kann abweichen.')));
  const links: ProjectionLink[] = [], replacements: { start: number; end: number; text: string }[] = [];
  if (semantic) for (const span of info.links) {
    const key = span.url.startsWith('entity:') ? span.url.slice(7) : null;
    const hash = span.url.startsWith('asset:') ? span.url.slice(6, 70) : null;
    const path = key ? context.entityPath(key) : hash ? context.assetPath(hash) : undefined;
    if (!key && !hash) continue;
    if (!path) fail('MISSING_REFERENCE', tr('Projektion kann ein Ziel nicht auflösen.'));
    links.push({ localPath: path, originalUrl: span.url, image: span.image });
    replacements.push({ start: span.start, end: span.end, text: linkWithUrl(span, path.split('/').map(encodeURIComponent).join('/')) });
  }
  return { projection: { body: replaceSpans(body, replacements), links, protected: false }, warnings };
}
/** Gives relationship Markdown readable endpoint labels; IDs stay solely in metadata/sidecars. */
function relationshipBody(record: Extract<Entry, { collection: 'relationships' }>['record'], context: ProjectionContext): string {
  const endpoint = (ref: typeof record.source, fallback: string): string => {
    const key = `${ref.collection}/${ref.id}`, path = context.entityPath(key), label = (context.entityLabel?.(key) ?? fallback).replace(/[\\[\]]/g, '\\$&');
    return path ? `[${label}](<${path.split('/').map(encodeURIComponent).join('/')}>)` : label;
  };
  return tr`${endpoint(record.source, tr('Quellnotiz'))} ${record.direction === 'directed' ? '→' : '↔'} ${endpoint(record.target, tr('Zielnotiz'))}\n\n${record.relationshipType}${record.description ? '\n\n' + record.description : ''}\n\nDiese Verbindung bearbeitest du über „Details bearbeiten“.`;
}
/** Reconstructs changed content conservatively; unchanged projections return exact original text. */
export async function reverseBody(record: ExchangeRecord, body: string, projection: Projection | null, context: ReverseContext): Promise<{ record: ExchangeRecord; warnings: Diagnostic[] }> {
  const result = clone(record), warnings: Diagnostic[] = [];
  if (body === projection?.body) return { record: result, warnings };
  if (projection?.protected) fail('UNSUPPORTED_REPRESENTATION', tr('Geschützte Quelltextprojektion wurde bearbeitet. Vollständigen Inhalt im JSON-Eigenschaften-Editor ausdrücklich zuordnen.'));
  if ('relationshipType' in result) fail('UNSUPPORTED_REPRESENTATION', tr('Beziehungskörper ist nur eine Ansicht. Änderungen über Eigenschaften zuordnen oder erzeugte Ansicht wiederherstellen.'));
  let content = body;
  if ('content' in result && result.content.format === 'markdown') content = reverseMarkdown(body, projection, context);
  if ('content' in result) result.content.text = content;
  else if ('summary' in result) result.summary = content;
  else if ('title' in result && 'description' in result) result.description = content;
  if ('parentSceneId' in result && 'content' in record && content !== record.content.text && Object.hasOwn(result.metadata, 'annotations')) {
    warnings.push(...await holdAnnotations(result, record.content.text));
  }
  return { record: result, warnings };
}
/** Maps current link destinations through identities; ambiguous image occurrence layouts block. */
function reverseMarkdown(body: string, projection: Projection | null, context: ReverseContext): string {
  const replacements: { start: number; end: number; text: string }[] = [];
  const info = markdownInfo(body);
  const wiki = info.wikiLinks.map(w => ({ start: w.start, end: w.end, url: w.target, image: w.image,
    raw: `${w.image ? '!' : ''}[${w.label.replace(/[\\[\]]/g, '\\$&')}]()` }));
  for (const span of [...info.links, ...wiki]) {
    if (/^(?:entity:|asset:|https?:|mailto:|#)/i.test(span.url)) continue;
    if (span.url.includes('#') || span.url.includes('^')) fail('UNSUPPORTED_REPRESENTATION', tr('Block- und Überschriftenziele ausdrücklich in logische Links umwandeln.'));
    if (span.image) {
      const hash = context.assetHash(span.url);
      if (!hash) fail('UNSUPPORTED_REPRESENTATION', tr('Lokales Bild zuerst bewusst als geprüftes Asset aufnehmen.'));
      const matches = projection?.links.filter(l => l.image && l.originalUrl.startsWith('asset:' + hash)) ?? [];
      const layouts = new Set(matches.map(l => l.originalUrl.slice(70)));
      if (layouts.size !== 1) fail('UNSUPPORTED_REPRESENTATION', tr('Bildlayout je Vorkommen ist nicht eindeutig. Im JSON-Editor jedes asset:-Vorkommen mit width und align zuordnen.'));
      replacements.push({ start: span.start, end: span.end, text: linkWithUrl(span, `asset:${hash}${[...layouts][0]}`) });
    } else {
      const target = context.entityUrl(span.url);
      if (!target) fail('UNSUPPORTED_REPRESENTATION', tr('Lokaler Link ist unverwaltet oder gehört zu einem fremden Projekt. Ziel ausdrücklich zuordnen oder als Klartext erhalten.'));
      replacements.push({ start: span.start, end: span.end, text: linkWithUrl(span, target) });
    }
  }
  return replaceSpans(body, replacements);
}
