import { App, Notice, TFile, MarkdownView } from 'obsidian';
import type { TransferCoordinator, CommitPreview } from '../transfer/coordinator';
import type { ManagedNote } from '../mapping/frontmatter';
import type { Snapshot } from '../projects/snapshot';
import type { Entry, Ref } from '../domain/types';
import { title } from '../domain/records';
import { fail, ExchangeError } from '../domain/diagnostics';
import { choose, confirmPreview } from './dialogs';
import { kindFor, namedChoices } from '../objects/kinds';

/** Shared small UI helpers; business decisions remain in pure planning modules. */
export class CommandContext {
  selectedProjectId: string | null = null;
  readonly changed = new Set<() => void>();
  openProjectView: ((projectId?: string) => Promise<void>) | null = null;
  pendingRecovery = false;
  readonly problemCodes = new Set<string>();
  /** Binds host UI and the independently testable exchange coordinator. */
  constructor(readonly app: App, readonly service: TransferCoordinator) {}
  /** Returns the active indexed identity; cached paths are only UI availability hints. */
  active(path = this.app.workspace.getActiveFile()?.path): ManagedNote | undefined {
    return this.service.index.notes.find(n => n.path === path);
  }
  /** Uses explicit view/active-note context, asking only when the target project is ambiguous. */
  async project(projectId?: string, forceChoice = false, excludeId?: string): Promise<Snapshot | null> {
    await this.service.index.rebuild(); this.service.index.assertClean();
    const manifests = this.service.index.manifests().filter(n => n.projectId !== excludeId);
    if (!manifests.length) { new Notice('Zuerst ein Schreibprojekt erstellen oder importieren.'); return null; }
    const contextual = projectId ?? (!forceChoice ? this.active()?.projectId ?? this.selectedProjectId : null);
    const matching = manifests.find(n => n.projectId === contextual);
    const id = matching?.projectId ?? (manifests.length === 1 ? manifests[0]!.projectId : (await choose(this.app, 'Für welches Schreibprojekt?', namedChoices(manifests, n => String(n.properties['writeller-title']))))?.projectId);
    if (!id) return null;
    this.selectedProjectId = id; await this.flushEditors(id); return this.service.snapshot(id);
  }
  /** Confirms exact planned counts and warnings before invoking any write operation. */
  async commit(preview: CommitPreview, heading: string, extra: string[] = [], successMessage = 'Gespeichert.'): Promise<boolean> {
    const ok = await confirmPreview(this.app, heading, [...extra, ...[...new Set(preview.warnings.map(w => w.message))]]);
    if (!ok) return false;
    await this.save(preview); new Notice(successMessage, successMessage === 'Gespeichert.' ? 4000 : 12000); return true;
  }
  /** Saves a user-submitted writing form without a second technical confirmation dialog. */
  async save(preview: CommitPreview): Promise<void> {
    await this.flushEditors(preview.projectId, preview.guards.keys());
    await this.service.commit(preview); this.selectedProjectId = preview.projectId;
    for (const listener of this.changed) listener();
  }
  /** Saves editor buffers belonging to the selected project before taking or committing a snapshot. */
  async flushEditors(projectId: string, extraPaths: Iterable<string> = []): Promise<void> {
    const assigned = new Set(extraPaths);
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file && (assigned.has(view.file.path) || this.service.index.notes.some(n => n.path === view.file?.path && n.projectId === projectId)) && view.getViewData() !== view.data) await view.save(false);
    }
  }
  /** Selects one typed endpoint; relationships cannot themselves be relation endpoints. */
  async endpoint(entries: Entry[], prompt: string): Promise<Ref | null> {
    const chosen = await choose(this.app, prompt, namedChoices(entries.filter(e => e.collection !== 'relationships'), e => `${e.collection === 'project' ? 'Projekt' : kindFor(e).singular} · ${title(e.record)}`));
    return chosen ? { collection: chosen.collection, id: chosen.record.id } : null;
  }
  /** Opens only an already validated local note; never renders external package HTML. */
  async open(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) fail('LOCAL_CHANGED', 'Notiz fehlt nach dem Vorgang. Projekt neu prüfen.');
    const leaf = this.app.workspace.getActiveViewOfType(MarkdownView) ? this.app.workspace.getLeaf(false) : this.app.workspace.getLeaf('tab');
    await leaf.openFile(file);
  }
  /** Shows content-free diagnostics locally; no manuscript text or absolute paths enter logs. */
  report(error: unknown): void {
    if (error instanceof ExchangeError) {
      for (const d of error.diagnostics) this.problemCodes.add(d.code);
      new Notice(error.diagnostics.map(d => this.service.settings.showTechnicalInfo ? `${d.code}: ${d.message}` : d.message).join('\n'), 12000);
    }
    else new Notice('Vorgang fehlgeschlagen. Projekt prüfen; bei begonnenem Schreiben „Import wiederherstellen“ ausführen.', 12000);
  }
}
