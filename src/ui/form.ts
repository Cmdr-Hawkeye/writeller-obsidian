import { tr } from '../i18n/translate';
import { App, Modal, Setting, type ButtonComponent } from 'obsidian';

export interface FormField { key: string; label: string; value?: string; kind?: 'text' | 'area' | 'select' | 'number';
  description?: string; placeholder?: string; required?: boolean; options?: { label: string; value: string }[] }
export type FormValues = Record<string, string>;
/** Native, labelled writing form; Enter submits text fields and Escape cancels without writes. */
class WritingForm extends Modal {
  private readonly values: FormValues;
  private accepted = false;
  private submitting = false;
  /** Receives fields and a validator; persistence stays outside this reusable form. */
  constructor(app: App, private readonly heading: string, private readonly fields: FormField[], private readonly submitLabel: string,
    private readonly done: (values: FormValues | null) => void, private readonly validate: (values: FormValues) => void) {
    super(app); this.values = Object.fromEntries(fields.map(f => [f.key, f.value ?? '']));
  }
  /** Builds restrained native inputs using text only, with an accessible persistent error region. */
  override onOpen(): void {
    this.titleEl.setText(this.heading); this.modalEl.addClass('writeller-form');
    const error = this.contentEl.createEl('p', { cls: 'writeller-form-error', attr: { role: 'alert', 'aria-live': 'polite' } });
    let button: ButtonComponent;
    for (const field of this.fields) this.field(field, () => button?.buttonEl.click());
    new Setting(this.contentEl).addButton(b => b.setButtonText(tr('Abbrechen')).onClick(() => this.close())).addButton(b => {
      button = b; b.setButtonText(this.submitLabel).setCta().onClick(() => {
        if (this.submitting) return;
        try {
          for (const field of this.fields) if (field.required && !this.values[field.key]?.trim()) throw new Error(tr`Bitte „${field.label}“ ausfüllen.`);
          this.validate(this.values); this.submitting = true; b.setDisabled(true); this.accepted = true; this.done(this.values); this.close();
        } catch (e) { error.setText(e instanceof Error ? e.message : tr('Bitte Eingabe prüfen.')); }
      });
    });
    this.contentEl.querySelector<HTMLInputElement>('input')?.focus();
  }
  /** Creates one clearly labelled field; option values may be IDs but labels remain readable. */
  private field(field: FormField, submit: () => void): void {
    const row = new Setting(this.contentEl).setName(field.label);
    if (field.description) row.setDesc(field.description);
    const value = this.values[field.key] ?? '';
    if (field.kind === 'select') row.addDropdown(input => {
      for (const option of field.options ?? []) input.addOption(option.value, option.label);
      input.setValue(value).onChange(v => { this.values[field.key] = v; }); input.selectEl.setAttribute('aria-label', field.label);
    });
    else if (field.kind === 'area') row.addTextArea(input => {
      input.setValue(value).setPlaceholder(field.placeholder ?? '').onChange(v => { this.values[field.key] = v; });
      input.inputEl.rows = 3; input.inputEl.setAttribute('aria-label', field.label);
    });
    else row.addText(input => {
      input.setValue(value).setPlaceholder(field.placeholder ?? '').onChange(v => { this.values[field.key] = v; });
      input.inputEl.type = field.kind === 'number' ? 'number' : 'text'; input.inputEl.setAttribute('aria-label', field.label);
      input.inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
    });
  }
  /** Closing resolves cancellation once and removes only modal-owned elements. */
  override onClose(): void { this.contentEl.empty(); if (!this.accepted) this.done(null); }
}
/** Opens an ordinary writing form; validation never grants automatic approval to overwrite files. */
export function writingForm(app: App, heading: string, fields: FormField[], submit = tr('Speichern'), validate: (values: FormValues) => void = () => {}): Promise<FormValues | null> {
  return new Promise(resolve => new WritingForm(app, heading, fields, submit, resolve, validate).open());
}
