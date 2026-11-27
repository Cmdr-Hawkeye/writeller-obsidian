import { language } from '../i18n/language';
import { tr } from '../i18n/translate';
import { Menu, setIcon } from 'obsidian';
import type { Snapshot } from '../projects/snapshot';
import type { Entry, Exchange, Scene } from '../domain/types';
import { entries, recordKey, title } from '../domain/records';
import { statusLabels, writingKinds, type WritingKind } from '../objects/kinds';

export interface ProjectActions { add(kind: string, chapterId?: string): void; open(path: string): void;
  details(key: string): void; move(entry: Entry, direction: -1 | 1): void; remove?(key: string): void }
/** Approximate display-only word count; never exported or used as a record change. */
export function writingWordCount(value: string): number { return value.trim() ? value.trim().split(/\s+/u).length : 0; }
/** Formats a display count in the active interface language. */
export function formatCount(value: number): string { return value.toLocaleString(language()); }
/** Creates one native quiet icon button with a useful accessible name. */
export function iconButton(parent: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
  const button = parent.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label, title: label, type: 'button' } });
  setIcon(button, icon); button.addEventListener('click', action); return button;
}
/** Creates a labelled button with a leading native icon. */
export function labelButton(parent: HTMLElement, icon: string, text: string, action: () => void, cls = ''): HTMLButtonElement {
  const button = parent.createEl('button', { cls: `writeller-button ${cls}`.trim(), attr: { type: 'button' } });
  setIcon(button.createSpan({ cls: 'writeller-button-icon', attr: { 'aria-hidden': 'true' } }), icon); button.createSpan({ text });
  button.addEventListener('click', action); return button;
}
/** Resolves the real Markdown note; rows without a verified note are not rendered. */
export function notePath(snapshot: Snapshot, entry: Entry): string | undefined {
  return snapshot.state.records.find(r => r.collection === entry.collection && r.id === entry.record.id)?.notePath;
}
/** Secondary actions stay identical in every layout: details and explicit, saved reordering. */
export function entryMenu(entry: Entry, actions: ProjectActions, anchor: HTMLElement): void {
  const menu = new Menu(); menu.addItem(item => item.setTitle(tr('Details bearbeiten')).setIcon('pencil').onClick(() => actions.details(recordKey(entry.collection, entry.record.id))));
  if ('orderIndex' in entry.record) {
    menu.addItem(item => item.setTitle(tr('Nach oben')).setIcon('arrow-up').onClick(() => actions.move(entry, -1)));
    menu.addItem(item => item.setTitle(tr('Nach unten')).setIcon('arrow-down').onClick(() => actions.move(entry, 1)));
  }
  if (actions.remove && entry.collection !== 'project') { menu.addSeparator(); menu.addItem(item => item.setTitle(tr('Löschen…')).setIcon('trash-2').onClick(() => actions.remove?.(recordKey(entry.collection, entry.record.id)))); }
  const bounds = anchor.getBoundingClientRect(); menu.showAtPosition({ x: bounds.right, y: bounds.bottom });
}
/** Opens the actual Markdown file; details/reorder remain secondary and keyboard reachable. */
export function noteRow(parent: HTMLElement, snapshot: Snapshot, entry: Entry, actions: ProjectActions, label = title(entry.record)): HTMLElement | null {
  const path = notePath(snapshot, entry);
  if (!path) return null;
  const row = parent.createDiv({ cls: 'writeller-note-row' });
  row.createEl('button', { text: label, cls: 'writeller-note-title', attr: { type: 'button' } }).addEventListener('click', () => actions.open(path));
  const more = iconButton(row, 'ellipsis', tr`Aktionen für „${label}“`, () => entryMenu(entry, actions, more));
  return row;
}
/** Groups open wire status values into a few visual tones; unknown values stay verbatim. */
export function statusTone(status: string): string {
  if (['idea', 'planned', 'outlined'].includes(status)) return 'is-planning';
  if (status === 'drafting') return 'is-drafting';
  if (status === 'needsRevision') return 'is-revision';
  if (['revised', 'reviewed'].includes(status)) return 'is-revised';
  if (status === 'locked') return 'is-locked';
  if (status === 'archived') return 'is-archived';
  return 'is-unknown';
}
/** Shows a known status label or the preserved raw value; never rewrites the record. */
export function statusBadge(parent: HTMLElement, status: string): HTMLElement {
  const known = Object.hasOwn(statusLabels, status);
  const badge = parent.createSpan({ cls: `writeller-status ${statusTone(status)}`, text: (known ? statusLabels[status] : undefined) ?? status });
  if (!known) badge.setAttribute('title', tr('Unbekannter Stand, unverändert erhalten'));
  if (status === 'locked') setIcon(badge.createSpan({ cls: 'writeller-status-icon', attr: { 'aria-hidden': 'true' } }), 'lock');
  return badge;
}
/** Visualizes the 0–100 tension field in five steps; the stored number is shown to assistive tech. */
export function tensionMeter(parent: HTMLElement, level: number | null): HTMLElement {
  if (level === null) return parent.createSpan({ cls: 'writeller-faint', text: '—', attr: { 'aria-label': tr('Spannung nicht festgelegt') } });
  const meter = parent.createSpan({ cls: 'writeller-tension', attr: { role: 'img', 'aria-label': tr`Spannung ${level} von 100`, title: tr`Spannung ${level} von 100` } });
  const filled = level <= 0 ? 0 : Math.min(5, Math.ceil(level / 20));
  for (let step = 1; step <= 5; step++) meter.createSpan({ cls: step <= filled ? 'is-on' : '' });
  return meter;
}
/** Resolves a POV character by ID only; missing targets are shown as absent. */
export function povName(pkg: Exchange, scene: Scene): string | null {
  return scene.povCharacterId ? pkg.catalogItems.find(c => c.id === scene.povCharacterId)?.name ?? null : null;
}
/** Short initials for an avatar; derived from the displayed name only. */
export function initials(name: string): string {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map(part => [...part][0]?.toLocaleUpperCase(language()) ?? '').join('') || '?';
}
/** Planning concepts shown beside the manuscript. */
export function planningKinds(): WritingKind[] { return writingKinds.filter(k => !['chapter', 'scene'].includes(k.id)); }
/** Real writing objects for one concept, instead of a generic catalog collection. */
export function planningItems(pkg: Exchange, kind: WritingKind): Entry[] {
  return entries(pkg).filter(e => e.collection === kind.collection && (e.collection !== 'catalogItems' ||
    (kind.id === 'custom' ? !writingKinds.some(k => k.type === e.record.type) : e.record.type === kind.type)));
}
/** Counts scenes that show a catalog object: POV plus explicit `appearsIn` relationships (scene → object). */
export function sceneAppearances(pkg: Exchange, id: string): number {
  const scenes = new Set(pkg.scenes.filter(s => s.povCharacterId === id).map(s => s.id));
  for (const r of pkg.relationships) if (r.relationshipType === 'appearsIn' && r.source.collection === 'scenes' && r.target.collection === 'catalogItems' && r.target.id === id) scenes.add(r.source.id);
  return scenes.size;
}
/** Opens the shared add menu for every writing concept. */
export function addMenu(anchor: HTMLElement, actions: ProjectActions): void {
  const menu = new Menu();
  for (const kind of writingKinds) menu.addItem(item => item.setTitle(tr`${kind.singular} hinzufügen`).setIcon(kind.icon).onClick(() => actions.add(kind.id)));
  const rect = anchor.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
}
