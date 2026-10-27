import { entries, recordKey } from '../domain/records';
import type { Exchange, Ref, Scene } from '../domain/types';
import { ExchangeError, type Diagnostic } from '../domain/diagnostics';
import { markdownInfo } from '../mapping/markdown';

/** Checks project ownership, graph integrity, times and semantic Markdown references. */
export function assertSemantics(p: Exchange): void {
  const errors: Diagnostic[] = [];
  const report = (code: Diagnostic['code'], pointer: string, message: string): void => { errors.push({ code, pointer, message, severity: 'error' }); };
  const keys = new Set<string>();
  if (p.scope.projectId !== p.project.id) report('PROJECT_MISMATCH', '/scope/projectId', 'Projektbesitz stimmt nicht überein.');
  const all = entries(p);
  if (all.length - 1 + p.attachments.length > 10000) report('LIMIT_EXCEEDED', '', 'Mehr als 10000 Datensätze.');
  for (const { collection, record } of all) {
    const pointer = collection === 'project' ? '/project' : `/${collection}/${p[collection].findIndex(r => r.id === record.id)}`;
    const key = recordKey(collection, record.id);
    if (keys.has(key)) report('DUPLICATE_ID', pointer, 'Doppelte ID innerhalb einer Sammlung.');
    keys.add(key);
    if ('projectId' in record && record.projectId !== p.project.id) report('PROJECT_MISMATCH', `${pointer}/projectId`, 'Fremdes Projekt im Snapshot.');
    if (record.updatedAt < record.createdAt) report('INVALID_FIELD', `${pointer}/updatedAt`, 'Änderungszeit liegt vor Erstellzeit.');
    if (('title' in record && !record.title.trim()) || ('name' in record && !record.name.trim())) report('INVALID_FIELD', pointer, 'Titel darf nicht nur Leerraum enthalten.');
    for (const [a, b] of [['storyDateStart', 'storyDateEnd'], ['validFromStoryTime', 'validToStoryTime']] as const) {
      if (a in record && b in record) {
        const start = record[a as keyof typeof record], end = record[b as keyof typeof record];
        if (typeof start === 'string' && typeof end === 'string' && end < start) report('INVALID_FIELD', pointer, 'Zeitintervall ist umgekehrt.');
      }
    }
  }
  const ref = (target: Ref | null, pointer: string): void => {
    if (target && !keys.has(recordKey(target.collection, target.id))) report('MISSING_REFERENCE', pointer, 'Verweisziel fehlt im Projekt.');
  };
  p.notes.forEach((r, i) => ref(r.target, `/notes/${i}/target`));
  p.researchItems.forEach((r, i) => ref(r.target, `/researchItems/${i}/target`));
  p.relationships.forEach((r, i) => {
    ref(r.source, `/relationships/${i}/source`); ref(r.target, `/relationships/${i}/target`);
    if (r.source.collection === 'relationships' || r.target.collection === 'relationships') report('INVALID_FIELD', `/relationships/${i}`, 'Beziehungen dürfen keine Beziehungsendpunkte haben.');
  });
  checkScenes(p, ref, report);
  const assets = new Set(p.attachments.map(a => a.id));
  if (assets.size !== p.attachments.length) report('DUPLICATE_ID', '/attachments', 'Doppelter Bildhash.');
  for (const a of p.attachments) if (a.projectId !== p.project.id) report('PROJECT_MISMATCH', '/attachments', 'Bild gehört zu einem anderen Projekt.');
  for (const { collection, record } of all) {
    if (!('content' in record) || record.content.format !== 'markdown') continue;
    for (const link of markdownInfo(record.content.text).links) {
      const pointer = `/${collection}/${record.id}/content/text`;
      if (link.url.startsWith('entity:')) {
        const target = /^entity:(project|chapters|scenes|catalogItems|relationships|notes|researchItems)\/([A-Za-z0-9][A-Za-z0-9._:-]*)$/.exec(link.url);
        if (!target || link.image) report('INVALID_FIELD', pointer, 'Ungültiger entity-Link.');
        else if (!keys.has(`${target[1]}/${target[2]}`)) report('MISSING_REFERENCE', pointer, 'Logisches Linkziel fehlt.');
      }
      if (link.url.startsWith('asset:')) {
        const asset = /^asset:([a-f0-9]{64})\?width=(?:[1-9]\d|100)&align=(?:left|center|right)$/.exec(link.url);
        if (!asset || !link.image || !link.standalone) report('INVALID_ASSET', pointer, 'Asset muss ein eigener Bildabsatz mit gültigem Layout sein.');
        else if (!assets.has(asset[1] ?? '')) report('MISSING_REFERENCE', pointer, 'Bildbytes fehlen.');
      }
    }
  }
  if (errors.length) throw new ExchangeError(errors);
}
/** Validates scene forests iteratively to avoid recursion overflow on 10000-node chains. */
function checkScenes(p: Exchange, ref: (r: Ref | null, pointer: string) => void,
  report: (code: Diagnostic['code'], pointer: string, message: string) => void): void {
  const scenes = new Map(p.scenes.map(r => [r.id, r]));
  const completed = new Set<string>();
  p.scenes.forEach((r, i) => {
    const pointer = `/scenes/${i}`;
    ref(r.chapterId ? { collection: 'chapters', id: r.chapterId } : null, `${pointer}/chapterId`);
    ref(r.parentSceneId ? { collection: 'scenes', id: r.parentSceneId } : null, `${pointer}/parentSceneId`);
    ref(r.povCharacterId ? { collection: 'catalogItems', id: r.povCharacterId } : null, `${pointer}/povCharacterId`);
    if (r.povCharacterId && p.catalogItems.find(c => c.id === r.povCharacterId)?.type !== 'character') report('INVALID_FIELD', `${pointer}/povCharacterId`, 'POV muss eine Figur sein.');
    if (r.parentSceneId && scenes.get(r.parentSceneId)?.chapterId !== r.chapterId) report('INVALID_FIELD', pointer, 'Eltern und Kinder benötigen dasselbe Kapitel.');
    const seen = new Set<string>();
    let node: Scene | undefined = r;
    while (node && !completed.has(node.id)) {
      if (seen.has(node.id)) { report('HIERARCHY_CYCLE', `${pointer}/parentSceneId`, 'Szenenhierarchie enthält einen Zyklus.'); break; }
      seen.add(node.id); node = node.parentSceneId ? scenes.get(node.parentSceneId) : undefined;
    }
    for (const id of seen) completed.add(id);
  });
}
