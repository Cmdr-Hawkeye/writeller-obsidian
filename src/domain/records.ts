import { collections, type Collection, type Entry, type Exchange, type ExchangeRecord } from './types';

/** Enumerates a validated snapshot in a fixed order; never uses folder ownership. */
export function entries(p: Exchange): Entry[] {
  return [{ collection: 'project', record: p.project }, ...collections.filter(c => c !== 'project')
    .flatMap(c => p[c].map(record => ({ collection: c, record }) as Entry))];
}
/** Produces a collision-free key for logical identities inside one project. */
export function recordKey(collection: Collection, id: string): string { return `${collection}/${id}`; }
/** Includes project ownership for indexes that span multiple projects. */
export function identityKey(projectId: string, collection: Collection, id: string): string {
  return `${projectId}/${recordKey(collection, id)}`;
}
/** Returns a user label while leaving the filename unrelated to identity. */
export function title(record: ExchangeRecord): string {
  return 'name' in record ? record.name : 'title' in record ? record.title : record.label ?? record.relationshipType;
}
/** Deep-copies validated JSON data, preserving even __proto__ as an own data key. */
export function clone<T>(value: T): T { return structuredClone(value); }
/** Replaces an entry in a validated package without untyped recursive merges. */
export function setEntry(p: Exchange, entry: Entry): void {
  if (entry.collection === 'project') { p.project = entry.record; return; }
  const list: ExchangeRecord[] = p[entry.collection];
  const index = list.findIndex(r => r.id === entry.record.id);
  if (index < 0) list.push(entry.record); else list[index] = entry.record;
}
