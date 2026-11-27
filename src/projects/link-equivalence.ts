import { markdownInfo, replaceSpans, linkWithUrl } from '../mapping/markdown';

/** Blanks parsed link destinations and wikilink targets; labels, aliases and all other text remain. */
function withoutLinkTargets(source: string): string {
  const info = markdownInfo(source), spans: { start: number; end: number; text: string }[] = [];
  for (const span of info.links) spans.push({ start: span.start, end: span.end, text: linkWithUrl(span, '') });
  for (const span of info.wikiLinks) {
    const raw = source.slice(span.start, span.end), start = raw.indexOf('[[') + 2;
    spans.push({ start: span.start, end: span.end, text: raw.slice(0, start) + raw.slice(start + span.target.length) });
  }
  return replaceSpans(source, spans);
}

/**
 * True when two note texts differ at most in link targets. Obsidian rewrites links on its own when
 * folders are renamed (for example to the shortest path); such a rewrite is not an author edit.
 */
export function sameExceptLinkTargets(a: string, b: string): boolean {
  return a === b || withoutLinkTargets(a) === withoutLinkTargets(b);
}
