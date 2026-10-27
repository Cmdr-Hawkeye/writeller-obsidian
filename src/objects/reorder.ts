import type { Entry, Exchange } from '../domain/types';
import { compareOrder } from '../domain/order';

/** Moves one chapter or sibling scene one position; IDs and scene ownership stay unchanged. */
export function moveInManuscript(pkg: Exchange, entry: Entry, direction: -1 | 1): boolean {
  const list = entry.collection === 'chapters' ? [...pkg.chapters] : entry.collection === 'scenes' ? pkg.scenes.filter(s =>
    s.chapterId === entry.record.chapterId && s.parentSceneId === entry.record.parentSceneId) : [];
  list.sort(compareOrder);
  const from = list.findIndex(r => r.id === entry.record.id), to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return false;
  const selected = list[from]!; list[from] = list[to]!; list[to] = selected;
  // Historical fractional indices are changed only by the user's explicit reorder action.
  list.forEach((r, index) => { r.orderIndex = index; });
  return true;
}
