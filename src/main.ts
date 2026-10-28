import { tr } from './i18n/translate';
import { Plugin, MarkdownView, Notice, getLanguage, setTooltip } from 'obsidian';
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
import { resolveLanguage, setLanguage, language } from './i18n/language';
import { changeWritingLanguage } from './ui/language-change';

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
      if (loaded['folderLanguage'] === 'de' || loaded['folderLanguage'] === 'en') {
        this.preferences.folderLanguage = loaded['folderLanguage'];
        if (loaded['language'] === 'de' || loaded['language'] === 'en' || loaded['language'] === 'auto') this.preferences.language = loaded['language'];
      } else this.preferences.folderLanguage = 'de'; // Earlier releases had a German-only UI, not a user language preference.
    }
    setLanguage(this.preferences.folderLanguage ?? resolveLanguage(this.preferences.language, getLanguage()));
    try { validateSettings(this.preferences); } catch { this.preferences = { ...defaultSettings }; new Notice(tr('Die gespeicherten Ordner konnten nicht verwendet werden. Bestehende Projekte bleiben über ihre Projektnotizen erhalten.')); }
    if (upgradeExportFolder(this.preferences)) await this.saveData(this.preferences);
    const service = new TransferCoordinator(new ObsidianVault(this.app), this.preferences);
    const ctx = this.context = new CommandContext(this.app, service), writing = new WritingCommands(ctx), advanced = new LocalCommands(ctx);
    const transfer = new TransferCommands(ctx), inspection = new Inspection(ctx), images = new ImageCommands(ctx);
    this.presentation = new WritingPresentation(ctx); this.register(() => this.presentation.dispose());
    const present = (): void => { void this.presentation.refresh().catch(error => ctx.report(error)); };
    ctx.changed.add(present); this.register(() => ctx.changed.delete(present));
    const settingsTab = new WritellerSettingsTab(this.app, this, this.preferences, async () => {
      await this.saveData(this.preferences); for (const listener of ctx.changed) listener();
    }, async preference => { await this.run(async () => { await changeWritingLanguage(ctx, preference, async () => { await this.saveData(this.preferences); }); }); });
    this.addSettingTab(settingsTab);
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
    const actions = { writing, advanced, transfer, images, inspection, openView: () => openView(), organize: () => organizeProject(ctx), run, available: () => this.ready && !this.busy };
    let removeCommands = registerWritingCommands(this, ctx, actions);
    const ribbon = this.addRibbonIcon('book-open-text', tr('Schreibprojekte öffnen'), () => run(() => openView()));
    let labelsLanguage = language();
    const relabel = (): void => { if (labelsLanguage === language()) return; labelsLanguage = language(); removeCommands(); removeCommands = registerWritingCommands(this, ctx, actions); setTooltip(ribbon, tr('Schreibprojekte öffnen')); settingsTab.update(); };
    ctx.changed.add(relabel); this.register(() => ctx.changed.delete(relabel));
    ctx.savePreferences = async () => { setLanguage(this.preferences.folderLanguage ?? resolveLanguage(this.preferences.language, getLanguage())); await this.saveData(this.preferences); relabel(); };
    const status = this.addStatusBarItem(); this.registerDomEvent(status, 'click', () => run(() => openView()));
    registerWritingEvents(this, ctx, writing, advanced, inspection, this.presentation, status, run, () => this.ready && !this.busy);
    this.app.workspace.onLayoutReady(() => {
      void service.index.rebuild().then(async () => {
        await cleanupLegacyExportFolders(service.vault, this.preferences);
        this.ready = true;
        const needsLanguageSetup = !isObject(loaded) || !loaded['folderLanguage'] || this.preferences.folderLanguage !== resolveLanguage(this.preferences.language, getLanguage());
        if (needsLanguageSetup && !(await pendingJournals(service.vault)).length) await this.run(async () => { await changeWritingLanguage(ctx, this.preferences.language, async () => { await this.saveData(this.preferences); }, true); });
        inspection.updateStatus(status); await this.presentation.refresh();
        ctx.pendingRecovery = (await pendingJournals(service.vault)).length > 0;
        if (ctx.pendingRecovery) new Notice(tr('Ein Vorgang wurde unterbrochen. Unter „Novel Planner: Unterbrochenen Vorgang wiederherstellen“ kannst du ihn prüfen.'), 12000);
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
