import { tr } from '../i18n/translate';
import { language } from '../i18n/language';
import { ItemView, Menu, type WorkspaceLeaf } from 'obsidian';
import type { CommandContext } from './command-context';
import type { WritingCommands } from './writing-commands';
import type { TransferCommands } from './transfer-commands';
import type { Snapshot } from '../projects/snapshot';
import { writingKinds, namedChoices } from '../objects/kinds';
import { manuscriptOrder } from '../domain/order';
import { moveInManuscript } from '../objects/reorder';
import { iconButton, renderManuscript, renderPlanning, writingWordCount, type ProjectActions } from './project-sections';
import { discoverNotes } from '../projects/note-discovery';
import { renderUnassigned } from './unassigned-notes';

export const projectViewType = 'writeller-writing-project';
export interface ProjectViewTools { inspect(): Promise<void>; advanced(): Promise<void>; organize(projectId: string): Promise<void>; recover(): Promise<void> }
/** Working overview: real Markdown files, chapter structure and direct writing actions. */
export class WritingProjectView extends ItemView {
  private generation = 0;
  private closed = false;
  private renderedKey: string | null = null;
  private readonly onChanged = (): void => { void this.refresh().catch(error => this.ctx.report(error)); };
  /** Injects action services; the view owns no manuscript data or separate identity registry. */
  constructor(leaf: WorkspaceLeaf, private readonly ctx: CommandContext, private readonly writing: WritingCommands,
    private readonly transfer: TransferCommands, private readonly run: (action: () => Promise<void>) => void, private readonly tools: ProjectViewTools) { super(leaf); }
  /** Registers a stable native Obsidian view type. */
  getViewType(): string { return projectViewType; }
  /** Supplies a readable tab label. */
  getDisplayText(): string { return tr('Schreibprojekte'); }
  /** Uses a native monochrome book icon. */
  override getIcon(): string { return 'book-open-text'; }
  /** Subscribes to saved project changes and renders the initial state. */
  override async onOpen(): Promise<void> { this.closed = false; this.contentEl.addClass('writeller-project-view'); this.ctx.changed.add(this.onChanged); await this.refresh(); }
  /** Removes owned listeners and invalidates outstanding asynchronous renders. */
  override async onClose(): Promise<void> { this.closed = true; this.generation++; this.renderedKey = null; this.ctx.changed.delete(this.onChanged); this.contentEl.empty(); }
  /** Selects projects by title; fresh source snapshots remain the sole source of ownership. */
  async refresh(): Promise<void> {
    const generation = ++this.generation;
    await this.ctx.service.index.rebuild();
    if (this.closed || generation !== this.generation) return;
    const manifests = this.ctx.service.index.manifests();
    if (!manifests.length) {
      if (this.renderedKey !== `empty/${language()}`) { this.contentEl.empty(); this.empty(); this.renderedKey = `empty/${language()}`; }
      return;
    }
    const choices = namedChoices(manifests, n => String(n.properties['writeller-title']));
    const id = manifests.some(m => m.projectId === this.ctx.selectedProjectId) ? this.ctx.selectedProjectId! : manifests[0]!.projectId;
    this.ctx.selectedProjectId = id;
    let snapshot: Snapshot;
    try { await this.ctx.flushEditors(id); snapshot = await this.ctx.service.snapshot(id); }
    catch (error) {
      if (this.closed || generation !== this.generation) return;
      this.renderedKey = null; this.contentEl.empty(); this.switcher(choices, id);
      this.contentEl.createEl('p', { text: tr('Dieses Projekt braucht eine Überprüfung, bevor es weiter gespeichert oder ausgetauscht werden kann.') });
      this.contentEl.createEl('button', { text: tr('Projekt prüfen') }).addEventListener('click', () => this.run(() => this.tools.inspect()));
      this.contentEl.createEl('button', { text: tr('Unterbrochenen Vorgang wiederherstellen') }).addEventListener('click', () => this.run(() => this.tools.recover()));
      this.ctx.report(error); return;
    }
    if (this.closed || generation !== this.generation) return;
    // Native focus/cache events often refresh without a content change. Keeping the same
    // DOM preserves the button between pointerdown and click, plus keyboard focus and folds.
    const candidates = discoverNotes(this.ctx.service.vault, this.ctx.service.index, id);
    const key = `${language()}/${id}/${snapshot.fingerprint}/${this.ctx.service.settings.showTechnicalInfo}/${JSON.stringify(candidates)}`;
    if (key === this.renderedKey) return;
    this.contentEl.empty(); this.switcher(choices, id); this.renderedKey = key;
    this.projectHeader(snapshot);
    renderUnassigned(this.contentEl, candidates, this.ctx, this.writing, this.run);
    const workspace = this.contentEl.createDiv({ cls: 'writeller-writing-layout' }), actions = this.actions(snapshot);
    renderManuscript(workspace.createDiv({ cls: 'writeller-manuscript' }), snapshot, actions);
    renderPlanning(workspace.createEl('aside', { cls: 'writeller-planning', attr: { 'aria-label': tr('Figuren, Welt und Ideen') } }), snapshot, actions);
  }
  /** Renders project selection only when the displayed source state actually changes. */
  private switcher(choices: { label: string; value: { projectId: string } }[], id: string): void {
    const top = this.contentEl.createDiv({ cls: 'writeller-project-switcher' });
    top.createSpan({ text: tr('Schreibprojekte'), cls: 'writeller-eyebrow' });
    const select = top.createEl('select', { attr: { 'aria-label': tr('Schreibprojekt auswählen') } });
    for (const choice of choices) select.createEl('option', { value: choice.value.projectId, text: choice.label });
    select.value = id;
    select.addEventListener('change', () => { this.ctx.selectedProjectId = select.value; this.onChanged(); });
    iconButton(top, 'plus', tr('Neues Schreibprojekt'), () => this.run(() => this.writing.createProject()));
  }
  /** Offers one clear first action plus import for an existing project. */
  private empty(): void {
    const empty = this.contentEl.createDiv({ cls: 'writeller-welcome' }); empty.createEl('h2', { text: tr('Dein nächstes Schreibprojekt') });
    empty.createEl('p', { text: tr('Kapitel, Szenen, Figuren und Ideen – geordnet in deinen eigenen Markdown-Dateien.') });
    empty.createEl('button', { cls: 'mod-cta', text: tr('Schreibprojekt erstellen') }).addEventListener('click', () => this.run(() => this.writing.createProject()));
    empty.createEl('button', { cls: 'writeller-text-button', text: tr('Vorhandenes Projekt importieren') }).addEventListener('click', () => this.run(() => this.transfer.importProject()));
  }
  /** Shows writing progress and a small action bar without technical storage counters. */
  private projectHeader(snapshot: Snapshot): void {
    const pkg = snapshot.exchange, header = this.contentEl.createDiv({ cls: 'writeller-project-header' });
    header.createEl('h2', { text: pkg.project.title });
    if (pkg.project.description) header.createEl('p', { cls: 'writeller-project-description', text: pkg.project.description });
    if (snapshot.state.records.some(r => /[a-f0-9]{32,}/i.test(r.notePath))) {
      const hint = header.createDiv({ cls: 'writeller-layout-hint' });
      hint.createSpan({ text: tr('Deine bisherigen Dateinamen lassen sich jetzt lesbar vereinfachen.') });
      hint.createEl('button', { text: tr('Dateinamen vereinfachen') }).addEventListener('click', () => this.run(() => this.tools.organize(pkg.project.id)));
    }
    const count = pkg.scenes.reduce((sum, scene) => sum + writingWordCount(scene.content.text), 0);
    header.createEl('p', { cls: 'writeller-progress-label', text: tr`${count.toLocaleString(language())} Wörter${pkg.project.wordTarget ? tr` von ${pkg.project.wordTarget.toLocaleString(language())}` : ''} · ${pkg.chapters.length} Kapitel · ${pkg.scenes.length} Szenen` });
    if (pkg.project.wordTarget) header.createEl('progress', { attr: { max: String(pkg.project.wordTarget), value: String(count), 'aria-label': tr('Fortschritt zum Schreibziel') } });
    const toolbar = header.createDiv({ cls: 'writeller-project-toolbar' }), scene = manuscriptOrder(pkg).at(-1);
    toolbar.createEl('button', { cls: 'mod-cta', text: scene ? tr('Weiterschreiben') : tr('Szene hinzufügen') }).addEventListener('click', () => this.run(async () => {
      const path = scene ? snapshot.state.records.find(r => r.collection === 'scenes' && r.id === scene.id)?.notePath : null;
      if (path) await this.ctx.open(path); else await this.writing.add('scene', pkg.project.id);
    }));
    const add = toolbar.createEl('button', { text: tr('Hinzufügen…') });
    add.addEventListener('click', () => {
      const menu = new Menu(); for (const kind of writingKinds) menu.addItem(item => item.setTitle(tr`${kind.singular} hinzufügen`).setIcon(kind.icon).onClick(() => this.run(() => this.writing.add(kind.id, pkg.project.id))));
      const rect = add.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
    });
    toolbar.createEl('button', { text: tr('Exportieren') }).addEventListener('click', () => this.run(() => this.transfer.exportProject(pkg.project.id)));
    const more = iconButton(toolbar, 'ellipsis', tr('Weitere Projektaktionen'), () => this.moreMenu(snapshot, more));
  }
  /** Keeps maintenance and raw preservation editing behind explicit secondary actions. */
  private moreMenu(snapshot: Snapshot, button: HTMLElement): void {
    const id = snapshot.exchange.project.id, menu = new Menu();
    menu.addItem(item => item.setTitle(tr('Projekt bearbeiten')).setIcon('pencil').onClick(() => this.run(() => this.writing.details(id, `project/${id}`))));
    menu.addItem(item => item.setTitle(tr('Projektbeschreibung öffnen')).setIcon('file-text').onClick(() => this.run(() => this.ctx.open(snapshot.state.manifestPath))));
    menu.addItem(item => item.setTitle(tr('Dateien lesbar ordnen')).setIcon('folder-tree').onClick(() => this.run(() => this.tools.organize(id))));
    menu.addItem(item => item.setTitle(tr('Projekt prüfen')).setIcon('check').onClick(() => this.run(() => this.tools.inspect())));
    menu.addSeparator(); menu.addItem(item => item.setTitle(tr('Projekt importieren')).setIcon('download').onClick(() => this.run(() => this.transfer.importProject())));
    if (this.ctx.service.settings.showTechnicalInfo) menu.addItem(item => item.setTitle(tr('Technische Daten bearbeiten')).onClick(() => this.run(() => this.tools.advanced())));
    const rect = button.getBoundingClientRect(); menu.showAtPosition({ x: rect.right, y: rect.bottom });
  }
  /** Connects rows to real-note operations without deriving ownership from folders. */
  private actions(snapshot: Snapshot): ProjectActions {
    const id = snapshot.exchange.project.id;
    return { add: (kind, chapter) => this.run(() => this.writing.add(kind, id, chapter)), open: path => this.run(() => this.ctx.open(path)),
      details: key => this.run(() => this.writing.details(id, key)), move: (entry, direction) => this.run(async () => {
        if (moveInManuscript(snapshot.exchange, entry, direction)) await this.ctx.save(await this.ctx.service.previewSave(snapshot.exchange, snapshot));
      }) };
  }
}
