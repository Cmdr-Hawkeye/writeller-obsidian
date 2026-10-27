import type { Exchange } from '../domain/types';
import { projectDataPath, safePath } from '../storage/paths';
import type { ProjectState } from '../storage/state-types';
import { newId } from '../exchange/hash';
import { NameAllocator, readableName } from './names';
import { appendLocations } from './note-layout';

export interface Settings { projectFolder: string; dataFolder: string; exchangeFolder: string; language: 'de'; showTechnicalInfo: boolean }
export const defaultSettings: Settings = { projectFolder: 'Schreibprojekte', dataFolder: 'Writeller-Daten', exchangeFolder: 'Exporte', language: 'de', showTechnicalInfo: false };
export interface Layout { root: string; statePath: string; state: ProjectState }
/** Creates a human-readable project folder; internal preservation paths alone use identity hashes. */
export async function newLayout(pkg: Exchange, settings: Settings, occupied: string[] = []): Promise<Layout> {
  const projectId = pkg.project.id, root = await projectDataPath(settings.dataFolder, projectId), names = new NameAllocator(occupied);
  const projectDir = names.allocate(safePath(settings.projectFolder), pkg.project.title);
  const layout: Layout = { root, statePath: `${root}/state.json`, state: { stateVersion: 1, projectId, localInstanceId: newId(),
    manifestPath: `${projectDir}/${readableName(pkg.project.title)}.md`, records: [], packages: [], locallyDeleted: [], pendingJournal: null, assets: [], extensions: structuredClone(pkg.extensions) } };
  await appendLocations(layout, pkg, names);
  return layout;
}
/** Adds new notes beside the current manifest; moving a project never creates a second folder. */
export async function extendLayout(layout: Layout, pkg: Exchange, occupied: string[] = []): Promise<void> {
  await appendLocations(layout, pkg, new NameAllocator([...occupied, ...layout.state.records.map(r => r.notePath)]));
}
