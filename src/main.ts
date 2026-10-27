import { Plugin, MarkdownView, Notice } from 'obsidian';
import { TransferCoordinator } from './transfer/coordinator';
import { ObsidianVault } from './obsidian/vault';
import { WritingPresentation } from './obsidian/presentation';
import { registerWritingEvents } from './obsidian/events';
import { defaultSettings, type Settings } from './projects/layout';
import { WritellerSettingsTab, validateSettings } from './ui/settings';
import { CommandContext } from './ui/command-context';
import { LocalCommands } from './ui/local-commands';
import { WritingCommands } from './ui/writing-commands';
import { TransferCommands } from './ui/transfer-commands';
import { Inspection } from './ui/inspection';
import { ImageCommands } from './ui/image-commands';
import { WritingProjectView, projectViewType } from './ui/project-view';
import { registerWritingCommands } from './ui/commands';
import { organizeProject } from './ui/organize-command';
import { isObject } from './exchange/parser';
import { pendingJournals } from './storage/recovery-index';
import { upgradeExportFolder, cleanupLegacyExportFolders } from './projects/export-location';

/** Composition root: small writing services, native view, registered events and explicit cleanup. */
export default class WritellerPlugin extends Plugin {
  private preferences: Settings = { ...defaultSettings };
  private context!: CommandContext;
  private presentation!: WritingPresentation;
  private ready = false;
  private busy = false;
  /** Composes the writing-first UI without migrating or reorganising existing files on startup. */
  override async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    if (isObject(loaded)) {
      for (const key of ['projectFolder', 'dataFolder', 'exchangeFolder'] as const) if (typeof loaded[key] === 'string') this.preferences[key] = loaded[key];
      if (typeof loaded['showTechnicalInfo'] === 'boolean') this.preferences.showTechnicalInfo = loaded['showTechnicalInfo'];
    }
    try { validateSettings(this.preferences); } catch { this.preferences = { ...defaultSettings }; new Notice('Die gespeicherten Ordner konnten nicht verwendet werden. Bestehende Projekte bleiben über ihre Projektnotizen erhalten.'); }
    if (upgradeExportFolder(this.preferences)) await this.saveData(this.preferences);
    const service = new TransferCoordinator(new ObsidianVault(this.app), this.preferences);
    const ctx = this.context = new CommandContext(this.app, service), writing = new WritingCommands(ctx), advanced = new LocalCommands(ctx);
    const transfer = new TransferCommands(ctx), inspection = new Inspection(ctx), images = new ImageCommands(ctx);
    this.presentation = new WritingPresentation(ctx); this.register(() => this.presentation.dispose());
    const present = (): void => { void this.presentation.refresh().catch(error => ctx.report(error)); };
    ctx.changed.add(present); this.register(() => ctx.changed.delete(present));
    this.addSettingTab(new WritellerSettingsTab(this.app, this, this.preferences, async () => {
      await this.saveData(this.preferences); present(); for (const listener of ctx.changed) listener();
    }));
    const run = (action: () => Promise<void>): void => { void this.run(action); };
    const openView = async (projectId?: string): Promise<void> => {
      if (projectId) ctx.selectedProjectId = projectId;
      let leaf = this.app.workspace.getLeavesOfType(projectViewType)[0];
      if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: projectViewType, active: true }); }
      if (leaf.view instanceof WritingProjectView) await leaf.view.refresh();
      await this.app.workspace.revealLeaf(leaf);
    };
    ctx.openProjectView = openView;
    this.registerView(projectViewType, leaf => new WritingProjectView(leaf, ctx, writing, transfer, run, {
      inspect: () => inspection.show(), advanced: () => advanced.properties(), organize: id => organizeProject(ctx, id), recover: () => transfer.recoverImport()
    }));
    registerWritingCommands(this, ctx, { writing, advanced, transfer, images, inspection, openView: () => openView(), organize: () => organizeProject(ctx), run, available: () => this.ready && !this.busy });
    this.addRibbonIcon('book-open-text', 'Schreibprojekte öffnen', () => run(() => openView()));
    const status = this.addStatusBarItem(); this.registerDomEvent(status, 'click', () => run(() => openView()));
    registerWritingEvents(this, ctx, writing, advanced, inspection, this.presentation, status, run, () => this.ready && !this.busy);
    this.app.workspace.onLayoutReady(() => {
      void service.index.rebuild().then(async () => {
        await cleanupLegacyExportFolders(service.vault, this.preferences);
        this.ready = true; inspection.updateStatus(status); await this.presentation.refresh();
        ctx.pendingRecovery = (await pendingJournals(service.vault)).length > 0;
        if (ctx.pendingRecovery) new Notice('Ein Vorgang wurde unterbrochen. Unter „Writeller: Unterbrochenen Vorgang wiederherstellen“ kannst du ihn prüfen.', 12000);
      }).catch(error => ctx.report(error));
    });
  }
  /** Serializes explicit UI actions and saves active editor text before domain operations. */
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy || !this.ready) return;
    this.busy = true;
    try { await this.app.workspace.getActiveViewOfType(MarkdownView)?.save(false); validateSettings(this.preferences); await action(); }
    catch (error) { this.context.report(error); }
    finally {
      this.busy = false;
      this.context.pendingRecovery = (await pendingJournals(this.context.service.vault).catch(() => [])).length > 0;
      for (const listener of this.context.changed) listener();
    }
  }
  /** Plugin-owned listeners/styles are registered for cleanup; notes remain ordinary Markdown. */
  override onunload(): void { this.ready = false; }
}
