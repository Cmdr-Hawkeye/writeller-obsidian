import type { Entry, Exchange, Collection } from '../domain/types';
import { entries, recordKey, title } from '../domain/records';
import { compareOrder, manuscriptOrder } from '../domain/order';
import { sidecarPath, safePath } from '../storage/paths';
import type { Layout } from './layout';
import type { NameAllocator } from './names';

const catalogFolders: Record<string, string> = { character: 'Figuren', location: 'Orte', object: 'Gegenstände', timelineEvent: 'Ereignisse', arc: 'Handlungsbögen' };
const folders: Partial<Record<Collection, string>> = { relationships: 'Beziehungen', notes: 'Notizen', researchItems: 'Recherche' };
/** Selects an ordinary German writing folder, including unknown and custom catalog types. */
export function contentFolder(entry: Entry): string {
  if (entry.collection !== 'catalogItems') return folders[entry.collection] ?? 'Manuskript';
  const known = catalogFolders[entry.record.type]; if (known) return known;
  const ext = entry.record.extensions['org.writeller.obsidian'];
  if (typeof ext === 'object' && ext !== null && !Array.isArray(ext) && typeof ext['customTypeName'] === 'string') {
    const label = ext['customTypeName'].normalize('NFC').replace(/[\\/\x00-\x1f\x7f:*?"<>|]/g, '-').trim();
    try { safePath(label); return `Eigene Typen/${label}`; } catch { /* Keep malformed foreign labels as data, not paths. */ }
  }
  return 'Eigene Typen';
}
/** Adds missing note paths in manuscript order, preserving existing paths and all record identities. */
export async function appendLocations(layout: Layout, pkg: Exchange, names: NameAllocator): Promise<void> {
  const base = layout.state.manifestPath.slice(0, layout.state.manifestPath.lastIndexOf('/'));
  const locations = new Map(layout.state.records.map(r => [recordKey(r.collection, r.id), r.notePath]));
  const chapterDirs = new Map<string, string>(), sceneDirs = new Map<string, string>();
  const add = async (entry: Entry, path: string): Promise<void> => {
    const key = recordKey(entry.collection, entry.record.id);
    if (locations.has(key)) return;
    layout.state.records.push({ collection: entry.collection, id: entry.record.id, notePath: path, sidecarPath: await sidecarPath(layout.root, entry.collection, entry.record.id) });
    locations.set(key, path);
  };
  await add({ collection: 'project', record: pkg.project }, layout.state.manifestPath);
  for (const [index, chapter] of [...pkg.chapters].sort(compareOrder).entries()) {
    const existing = locations.get(`chapters/${chapter.id}`);
    const folder = existing ? existing.slice(0, existing.lastIndexOf('/')) : names.allocate(`${base}/Manuskript`, `${String(index + 1).padStart(2, '0')} - ${chapter.title}`);
    chapterDirs.set(chapter.id, folder);
    if (!existing) await add({ collection: 'chapters', record: chapter }, names.allocate(folder, chapter.title, '.md'));
  }
  const siblingOrder = new Map<string, number>();
  for (const scene of manuscriptOrder(pkg)) {
    const existing = locations.get(`scenes/${scene.id}`), group = `${scene.chapterId ?? ''}/${scene.parentSceneId ?? ''}`;
    const number = (siblingOrder.get(group) ?? 0) + 1; siblingOrder.set(group, number);
    const folder = scene.parentSceneId ? sceneDirs.get(scene.parentSceneId)! : scene.chapterId ? chapterDirs.get(scene.chapterId)! : `${base}/Manuskript/Ohne Kapitel`;
    const path = existing ?? names.allocate(folder, `${String(number).padStart(2, '0')} - ${scene.title}`, '.md');
    sceneDirs.set(scene.id, path.replace(/\.md$/, ''));
    if (!existing) await add({ collection: 'scenes', record: scene }, path);
  }
  for (const entry of entries(pkg).filter(e => !['project', 'chapters', 'scenes'].includes(e.collection))) {
    if (!locations.has(recordKey(entry.collection, entry.record.id))) await add(entry, names.allocate(safePath(`${base}/${contentFolder(entry)}`), title(entry.record), '.md'));
  }
}
