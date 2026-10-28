import { App, PluginSettingTab, type Plugin, type SettingDefinitionItem, type SettingDefinition } from 'obsidian';
import type { Settings } from '../projects/layout';
import { safePath, isBelow, collisionKey } from '../storage/paths';
import { fail } from '../domain/diagnostics';

type FolderKey = 'projectFolder' | 'dataFolder' | 'exchangeFolder';
/** Validates distinct vault roots before settings can redirect any subsequent write. */
export function validateSettings(settings: Settings): void {
  const paths = [settings.projectFolder, settings.dataFolder, settings.exchangeFolder].map(safePath);
  for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
    if (collisionKey(paths[i]!) === collisionKey(paths[j]!) || isBelow(paths[i]!, paths[j]!) || isBelow(paths[j]!, paths[i]!)) fail('INVALID_FIELD', 'Projekt-, Daten- und Austauschordner dürfen sich nicht überlappen.');
  }
}
/** Searchable native settings use the declarative API supported by the minimum Obsidian version. */
export class WritellerSettingsTab extends PluginSettingTab {
  /** Shares validated preferences with the writing services; identities never live in settings. */
  constructor(app: App, plugin: Plugin, private readonly settings: Settings, private readonly save: () => Promise<void>) { super(app, plugin); }
  /** Lets Obsidian render native headings, controls, folder suggestions and search results. */
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [{ type: 'group', heading: 'Dein Schreibbereich', items: [
      this.folder('projectFolder', 'Schreibprojekte ablegen unter', 'Deine Manuskripte, Figuren und Notizen bleiben normale Markdown-Dateien.'),
      this.folder('exchangeFolder', 'Exporte ablegen unter', 'Wird erst beim Export angelegt. Importdateien kannst du aus jedem Ordner dieses Vaults auswählen.'),
      { name: 'Technische Informationen anzeigen', desc: 'Zeigt interne Daten, reine Exportordner und technische Notizeigenschaften. Zum Schreiben nicht nötig.',
        control: { type: 'toggle', key: 'showTechnicalInfo', defaultValue: false } }
    ] }, { type: 'group', heading: 'Erweiterte Einstellungen', items: [
      this.folder('dataFolder', 'Austausch- und Sicherungsdaten', 'Erhalten vollständige Projektdaten und ermöglichen Wiederherstellung. Mit dem Vault sichern; nicht löschen.')
    ] }, { name: 'Writeller', desc: 'Kostenlos und lokal. Kein Konto und keine Lizenz erforderlich. Sprache: Deutsch.',
      render: setting => { setting.controlEl.createEl('a', { text: 'writeller.com', href: 'https://www.writeller.com' }); } }];
  }
  /** Reads only declared plugin preferences, without accessing host vault configuration. */
  override getControlValue(key: string): unknown {
    return key === 'showTechnicalInfo' || key === 'projectFolder' || key === 'dataFolder' || key === 'exchangeFolder' ? this.settings[key] : undefined;
  }
  /** Revalidates native control values even when called outside the normal rendered UI. */
  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'showTechnicalInfo' && typeof value === 'boolean') return this.persist(key, value);
    if ((key === 'projectFolder' || key === 'dataFolder' || key === 'exchangeFolder') && typeof value === 'string') return this.persist(key, value);
    fail('INVALID_FIELD', 'Unbekannte oder ungültige Einstellung.');
  }
  /** Supplies searchable folder controls with inline validation and no manual DOM heading. */
  private folder(key: FolderKey, name: string, desc: string): SettingDefinition {
    return { name, desc, control: { type: 'folder', key, defaultValue: this.settings[key], validate: value => {
      try { validateSettings({ ...this.settings, [key]: value }); }
      catch { return 'Getrennte Vault-Ordner ohne ungültige Zeichen oder überlappende Pfade wählen.'; }
    } } };
  }
  /** Restores the shared previous value if persistence fails, keeping services and UI consistent. */
  private async persist<K extends FolderKey | 'showTechnicalInfo'>(key: K, value: Settings[K]): Promise<void> {
    validateSettings({ ...this.settings, [key]: value });
    const previous = this.settings[key]; this.settings[key] = value;
    try { await this.save(); } catch (error) { this.settings[key] = previous; throw error; }
  }
}
