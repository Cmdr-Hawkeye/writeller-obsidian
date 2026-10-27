import { MarkdownView } from 'obsidian';
import type { CommandContext } from '../ui/command-context';
import { safePath, isBelow } from '../storage/paths';
import { sha256 } from '../exchange/hash';
import { exportFoldersToHide } from '../projects/export-location';

/** Builds narrowly scoped explorer CSS; files stay normal, visible-vault API data on disk. */
export function technicalFolderCss(folders: string[]): string {
  return folders.map(folder => `.workspace-leaf-content[data-type="file-explorer"] .nav-folder:has(> .nav-folder-title[data-path=${JSON.stringify(folder)}]) { display: none; }`).join('\n');
}
/** Reversible presentation only: no folder is deleted, hidden on disk or removed from backups. */
export class WritingPresentation {
  private readonly styles = new Map<Document, HTMLStyleElement>();
  private readonly marked = new Set<HTMLElement>();
  private generation = 0;
  private disposed = false;
  /** Binds the owned writer context and current settings; requires dispose on plugin unload. */
  constructor(private readonly ctx: CommandContext) {}
  /** Updates managed editors and discovered data roots after layout/index or setting changes. */
  async refresh(): Promise<void> {
    const generation = ++this.generation, show = this.ctx.service.settings.showTechnicalInfo;
    const docs = new Set<Document>([this.ctx.app.workspace.containerEl.ownerDocument]);
    const active = new Set<HTMLElement>();
    for (const leaf of this.ctx.app.workspace.getLeavesOfType('file-explorer')) docs.add(leaf.view.containerEl.ownerDocument);
    for (const leaf of this.ctx.app.workspace.getLeavesOfType('markdown')) {
      if (!(leaf.view instanceof MarkdownView)) continue;
      const view = leaf.view, cached = view.file ? this.ctx.app.metadataCache.getFileCache(view.file)?.frontmatter : undefined;
      const managed = this.ctx.service.index.notes.some(n => n.path === view.file?.path) || cached?.['writeller-schema'] === 1;
      docs.add(view.containerEl.ownerDocument);
      view.containerEl.toggleClass('writeller-writing-note', !show && managed);
      this.marked.add(view.containerEl);
      active.add(view.containerEl);
    }
    for (const element of this.marked) if (!active.has(element)) { element.removeClass('writeller-writing-note'); this.marked.delete(element); }
    for (const [doc, style] of this.styles) if (!docs.has(doc)) { style.remove(); this.styles.delete(doc); }
    const roots = new Set<string>([this.ctx.service.settings.dataFolder, ...exportFoldersToHide(this.ctx.service.vault, this.ctx.service.settings)]);
    for (const note of this.ctx.service.index.manifests()) {
      const path = note.properties['writeller-state-path']; if (typeof path !== 'string') continue;
      try {
        safePath(path);
        const ending = `/${await sha256(note.projectId)}/state.json`;
        if (path.endsWith(ending)) roots.add(path.slice(0, -ending.length));
      } catch { /* Invalid state paths must not hide arbitrary content folders. */ }
    }
    if (this.disposed || generation !== this.generation) return;
    const folders = [...roots].filter(r => r && !this.ctx.service.index.notes.some(n => isBelow(n.path, r)));
    for (const doc of docs) {
      let style = this.styles.get(doc);
      if (!style) { style = doc.createElement('style'); style.dataset.writellerPresentation = 'true'; doc.head.append(style); this.styles.set(doc, style); }
      style.textContent = show ? '' : technicalFolderCss(folders);
    }
  }
  /** Restores native visibility and removes all plugin-owned classes/styles when disabled. */
  dispose(): void {
    this.disposed = true; this.generation++;
    for (const element of this.marked) element.removeClass('writeller-writing-note');
    for (const style of this.styles.values()) style.remove();
    this.marked.clear(); this.styles.clear();
  }
}
