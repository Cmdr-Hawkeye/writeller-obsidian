import { collisionKey } from '../storage/paths';

/** Marks exact explorer folders without broad :has selectors or changes to vault files. */
export function markTechnicalFolders(doc: Document, folders: string[]): HTMLElement[] {
  const roots = new Set(folders.map(collisionKey)), marked: HTMLElement[] = [];
  for (const title of doc.querySelectorAll<HTMLElement>('.workspace-leaf-content[data-type="file-explorer"] .nav-folder-title[data-path]')) {
    const folder = title.closest<HTMLElement>('.nav-folder');
    if (folder && roots.has(collisionKey(title.dataset.path ?? ''))) { folder.addClass('writeller-technical-folder'); marked.push(folder); }
  }
  return marked;
}
/** Marks only metadata containers without user properties; individual technical rows use scoped CSS. */
export function markTechnicalMetadata(root: HTMLElement): HTMLElement[] {
  const marked: HTMLElement[] = [];
  for (const container of root.querySelectorAll<HTMLElement>('.metadata-container')) {
    if (!container.querySelector('.metadata-property:not([data-property-key^="writeller-"])')) {
      container.addClass('writeller-technical-metadata'); marked.push(container);
    }
  }
  return marked;
}
