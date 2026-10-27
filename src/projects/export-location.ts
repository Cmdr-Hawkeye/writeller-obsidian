import { defaultSettings, type Settings } from './layout';
import type { VaultPort } from '../storage/vault-port';
import { collisionKey, isBelow } from '../storage/paths';

/** Former generated folder names only; custom destinations and their contents remain untouched. */
export const legacyExportFolders = ['Writeller-Austausch', 'Writeller Austausch', 'Writeller-Exchange', 'Writeller Exchange'];
/** Hides only empty/export-only roots; ordinary notes, images and unknown files remain visible. */
export function exportFoldersToHide(vault: VaultPort, settings: Settings): string[] {
  const roots = [...new Set([...legacyExportFolders, settings.exchangeFolder])];
  return roots.filter(root => ![settings.projectFolder, settings.dataFolder].some(path => collisionKey(path) === collisionKey(root) || isBelow(path, root)) &&
    !vault.files().some(file => isBelow(file.path, root) && !/\.writeller(?:-exchange)?\.json$/i.test(file.path)));
}
/** Upgrades the former default while preserving independently configured project/data roots. */
export function upgradeExportFolder(settings: Settings): boolean {
  if (!legacyExportFolders.some(folder => collisionKey(folder) === collisionKey(settings.exchangeFolder))) return false;
  const target = defaultSettings.exchangeFolder;
  if ([settings.projectFolder, settings.dataFolder].some(root => collisionKey(root) === collisionKey(target) || isBelow(root, target) || isBelow(target, root))) return false;
  settings.exchangeFolder = target; return true;
}
/** Removes only empty obsolete root folders via the adapter's fresh native child check. */
export async function cleanupLegacyExportFolders(vault: VaultPort, settings: Settings): Promise<void> {
  for (const folder of legacyExportFolders) {
    if ([settings.projectFolder, settings.dataFolder, settings.exchangeFolder].some(root => collisionKey(root) === collisionKey(folder) || isBelow(root, folder))) continue;
    if (vault.files().some(file => isBelow(file.path, folder))) continue;
    try { await vault.removeEmptyFolder?.(folder); } catch { /* Optional cleanup never blocks writing or removes nonempty folders. */ }
  }
}
