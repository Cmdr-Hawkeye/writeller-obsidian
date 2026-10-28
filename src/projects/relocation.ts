import type { VaultPort } from '../storage/vault-port';
import { isBelow } from '../storage/paths';
import { markdownInfo, replaceSpans, linkWithUrl } from '../mapping/markdown';
export interface FolderMove { from: string; to: string }
/** Maps whole folder prefixes only; no file basename or arbitrary text is translated. */
export function relocate(path: string, moves: FolderMove[]): string {
  for (const move of moves) if (path === move.from || isBelow(path, move.from)) path = move.to + path.slice(move.from.length);
  return path;
}
/** Enumerates real empty folders where available and infers parents for portable test adapters. */
export function visibleFolders(vault: VaultPort): string[] {
  const folders = new Set(vault.folders?.() ?? []);
  for (const file of vault.files()) for (let at = file.path.indexOf('/'); at >= 0; at = file.path.indexOf('/', at + 1)) folders.add(file.path.slice(0, at));
  return [...folders].sort();
}
/** Rewrites parsed local link targets only, preserving labels, code examples and ordinary prose. */
export function relocateLinks(body: string, moves: FolderMove[]): string {
  const info = markdownInfo(body), spans: { start: number; end: number; text: string }[] = [];
  for (const span of info.links) {
    let decoded: string; try { decoded = decodeURIComponent(span.url); } catch { continue; }
    const next = relocate(decoded, moves); if (next === decoded) continue;
    spans.push({ start: span.start, end: span.end, text: linkWithUrl(span, next.split('/').map(encodeURIComponent).join('/')) });
  }
  for (const span of info.wikiLinks) {
    const next = relocate(span.target, moves); if (next === span.target) continue;
    const raw = body.slice(span.start, span.end), start = raw.indexOf('[[') + 2;
    spans.push({ start: span.start, end: span.end, text: raw.slice(0, start) + next + raw.slice(start + span.target.length) });
  }
  return replaceSpans(body, spans);
}
