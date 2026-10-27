import type { Exchange, Scene } from './types';

/** Numeric order with ASCII-ID tie breaking; never mutates persisted fractional indices. */
export function compareOrder(a: { orderIndex: number; id: string }, b: { orderIndex: number; id: string }): number {
  return a.orderIndex - b.orderIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
/** Produces iterative parent-first manuscript order, with chapterless scenes last. */
export function manuscriptOrder(pkg: Exchange): Scene[] {
  const result: Scene[] = [];
  const children = new Map<string | null, Scene[]>();
  for (const s of pkg.scenes) {
    const siblings = children.get(s.parentSceneId) ?? []; siblings.push(s); children.set(s.parentSceneId, siblings);
  }
  for (const list of children.values()) list.sort(compareOrder);
  const chapterIds: (string | null)[] = [...pkg.chapters].sort(compareOrder).map(c => c.id);
  chapterIds.push(null);
  for (const chapterId of chapterIds) {
    const stack = [...children.get(null) ?? []].filter(s => s.chapterId === chapterId).reverse();
    while (stack.length) {
      const scene = stack.pop()!; result.push(scene);
      stack.push(...[...children.get(scene.id) ?? []].reverse());
    }
  }
  return result;
}
