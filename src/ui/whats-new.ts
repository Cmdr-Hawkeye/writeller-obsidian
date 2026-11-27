import { tr } from '../i18n/translate';
import { Modal, setIcon, type App } from 'obsidian';

/** Public support page; a plain link the user opens deliberately, never fetched by the plugin. */
export const supportUrl = 'https://ko-fi.com/writeller_benjaminvorwerk';
/** Complete change history on GitHub. */
export const changelogUrl = 'https://github.com/Cmdr-Hawkeye/writeller-obsidian/blob/main/CHANGELOG.md';

/** Highlights per released version; German source text, translated at render time. */
interface ReleaseNote { version: string; items: () => string[] }
const notes: ReleaseNote[] = [
  { version: '0.3.6', items: () => [
    tr('Behoben: Ein Sprachwechsel der Ordner scheitert nicht mehr, wenn Obsidian beim Umbenennen Links selbst aktualisiert.'),
    tr('Neu: „Sprachwechsel reparieren“ löst einen hängengebliebenen Wechsel – als Button in der Übersicht und in der Befehlspalette.'),
    tr('Die Reparatur benennt nur Strukturordner zurück und setzt Links zurück; Notizen mit eigenen Textänderungen bleiben unverändert.')
  ] },
  { version: '0.3.5', items: () => [
    tr('Perspektive und Spannung lassen sich jetzt direkt setzen: in einer Szene über ⋯ → „Details bearbeiten“.'),
    tr('Perspektive: Auswahl aus den Figuren deines Projekts. Spannung: fünf Stufen von ruhig bis Höhepunkt.'),
    tr('Werkbank und Storyboard zeigen beide Werte sofort an; Exporte enthalten sie wie gewohnt.')
  ] },
  { version: '0.3.4', items: () => [
    tr('Neu: Dieser kurze Überblick erscheint einmal nach jedem Update. Abschaltbar hier im Dialog oder in den Einstellungen.'),
    tr('Über „Neuigkeiten anzeigen“ in der Befehlspalette lässt er sich jederzeit wieder öffnen.'),
    tr('Wer Novel Planner unterstützen möchte, findet den Ko-fi-Link jetzt hier und in den Einstellungen.')
  ] },
  { version: '0.3.3', items: () => [
    tr('Neu gestaltete Schreibübersicht mit zwei Ansichten, umschaltbar oben rechts.'),
    tr('Werkbank: Weiterschreiben, Schreibziel und Struktur auf einen Blick, dazu eine Manuskripttabelle mit Stand, Perspektive und Spannung.'),
    tr('Storyboard: Kapitel als Spalten, Szenen als Karten und eine durchsuchbare Liste deiner Figuren, Orte und Ideen.')
  ] }
];

/** Orders `major.minor.patch` numerically; unparsable values sort first. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string): number[] => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : [-1, -1, -1];
  const left = parse(a), right = parse(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
  return 0;
}
/** True when release highlights exist for exactly this version. */
export function hasReleaseNote(version: string): boolean { return notes.some(note => note.version === version); }
/** Highlights newer than the last seen version, newest first, at most three versions. */
export function releaseNotesSince(lastSeen: string | undefined, current: string): { version: string; items: string[] }[] {
  return notes.filter(note => compareVersions(note.version, current) <= 0 && (!lastSeen || compareVersions(note.version, lastSeen) > 0))
    .sort((a, b) => compareVersions(b.version, a.version)).slice(0, 3).map(note => ({ version: note.version, items: note.items() }));
}
/** Decides once per start: fresh installs only record the version; updates show new highlights unless disabled. */
export function releaseNotesPlan(hadData: boolean, lastSeen: string | undefined, enabled: boolean, current: string): { record: boolean; show: boolean } {
  if (lastSeen === current) return { record: false, show: false };
  return { record: true, show: hadData && enabled && releaseNotesSince(lastSeen, current).length > 0 };
}

/** Short "what's new" dialog with a visible but optional support link. */
export class WhatsNewModal extends Modal {
  /** Receives the version list and a callback that turns the automatic dialog off. */
  constructor(app: App, private readonly version: string, private readonly lastSeen: string | undefined, private readonly disable?: () => Promise<void>) { super(app); }
  /** Renders text only; no remote images, scripts or requests. */
  override onOpen(): void {
    this.modalEl.addClass('writeller-whats-new');
    this.titleEl.setText(tr`Neu in Novel Planner ${this.version}`);
    const body = this.contentEl;
    const support = body.createDiv({ cls: 'writeller-support' });
    const text = support.createDiv({ cls: 'writeller-support-text' });
    text.createEl('p', { cls: 'writeller-strong', text: tr('Novel Planner ist kostenlos und bleibt es.') });
    text.createEl('p', { cls: 'writeller-muted', text: tr('Wenn dir das Plugin beim Schreiben hilft, freue ich mich über einen Kaffee auf Ko-fi.') });
    const kofi = support.createEl('a', { cls: 'writeller-kofi', attr: { href: supportUrl, target: '_blank', rel: 'noopener' } });
    setIcon(kofi.createSpan({ cls: 'writeller-button-icon', attr: { 'aria-hidden': 'true' } }), 'heart'); kofi.createSpan({ text: tr('Auf Ko-fi unterstützen') });
    const entries = releaseNotesSince(this.lastSeen, this.version);
    for (const entry of entries.length ? entries : releaseNotesSince(undefined, this.version).slice(0, 1)) {
      body.createEl('h3', { text: tr`Version ${entry.version}` });
      const list = body.createEl('ul');
      for (const item of entry.items) list.createEl('li', { text: item });
    }
    const footer = body.createDiv({ cls: 'writeller-whats-new-footer' });
    footer.createEl('a', { text: tr('Alle Änderungen'), attr: { href: changelogUrl, target: '_blank', rel: 'noopener' } });
    footer.createDiv({ cls: 'writeller-spacer' });
    if (this.disable) {
      const disable = this.disable;
      footer.createEl('button', { cls: 'writeller-text-button', text: tr('Nach Updates nicht mehr zeigen'), attr: { type: 'button' } })
        .addEventListener('click', () => { void disable().finally(() => this.close()); });
    }
    footer.createEl('button', { cls: 'mod-cta', text: tr('Weiterschreiben'), attr: { type: 'button' } }).addEventListener('click', () => this.close());
  }
  /** Leaves no DOM behind. */
  override onClose(): void { this.contentEl.empty(); }
}
