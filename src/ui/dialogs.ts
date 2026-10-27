import { App, FuzzySuggestModal, Modal, Setting } from 'obsidian';

export interface Choice<T> { label: string; value: T }
/** Searchable keyboard-accessible picker; closing it resolves null instead of hanging a command. */
export class ChoiceModal<T> extends FuzzySuggestModal<Choice<T>> {
  private selected = false;
  /** Supplies plain labels only; no input is rendered as HTML. */
  constructor(app: App, private readonly choices: Choice<T>[], private readonly done: (value: T | null) => void, prompt: string) {
    super(app); this.setPlaceholder(prompt);
  }
  /** Returns current choices for the host's fuzzy matcher. */
  getItems(): Choice<T>[] { return this.choices; }
  /** Exposes the searchable label independently of opaque IDs. */
  getItemText(item: Choice<T>): string { return item.label; }
  /** Resolves one user selection exactly once. */
  onChooseItem(item: Choice<T>): void { this.selected = true; this.done(item.value); }
  /** Handles Escape and clicking outside the picker. */
  override onClose(): void { if (!this.selected) this.done(null); }
}
/** Opens a searchable choice list; callers should handle empty states before calling. */
export function choose<T>(app: App, prompt: string, choices: Choice<T>[]): Promise<T | null> {
  return new Promise(resolve => new ChoiceModal(app, choices, resolve, prompt).open());
}
/** Text or JSON input modal; validation errors stay visible without losing edited input. */
class InputModal extends Modal {
  private value: string;
  private accepted = false;
  /** Binds a local validation callback that may be asynchronous but performs no commit. */
  constructor(app: App, private readonly title: string, initial: string, private readonly multiline: boolean,
    private readonly validate: (value: string) => Promise<void>, private readonly done: (value: string | null) => void) {
    super(app); this.value = initial;
  }
  /** Creates native form controls with visible labels and a persistent error region. */
  override onOpen(): void {
    this.titleEl.setText(this.title);
    const field = new Setting(this.contentEl).setName(this.multiline ? 'Vollständige JSON-Daten' : 'Eingabe');
    if (this.multiline) field.addTextArea(input => { input.setValue(this.value).onChange(v => { this.value = v; }); input.inputEl.rows = 18; input.inputEl.addClass('writeller-json'); });
    else field.addText(input => { input.setValue(this.value).onChange(v => { this.value = v; }); input.inputEl.focus(); });
    const error = this.contentEl.createEl('p', { attr: { role: 'alert' } });
    new Setting(this.contentEl).addButton(button => button.setButtonText('Übernehmen').setCta().onClick(async () => {
      try { await this.validate(this.value); this.accepted = true; this.done(this.value); this.close(); }
      catch (e) { error.setText(e instanceof Error ? e.message : 'Eingabe prüfen.'); }
    })).addButton(button => button.setButtonText('Abbrechen').onClick(() => this.close()));
  }
  /** Clears modal-owned DOM and resolves cancellation. */
  override onClose(): void { this.contentEl.empty(); if (!this.accepted) this.done(null); }
}
/** Requests a string with explicit validation; no file writes happen in this dialog. */
export function input(app: App, title: string, initial = '', multiline = false, validate: (value: string) => Promise<void> = async () => {}): Promise<string | null> {
  return new Promise(resolve => new InputModal(app, title, initial, multiline, validate, resolve).open());
}
/** Concrete no-HTML preview with an explicit final commit button and accessible cancellation. */
export class PreviewModal extends Modal {
  private accepted = false;
  /** Receives already computed counts and warnings, never executable Markdown. */
  constructor(app: App, private readonly title: string, private readonly lines: string[], private readonly done: (value: boolean) => void) { super(app); }
  /** Uses textContent for all dynamic content so external images cannot be requested. */
  override onOpen(): void {
    this.titleEl.setText(this.title);
    const list = this.contentEl.createEl('ul');
    for (const line of this.lines) list.createEl('li', { text: line });
    new Setting(this.contentEl).addButton(button => button.setButtonText('Übernehmen').setCta().onClick(() => { this.accepted = true; this.done(true); this.close(); }))
      .addButton(button => button.setButtonText('Abbrechen').onClick(() => this.close()));
  }
  /** Removes owned UI and resolves Escape as cancellation. */
  override onClose(): void { this.contentEl.empty(); if (!this.accepted) this.done(false); }
}
/** Confirms a fully computed preview; elapsed time never acts as permission. */
export function confirmPreview(app: App, title: string, lines: string[]): Promise<boolean> {
  return new Promise(resolve => new PreviewModal(app, title, lines, resolve).open());
}
