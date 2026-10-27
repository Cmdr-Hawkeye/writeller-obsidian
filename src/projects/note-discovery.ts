import type { ProjectIndex } from './index';
import type { VaultPort } from '../storage/vault-port';
import { collisionKey, isBelow } from '../storage/paths';
import { writingKinds } from '../objects/kinds';

export interface NoteCandidate { path: string; title: string; projectId: string; kindId: string; chapterId: string | null; ambiguousProject: boolean }
/** Suggests a writing type from a real manifest's folder; suggestions never establish ownership. */
export function suggestNote(index: ProjectIndex, path: string, projectId?: string): NoteCandidate | null {
  const roots = index.manifests().map(note => ({ projectId: note.projectId, root: note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : '' }))
    .filter(item => item.root && (collisionKey(path) === collisionKey(item.root) || isBelow(path, item.root)))
    .sort((a, b) => b.root.length - a.root.length);
  const nearest = roots.filter(item => collisionKey(item.root) === collisionKey(roots[0]?.root ?? ''));
  const project = projectId ? nearest.find(item => item.projectId === projectId) : nearest.length === 1 ? nearest[0] : undefined;
  if (!project) return null;
  const relative = path.slice(project.root.length + 1), folder = relative.split('/')[0];
  const kind = writingKinds.find(kind => !['chapter', 'scene', 'relationship'].includes(kind.id) && collisionKey(kind.plural) === collisionKey(folder ?? ''));
  const chapters = index.notes.filter(note => note.projectId === project.projectId && note.collection === 'chapters')
    .map(note => ({ id: note.id, folder: note.path.slice(0, note.path.lastIndexOf('/')) }))
    .filter(note => note.folder && (isBelow(path, note.folder) || collisionKey(path) === collisionKey(note.folder)))
    .sort((a, b) => b.folder.length - a.folder.length);
  const chapter = chapters[0];
  const chapterId = chapter && chapters.filter(c => collisionKey(c.folder) === collisionKey(chapter.folder)).length === 1 ? chapter.id : null;
  return { path, projectId: project.projectId, title: path.split('/').at(-1)!.replace(/\.md$/i, ''),
    kindId: collisionKey(folder ?? '') === 'manuskript' ? 'scene' : kind?.id ?? 'note', chapterId, ambiguousProject: nearest.length > 1 };
}
/** Finds ordinary Markdown files, excluding owned notes, nested foreign projects and invalid identities. */
export function discoverNotes(vault: VaultPort, index: ProjectIndex, projectId: string): NoteCandidate[] {
  const owned = new Set(index.notes.map(note => collisionKey(note.path)));
  const invalid = new Set(index.problems.map(problem => collisionKey(problem.path)));
  return vault.files().filter(file => file.markdown && !owned.has(collisionKey(file.path)) && !invalid.has(collisionKey(file.path)))
    .flatMap(file => { const candidate = suggestNote(index, file.path, projectId); return candidate ? [candidate] : []; })
    .sort((a, b) => a.path.localeCompare(b.path, 'de'));
}
