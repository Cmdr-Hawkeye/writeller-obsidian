import { Modal, Notice } from 'obsidian';
import type { Diagnostic } from '../domain/diagnostics';
import { ExchangeError } from '../domain/diagnostics';
import { manuscriptOrder } from '../domain/order';
import type { ManagedNote } from '../mapping/frontmatter';
import { CommandContext } from './command-context';
import { choose } from './dialogs';
import { namedChoices, writingKinds } from '../objects/kinds';

/** Compact local project inspection, also accessible on mobile without a status bar. */
export class Inspection {
  /** Shares the current host and identity service. */
  constructor(private readonly ctx: CommandContext) {}
  /** Collects source/index problems and offers direct local jumps instead of a dashboard. */
  async show(path?: string): Promise<void> {
    await this.ctx.service.index.rebuild();
    const active = this.ctx.active(path);
    let projectId = active?.projectId;
    if (!projectId) {
      const manifests = this.ctx.service.index.manifests();
      if (!manifests.length) { new Notice('Keine Projekte vorhanden. Projekt erstellen oder Exchange-Datei importieren.'); return; }
      const chosen = await choose(this.ctx.app, 'Projekt prüfen', namedChoices(manifests, n => String(n.properties['writeller-title'])));
      if (!chosen) return; projectId = chosen.projectId;
    }
    const problems: (Diagnostic & { path?: string })[] = [...this.ctx.service.index.problems];
    let order: string[] = [];
    try {
      const snapshot = await this.ctx.service.snapshot(projectId);
      problems.push(...snapshot.warnings);
      order = manuscriptOrder(snapshot.exchange).map(s => s.id);
    } catch (error) {
      if (!(error instanceof ExchangeError)) throw error;
      problems.push(...error.diagnostics);
    }
    const name = this.ctx.service.index.manifests().find(n => n.projectId === projectId)?.properties['writeller-title'];
    new InspectionModal(this.ctx, String(name ?? 'Schreibprojekt'), this.ctx.service.index.notes.filter(n => n.projectId === projectId), problems, order).open();
  }
  /** Updates the optional desktop status from current index hints; inspection performs a full check. */
  updateStatus(element: HTMLElement): void {
    const note = this.ctx.active();
    if (!note) { element.setText('Writeller · unzugeordnet'); return; }
    const manifest = this.ctx.service.index.notes.find(n => n.projectId === note.projectId && n.collection === 'project');
    const kind = writingKinds.find(k => k.collection === note.collection && (note.collection !== 'catalogItems' || k.type === note.properties['writeller-type']));
    element.setText(`${String(manifest?.properties['writeller-title'] ?? 'Schreibprojekt')} · ${note.collection === 'project' ? 'Projekt' : kind?.singular ?? 'Notiz'}`);
  }
}
/** Text-only diagnostics and note links cannot execute imported Markdown or remote embeds. */
class InspectionModal extends Modal {
  /** Receives validated display data and locally indexed destinations. */
  constructor(private readonly ctx: CommandContext, private readonly projectTitle: string, private readonly notes: ManagedNote[],
    private readonly problems: (Diagnostic & { path?: string })[], private readonly order: string[]) { super(ctx.app); }
  /** Creates accessible buttons for each known problem destination and managed object. */
  override onOpen(): void {
    this.titleEl.setText('Projektprüfung');
    this.contentEl.createEl('p', { text: `${this.projectTitle} · ${this.notes.length} Notizen · ${this.problems.length} Hinweise` });
    const list = this.contentEl.createEl('ul');
    for (const problem of this.problems) {
      const row = list.createEl('li'); row.createSpan({ text: this.ctx.service.settings.showTechnicalInfo ? `${problem.code}: ${problem.message}` : problem.message });
      const destination = problem.path ?? this.pathForPointer(problem.pointer);
      if (destination) row.createEl('button', { text: 'Zur Notiz' }).addEventListener('click', () => { void this.ctx.open(destination).catch(e => this.ctx.report(e)); });
    }
    if (!this.problems.length) this.contentEl.createEl('p', { text: 'Keine Probleme in diesem Projekt gefunden.' });
    const sorted = [...this.notes].sort((a, b) => {
      const ai = this.order.indexOf(a.id), bi = this.order.indexOf(b.id);
      return (ai < 0 ? 10000 : ai) - (bi < 0 ? 10000 : bi);
    });
    for (const note of sorted) this.contentEl.createEl('button', { cls: 'writeller-note-link', text: String(note.properties['writeller-title']) })
      .addEventListener('click', () => { void this.ctx.open(note.path).catch(e => this.ctx.report(e)); });
  }
  /** Resolves collection/index JSON pointers to the same current note ordering used by snapshots. */
  private pathForPointer(pointer: string): string | undefined {
    const [collection, id] = pointer.split('/').slice(1);
    if (collection === 'project') return this.notes.find(n => n.collection === 'project')?.path;
    const group = this.notes.filter(n => n.collection === collection);
    return /^\d+$/.test(id ?? '') ? group[Number(id)]?.path : group.find(n => n.id === id)?.path;
  }
  /** Removes only modal-owned DOM on close. */
  override onClose(): void { this.contentEl.empty(); }
}
