import { App, PluginSettingTab, Setting, type Plugin } from 'obsidian';
import type { Settings } from '../projects/layout';
import { safePath, isBelow, collisionKey } from '../storage/paths';
import { fail } from '../domain/diagnostics';

/** Validates folder settings as distinct visible vault roots before any write operation. */
export function validateSettings(settings: Settings): void {
  const paths = [settings.projectFolder, settings.dataFolder, settings.exchangeFolder].map(safePath);
  for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
    if (collisionKey(paths[i]!) === collisionKey(paths[j]!) || isBelow(paths[i]!, paths[j]!) || isBelow(paths[j]!, paths[i]!)) fail('INVALID_FIELD', 'Projekt-, Daten- und Austauschordner dürfen sich nicht überlappen.');
  }
}
/** Native settings contain only local preferences; identities live in notes and sidecars. */
export class WritellerSettingsTab extends PluginSettingTab {
  /** Binds validated settings persistence owned by the plugin. */
  constructor(app: App, plugin: Plugin, private readonly settings: Settings, private readonly save: () => Promise<void>) { super(app, plugin); }
  /** Renders the German settings and a factual project link without tracking. */
  override display(): void {
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Dein Schreibbereich' });
    const error = this.containerEl.createEl('p', { attr: { role: 'alert' } });
    const pathField = (container: HTMLElement, key: 'projectFolder' | 'dataFolder' | 'exchangeFolder', name: string, description: string): void => {
      new Setting(container).setName(name).setDesc(description).addText(field => field.setValue(this.settings[key]).onChange(async value => {
        const previous = this.settings[key];
        try { this.settings[key] = value; validateSettings(this.settings); await this.save(); error.setText(''); }
        catch { this.settings[key] = previous; error.setText('Ordner prüfen: sichtbare, getrennte Vault-Pfade ohne Traversal verwenden.'); }
      }));
    };
    pathField(this.containerEl, 'projectFolder', 'Schreibprojekte ablegen unter', 'Deine Manuskripte, Figuren und Notizen bleiben normale Markdown-Dateien.');
    pathField(this.containerEl, 'exchangeFolder', 'Exporte ablegen unter', 'Wird erst beim Export angelegt. Importdateien kannst du aus jedem Ordner dieses Vaults auswählen.');
    new Setting(this.containerEl).setName('Technische Informationen anzeigen').setDesc('Zeigt interne Daten, reine Exportordner und technische Notizeigenschaften. Zum Schreiben nicht nötig.')
      .addToggle(toggle => toggle.setValue(this.settings.showTechnicalInfo).onChange(async value => { this.settings.showTechnicalInfo = value; await this.save(); }));
    const advanced = this.containerEl.createEl('details'); advanced.createEl('summary', { text: 'Erweiterte Einstellungen' });
    pathField(advanced, 'dataFolder', 'Austausch- und Sicherungsdaten', 'Diese Dateien erhalten zusätzliche Projektdaten und ermöglichen Wiederherstellung. Sie werden standardmäßig nur im Dateibaum ausgeblendet. Mit dem Vault sichern; nicht löschen.');
    this.containerEl.createEl('p', { text: 'Kostenlos und lokal. Kein Konto und keine Lizenz erforderlich. Sprache: Deutsch.' });
    this.containerEl.createEl('a', { text: 'Writeller', href: 'https://www.writeller.com' });
  }
}
