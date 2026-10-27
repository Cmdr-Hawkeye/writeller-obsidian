import type { Entry, Exchange, Ref } from '../domain/types';
import { clone, entries, recordKey, setEntry } from '../domain/records';
import { newId, now } from '../exchange/hash';
import { markdownInfo, replaceSpans, linkWithUrl } from '../mapping/markdown';
import { fail, warning, type Diagnostic } from '../domain/diagnostics';
import { incomingReferences } from '../objects/references';
import { pluginVersion } from '../domain/version';

/** Creates a fully independent identity graph, rewriting only typed references and actual entity links. */
export function forkProject(original: Exchange, instanceId: string): { exchange: Exchange; warnings: Diagnostic[] } {
  const result = clone(original), projectId = newId(), ids = new Map<string, string>();
  for (const e of entries(original)) ids.set(recordKey(e.collection, e.record.id), e.collection === 'project' ? projectId : newId());
  const ref = (r: Ref | null): Ref | null => r ? { collection: r.collection, id: ids.get(recordKey(r.collection, r.id))! } : null;
  for (const e of entries(result)) {
    const oldId = e.record.id, id = ids.get(recordKey(e.collection, oldId))!;
    e.record.id = id; e.record.origin = { system: 'obsidian', instanceId, objectId: id }; e.record.baseHash = null;
    if ('projectId' in e.record) e.record.projectId = projectId;
    if ('chapterId' in e.record) {
      if (e.record.chapterId) e.record.chapterId = ids.get('chapters/' + e.record.chapterId)!;
      if (e.record.parentSceneId) e.record.parentSceneId = ids.get('scenes/' + e.record.parentSceneId)!;
      if (e.record.povCharacterId) e.record.povCharacterId = ids.get('catalogItems/' + e.record.povCharacterId)!;
    }
    if ('relationshipType' in e.record) { e.record.source = ref(e.record.source)!; e.record.target = ref(e.record.target)!; }
    else if ('target' in e.record) e.record.target = ref(e.record.target);
    if ('content' in e.record && e.record.content.format === 'markdown') {
      const content = e.record.content;
      content.text = replaceSpans(content.text, markdownInfo(content.text).links.filter(l => l.url.startsWith('entity:')).map(l => ({
        start: l.start, end: l.end, text: linkWithUrl(l, 'entity:' + l.url.slice(7).split('/')[0] + '/' + ids.get(l.url.slice(7)))
      })));
    }
  }
  // Mutated records already occupy their array slots; no string substitutions touch opaque JSON.
  result.project.extensions['org.writeller.fork'] = { projectId: original.project.id };
  result.scope.projectId = projectId; result.attachments.forEach(a => { a.projectId = projectId; });
  result.producer = { system: 'obsidian', instanceId, version: pluginVersion }; result.packageId = newId(); result.exportedAt = now();
  return { exchange: result, warnings: [warning('UNSUPPORTED_REPRESENTATION', 'Zusätzliche Angaben aus anderen Anwendungen bleiben erhalten. Darin können noch Verweise auf das ursprüngliche Projekt stehen; bitte bei Bedarf prüfen.')] };
}
/** Copies one detached record; dependencies and linked assets require explicit graph resolution first. */
export function transferObject(source: Exchange, entry: Entry, target: Exchange): Entry {
  if (entry.collection === 'project') fail('INVALID_FIELD', 'Projekt über „Projekt unabhängig kopieren“ übertragen.');
  const r = clone(entry.record);
  const references = ('chapterId' in r && (r.chapterId || r.parentSceneId || r.povCharacterId)) ||
    ('target' in r && r.target !== null) || ('relationshipType' in r) ||
    ('content' in r && r.content.format === 'markdown' && markdownInfo(r.content.text).links.some(l => /^(?:entity:|asset:)/.test(l.url)));
  if (references) fail('MISSING_REFERENCE', 'Objekt hat Bezüge oder Bilder. Diese im Eigenschaften-Editor bewusst auflösen oder das gesamte Projekt unabhängig kopieren.');
  if (source.project.id === target.project.id) fail('PROJECT_MISMATCH', 'Anderes Zielprojekt auswählen.');
  r.id = newId();
  if ('projectId' in r) r.projectId = target.project.id;
  r.origin = { system: 'obsidian', instanceId: target.producer.instanceId, objectId: r.id };
  r.baseHash = null; r.createdAt = now(); r.updatedAt = r.createdAt;
  return { collection: entry.collection, record: r } as Entry;
}
/** Validates a type change against incoming POV references before updating the graph. */
export function changeCatalogType(p: Exchange, id: string, type: string): void {
  const r = p.catalogItems.find(c => c.id === id);
  if (!r) fail('MISSING_REFERENCE', 'Katalogobjekt fehlt.');
  if (type !== 'character' && incomingReferences(p, { collection: 'catalogItems', id }).some(ref => ref.field === 'povCharacterId')) fail('MISSING_REFERENCE', 'Figur wird als POV verwendet. Szenenbezüge zuerst ausdrücklich ändern.');
  const entry: Entry = { collection: 'catalogItems', record: { ...r, type, updatedAt: now() } };
  setEntry(p, entry);
}
