import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes, Root } from 'mdast';

export interface LinkSpan { start: number; end: number; url: string; image: boolean; raw: string; standalone?: boolean }
export interface WikiSpan { start: number; end: number; target: string; label: string; image: boolean }
export interface MarkdownInfo { links: LinkSpan[]; wikiLinks: WikiSpan[]; html: boolean; extensionSyntax: boolean }
/** Parses actual CommonMark nodes with UTF-16 source ranges, leaving code examples untouched. */
export function markdownInfo(source: string): MarkdownInfo {
  const tree = fromMarkdown(maskLayoutWrappers(source));
  const result: MarkdownInfo = { links: [], wikiLinks: [], html: false, extensionSyntax: /\[\[|^\s*\|.*\||^>\s*\[!|\[\^/m.test(source) };
  const definitions = new Map<string, { url: string }>();
  visit(tree, node => { if (node.type === 'definition') definitions.set(node.identifier, node); });
  visit(tree, (node, parent) => {
    if (node.type === 'html') result.html = true;
    if (node.type === 'text' && node.position?.start.offset !== undefined && node.position.end.offset !== undefined) {
      const offset = node.position.start.offset, raw = source.slice(offset, node.position.end.offset);
      for (const match of raw.matchAll(/(!?)\[\[([^\]\r\n]+)\]\]/g)) {
        const slashes = /\\*$/.exec(raw.slice(0, match.index))?.[0].length ?? 0;
        if (slashes % 2) continue;
        const [target = '', label] = (match[2] ?? '').split('|');
        result.wikiLinks.push({ start: offset + match.index, end: offset + match.index + match[0].length,
          target, label: label ?? target.split('/').at(-1) ?? target, image: match[1] === '!' });
      }
    }
    if (node.type !== 'link' && node.type !== 'image' && node.type !== 'linkReference' && node.type !== 'imageReference') return;
    const url = 'url' in node ? node.url : definitions.get(node.identifier)?.url;
    const start = node.position?.start.offset, end = node.position?.end.offset;
    if (url === undefined || start === undefined || end === undefined) return;
    result.links.push({ start, end, url, image: node.type === 'image' || node.type === 'imageReference', raw: source.slice(start, end),
      standalone: parent?.type === 'paragraph' && parent.children.every(c => c === node || c.type === 'text' && !c.value.trim()) });
  });
  result.wikiLinks = result.wikiLinks.filter(w => !result.links.some(l => w.start >= l.start && w.end <= l.end));
  return result;
}
/** Masks the contract's non-nested alignment wrappers while retaining every source offset. */
function maskLayoutWrappers(source: string): string {
  const tags = [...source.matchAll(/^<div align="(?:left|center|right|justify)">\r?$|^<\/div>\r?$/gm)];
  let open = false;
  for (const tag of tags) {
    const closing = tag[0].startsWith('</');
    if (closing === !open) return source;
    open = !closing;
  }
  if (open) return source;
  return source.replace(/^<div align="(?:left|center|right|justify)">\r?$|^<\/div>\r?$/gm, tag => tag.replace(/[^\r\n]/g, ' '));
}
/** Walks only AST children; no HTML or image rendering is involved. */
function visit(root: Root | Nodes, fn: (node: Nodes, parent: Nodes | null) => void, parent: Nodes | null = null): void {
  fn(root, parent);
  if ('children' in root) for (const child of root.children) visit(child, fn, root);
}
/** Replaces disjoint node ranges from the end so untouched whitespace and CRLF survive. */
export function replaceSpans(source: string, spans: { start: number; end: number; text: string }[]): string {
  let result = source;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) result = result.slice(0, span.start) + span.text + result.slice(span.end);
  return result;
}
/** Keeps a link's label exactly; reference-style nodes become explicit links only when mapped. */
export function linkWithUrl(span: LinkSpan, url: string): string {
  const bracket = span.raw.startsWith('!') ? 1 : 0;
  let depth = 0, end = -1;
  for (let i = bracket; i < span.raw.length; i++) {
    if (span.raw[i] === '\\') { i++; continue; }
    if (span.raw[i] === '[') depth++;
    if (span.raw[i] === ']' && --depth === 0) { end = i; break; }
  }
  return `${span.raw.slice(0, end + 1)}(<${url}>)`;
}
