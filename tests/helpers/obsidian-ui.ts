import type { App as NativeApp, Plugin as NativePlugin } from 'obsidian';
import type { FakeVault } from './fake-vault';

/** Test-only DOM host; this is an API shim, not a claim of native Obsidian execution. */
export function installDomHelpers(window: Window): void {
  const proto = Object.getPrototypeOf(window.document.createElement('div'));
  const htmlProto = Object.getPrototypeOf(proto);
  Object.assign(htmlProto, {
    createEl(this: HTMLElement, tag: string, options: { text?: string; cls?: string; attr?: Record<string, string>; value?: string } = {}) {
      const element = this.ownerDocument.createElement(tag);
      if (options.text !== undefined) element.textContent = options.text;
      if (options.cls) element.className = options.cls;
      for (const [key, value] of Object.entries(options.attr ?? {})) element.setAttribute(key, value);
      if (options.value !== undefined) Reflect.set(element, 'value', options.value);
      this.append(element); return element;
    },
    createDiv(this: HTMLElement, options: object = {}) { return this.createEl('div', options); },
    createSpan(this: HTMLElement, options: object = {}) { return this.createEl('span', options); },
    setText(this: HTMLElement, text: string) { this.textContent = text; },
    empty(this: HTMLElement) { this.replaceChildren(); },
    addClass(this: HTMLElement, ...names: string[]) { this.classList.add(...names); },
    removeClass(this: HTMLElement, ...names: string[]) { this.classList.remove(...names); },
    toggleClass(this: HTMLElement, name: string, enabled: boolean) { this.classList.toggle(name, enabled); }
  });
}
/** Minimal native modal lifecycle used by the form tests and browser preview. */
export class Modal {
  modalEl = document.createElement('div');
  titleEl = this.modalEl.createEl('h2');
  contentEl = this.modalEl.createDiv();
  /** Stores the test app without loading a personal vault. */
  constructor(readonly app: unknown) { this.modalEl.className = 'modal'; this.modalEl.setAttribute('role', 'dialog'); }
  /** Adds the modal to the test document and invokes the production onOpen override. */
  open(): void { document.body.append(this.modalEl); this.onOpen(); }
  /** Runs the production cancellation callback before removing the modal. */
  close(): void { this.onClose(); this.modalEl.remove(); }
  /** Empty host hook overridden by production modals. */
  onOpen(): void {}
  /** Empty host hook overridden by production modals. */
  onClose(): void {}
}
/** Controlled native input component; only public methods used by production forms are implemented. */
class TextInput {
  /** Receives an ordinary native input/textarea. */
  constructor(readonly inputEl: HTMLInputElement | HTMLTextAreaElement) {}
  /** Sets current value without coercing user data. */
  setValue(value: string): this { this.inputEl.value = value; return this; }
  /** Sets the optional input hint. */
  setPlaceholder(value: string): this { this.inputEl.placeholder = value; return this; }
  /** Uses input events just like native Obsidian text components. */
  onChange(callback: (value: string) => void): this { this.inputEl.addEventListener('input', () => callback(this.inputEl.value)); return this; }
}
/** Controlled native dropdown. */
class Dropdown {
  /** Receives an ordinary select. */
  constructor(readonly selectEl: HTMLSelectElement) {}
  /** Keeps opaque option values separate from visible labels. */
  addOption(value: string, label: string): this { this.selectEl.createEl('option', { value, text: label }); return this; }
  /** Selects one value. */
  setValue(value: string): this { this.selectEl.value = value; return this; }
  /** Observes user selection. */
  onChange(callback: (value: string) => void): this { this.selectEl.addEventListener('change', () => callback(this.selectEl.value)); return this; }
}
/** Controlled submit/cancel button. */
class Button {
  /** Receives an ordinary button. */
  constructor(readonly buttonEl: HTMLButtonElement) {}
  /** Sets visible label. */
  setButtonText(value: string): this { this.buttonEl.textContent = value; return this; }
  /** Marks the primary native action. */
  setCta(): this { this.buttonEl.classList.add('mod-cta'); return this; }
  /** Prevents duplicate submissions while saving. */
  setDisabled(value: boolean): this { this.buttonEl.disabled = value; return this; }
  /** Attaches an explicit user action. */
  onClick(callback: () => unknown): this { this.buttonEl.addEventListener('click', () => { void callback(); }); return this; }
}
/** Minimal public Setting builder for production form/settings rendering. */
export class Setting {
  private info: HTMLElement;
  private controls: HTMLElement;
  /** Builds the same structural classes used by the shipped CSS. */
  constructor(parent: HTMLElement) {
    const row = parent.createDiv({ cls: 'setting-item' }); this.info = row.createDiv({ cls: 'setting-item-info' }); this.controls = row.createDiv({ cls: 'setting-item-control' });
  }
  /** Supplies the visible field label. */
  setName(value: string): this { this.info.createDiv({ cls: 'setting-item-name', text: value }); return this; }
  /** Supplies concise field help. */
  setDesc(value: string): this { this.info.createDiv({ cls: 'setting-item-description', text: value }); return this; }
  /** Adds a text control. */
  addText(callback: (input: TextInput) => unknown): this { callback(new TextInput(this.controls.createEl('input'))); return this; }
  /** Adds a multiline text control. */
  addTextArea(callback: (input: TextInput) => unknown): this { callback(new TextInput(this.controls.createEl('textarea'))); return this; }
  /** Adds a select control. */
  addDropdown(callback: (input: Dropdown) => unknown): this { callback(new Dropdown(this.controls.createEl('select'))); return this; }
  /** Adds an action button. */
  addButton(callback: (input: Button) => unknown): this { callback(new Button(this.controls.createEl('button'))); return this; }
  /** Adds a boolean setting without changing filesystem data. */
  addToggle(callback: (input: { setValue(value: boolean): unknown; onChange(fn: (value: boolean) => unknown): unknown }) => unknown): this {
    const element = this.controls.createEl('input'); element.type = 'checkbox';
    const component = { setValue(value: boolean) { element.checked = value; return component; }, onChange(fn: (value: boolean) => unknown) { element.addEventListener('change', () => { void fn(element.checked); }); return component; } };
    callback(component); return this;
  }
}
/** Searchable choice host; controlled buttons replace native fuzzy-search internals in tests. */
export class FuzzySuggestModal<T> extends Modal {
  /** Production picker overrides this inventory. */
  getItems(): T[] { return []; }
  /** Production picker overrides its visible label. */
  getItemText(_item: T): string { return ''; }
  /** Production picker resolves one selection. */
  onChooseItem(_item: T): void {}
  /** Placeholder hook exists for API compatibility. */
  setPlaceholder(value: string): void { this.titleEl.textContent = value; }
  /** Renders controlled choices while retaining production close/cancel behaviour. */
  override onOpen(): void {
    for (const item of this.getItems()) this.contentEl.createEl('button', { text: this.getItemText(item) }).addEventListener('click', () => { this.onChooseItem(item); this.close(); });
  }
}
/** Captures notices locally for assertions without logging text or contacting a service. */
export class Notice {
  static messages: string[] = [];
  /** Records one UI notice. */
  constructor(message: string) { Notice.messages.push(message); }
  /** Mirrors the public lifetime hook used for a temporary storage-work indicator. */
  hide(): void {}
}
/** ItemView lifecycle surface used by the actual production view. */
export class ItemView {
  contentEl = document.createElement('div');
  /** Uses the supplied test leaf without inventing native behaviour. */
  constructor(readonly leaf: unknown) {}
}
/** Editor-class identity used by context checks; real native execution is a separate gate. */
export class MarkdownView {
  containerEl = document.createElement('div');
  file: TFile | null = null;
  data = '';
  /** Returns a controlled editor buffer for save-before-snapshot tests. */
  getViewData(): string { return this.data; }
  /** Controlled save hook for tests. */
  async save(_clear?: boolean): Promise<void> {}
}
/** Visible local file reference for normal note-opening assertions. */
export class TFile {
  /** Keeps a local vault-relative path only. */
  constructor(readonly path: string) {}
  /** Mirrors the public extension property for native file-menu tests. */
  get extension(): string { return this.path.split('.').at(-1) ?? ''; }
}
/** Required export for the native adapter's folder type checks. */
export class TFolder {
  /** Keeps the native folder-menu path without creating real directories. */
  constructor(readonly path = '') {}
}
/** Test-only settings container. */
export class PluginSettingTab {
  containerEl = document.createElement('div');
  /** Receives controlled dependencies. */
  constructor(readonly app: unknown, readonly plugin: unknown) {}
  /** Native search/render hooks are intentionally no-ops in the controlled API fake. */
  update(): void {}
}
/** Controlled host-language seam for installation and override tests. */
export let testHostLanguage = 'de';
/** Returns a synthetic locale, never the user's actual application configuration. */
export function getLanguage(): string { return testHostLanguage; }
/** Changes only the isolated test host's language. */
export function setHostLanguage(value: string): void { testHostLanguage = value; }
/** Minimal menu row. */
class MenuItem {
  label = '';
  action: () => unknown = () => {};
  /** Sets a human label. */
  setTitle(value: string): this { this.label = value; return this; }
  /** Ignores icon pixels in API-shim tests. */
  setIcon(_value: string): this { return this; }
  /** Registers the explicit menu action. */
  onClick(callback: () => unknown): this { this.action = callback; return this; }
}
/** Controlled menu rendered into the browser preview. */
export class Menu {
  private rows: MenuItem[] = [];
  /** Builds one menu row using the public callback API. */
  addItem(callback: (item: MenuItem) => unknown): this { const item = new MenuItem(); callback(item); this.rows.push(item); return this; }
  /** Separator hook has no side effects in the controlled preview. */
  addSeparator(): this { return this; }
  /** Shows a local text-only menu in the preview. */
  showAtPosition(_position: { x: number; y: number }): void {
    document.querySelector('.menu')?.remove(); const menu = document.body.createDiv({ cls: 'menu' });
    for (const row of this.rows) menu.createEl('button', { text: row.label }).addEventListener('click', () => { menu.remove(); void row.action(); });
  }
}
/** Represents icons without external fonts/assets in the test host. */
export function setIcon(element: HTMLElement, name: string): void { element.dataset.icon = name; element.textContent = name === 'plus' ? '+' : name === 'ellipsis' ? '⋯' : '›'; }
/** Creates only the controlled API methods exercised by writing forms and the overview. */
export function createUiApp(vault: FakeVault): { app: NativeApp; opened: string[]; editors: MarkdownView[] } {
  const opened: string[] = [], editors: MarkdownView[] = [], workspace = { containerEl: document.body, getActiveFile: () => null, getActiveViewOfType: () => null,
    getLeavesOfType: (type: string) => type === 'markdown' ? editors.map(view => ({ view })) : [], getLeaf: () => ({ openFile: async (file: TFile) => { opened.push(file.path); } }) };
  const app = { workspace, vault: { getAbstractFileByPath: (path: string) => vault.data.has(path) ? new TFile(path) : null }, metadataCache: { getFileCache: () => null } };
  return { app: app as unknown as NativeApp, opened, editors };
}
/** Creates a command-capture host for palette availability assertions. */
export function commandHost(): { plugin: NativePlugin; commands: { id: string; name: string; checkCallback(checking: boolean): boolean }[] } {
  const commands: { id: string; name: string; checkCallback(checking: boolean): boolean }[] = [];
  return { plugin: { addCommand(command: typeof commands[number]) { commands.push(command); } } as unknown as NativePlugin, commands };
}
