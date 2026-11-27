import type { Exchange, Ref } from '../domain/types';
import { entries, recordKey } from '../domain/records';
import { markdownInfo, replaceSpans, type LinkSpan } from '../mapping/markdown';

/** What a removal or reference repair changes; counts feed the confirmation dialog. */
export interface Detachment {
  /** Record keys removed from the package, including relationships that lost an endpoint. */
  removed: string[];
  /** Remaining record keys whose fields or text were adjusted. */
  changed: string[];
  pov: number; placement: number; targets: number; links: number;
}

const refKey = (ref: Ref | null): string | null => ref ? recordKey(ref.collection, ref.id) : null;
const entityKey = (url: string): string | null => /^entity:([A-Za-z]+\/[A-Za-z0-9][A-Za-z0-9._:-]*)$/.exec(url)?.[1] ?? null;

/** Keeps a Markdown link's visible label as plain text; only the link itself disappears. */
export function linkLabel(span: LinkSpan): string {
  const start = span.raw.startsWith('!') ? 1 : 0;
  let depth = 0;
  for (let i = start; i < span.raw.length; i++) {
    if (span.raw[i] === '\\') { i++; continue; }
    if (span.raw[i] === '[') depth++;
    if (span.raw[i] === ']' && --depth === 0) return span.raw.slice(start + 1, i);
  }
  return span.raw;
}

/** Lists every referenced record key that no longer exists in the package. */
export function missingTargets(pkg: Exchange): Set<string> {
  const keys = new Set(entries(pkg).map(e => recordKey(e.collection, e.record.id))), missing = new Set<string>();
  const check = (key: string | null): void => { if (key && !keys.has(key)) missing.add(key); };
  for (const s of pkg.scenes) {
    check(s.chapterId ? recordKey('chapters', s.chapterId) : null);
    check(s.parentSceneId ? recordKey('scenes', s.parentSceneId) : null);
    check(s.povCharacterId ? recordKey('catalogItems', s.povCharacterId) : null);
  }
  for (const r of pkg.relationships) { check(refKey(r.source)); check(refKey(r.target)); }
  for (const r of [...pkg.notes, ...pkg.researchItems]) check(refKey(r.target));
  for (const { record } of entries(pkg)) {
    if (!('content' in record) || record.content.format !== 'markdown') continue;
    for (const link of markdownInfo(record.content.text).links) check(entityKey(link.url));
  }
  return missing;
}

/** Scenes whose point of view refers to an existing object that is not a character. */
export function invalidPov(pkg: Exchange): string[] {
  return pkg.scenes.filter(s => s.povCharacterId && pkg.catalogItems.some(c => c.id === s.povCharacterId && c.type !== 'character')).map(s => s.id);
}

/**
 * Removes the given records and every reference to them, so the package stays valid:
 * relationships touching them go too, scene fields and note targets are cleared, and logical
 * links in text become their plain label. Points of view on non-characters are cleared as well.
 */
export function detachReferences(pkg: Exchange, targets: Iterable<string>): Detachment {
  const gone = new Set(targets), changed = new Set<string>(), result: Detachment = { removed: [], changed: [], pov: 0, placement: 0, targets: 0, links: 0 };
  for (const r of pkg.relationships) if (gone.has(refKey(r.source)!) || gone.has(refKey(r.target)!)) gone.add(recordKey('relationships', r.id));
  for (const collection of ['chapters', 'scenes', 'catalogItems', 'relationships', 'notes', 'researchItems'] as const) {
    const list = pkg[collection] as { id: string }[], kept = list.filter(r => !gone.has(recordKey(collection, r.id)));
    for (const r of list) if (!kept.includes(r)) result.removed.push(recordKey(collection, r.id));
    (pkg[collection] as { id: string }[]) = kept;
  }
  const characters = new Set(pkg.catalogItems.filter(c => c.type === 'character').map(c => c.id));
  for (const s of pkg.scenes) {
    const key = recordKey('scenes', s.id);
    if (s.chapterId && gone.has(recordKey('chapters', s.chapterId))) { s.chapterId = null; result.placement++; changed.add(key); }
    if (s.parentSceneId && gone.has(recordKey('scenes', s.parentSceneId))) { s.parentSceneId = null; result.placement++; changed.add(key); }
    if (s.povCharacterId && (gone.has(recordKey('catalogItems', s.povCharacterId)) || !characters.has(s.povCharacterId))) { s.povCharacterId = null; result.pov++; changed.add(key); }
  }
  for (const [collection, list] of [['notes', pkg.notes], ['researchItems', pkg.researchItems]] as const) {
    for (const r of list) if (r.target && gone.has(refKey(r.target)!)) { r.target = null; result.targets++; changed.add(recordKey(collection, r.id)); }
  }
  for (const { collection, record } of entries(pkg)) {
    if (!('content' in record) || record.content.format !== 'markdown') continue;
    const spans = markdownInfo(record.content.text).links.filter(l => !l.image && gone.has(entityKey(l.url) ?? ''));
    if (!spans.length) continue;
    record.content.text = replaceSpans(record.content.text, spans.map(l => ({ start: l.start, end: l.end, text: linkLabel(l) })));
    result.links += spans.length; changed.add(recordKey(collection, record.id));
  }
  result.changed = [...changed];
  return result;
}
