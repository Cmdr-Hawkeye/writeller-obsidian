import type { Exchange, Ref, Collection } from '../domain/types';
import { entries, recordKey } from '../domain/records';
import { markdownInfo } from '../mapping/markdown';

export interface IncomingReference { collection: Collection; id: string; field: string }
/** Inventories typed inbound edges and real logical links before transfer or catalog-type changes. */
export function incomingReferences(pkg: Exchange, target: Ref): IncomingReference[] {
  const result: IncomingReference[] = [], key = recordKey(target.collection, target.id);
  for (const e of entries(pkg)) {
    const add = (field: string, ref: Ref | null): void => { if (ref && recordKey(ref.collection, ref.id) === key) result.push({ collection: e.collection, id: e.record.id, field }); };
    if ('chapterId' in e.record) {
      add('chapterId', e.record.chapterId ? { collection: 'chapters', id: e.record.chapterId } : null);
      add('parentSceneId', e.record.parentSceneId ? { collection: 'scenes', id: e.record.parentSceneId } : null);
      add('povCharacterId', e.record.povCharacterId ? { collection: 'catalogItems', id: e.record.povCharacterId } : null);
    }
    if ('relationshipType' in e.record) { add('source', e.record.source); add('target', e.record.target); }
    else if ('target' in e.record) add('target', e.record.target);
    if ('content' in e.record && e.record.content.format === 'markdown') for (const l of markdownInfo(e.record.content.text).links) {
      if (l.url === 'entity:' + key) result.push({ collection: e.collection, id: e.record.id, field: 'content.text' });
    }
  }
  return result;
}
