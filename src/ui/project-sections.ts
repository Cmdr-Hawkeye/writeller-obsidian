import { language } from '../i18n/language';
import { tr } from '../i18n/translate';
import { Menu, setIcon } from 'obsidian';
import type { Snapshot } from '../projects/snapshot';
import type { Entry } from '../domain/types';
import { entries, recordKey, title } from '../domain/records';
import { compareOrder, manuscriptOrder } from '../domain/order';
import { writingKinds } from '../objects/kinds';

export interface ProjectActions { add(kind: string, chapterId?: string): void; open(path: string): void;
  details(key: string): void; move(entry: Entry, direction: -1 | 1): void }
/** Approximate display-only word count; never exported or used as a record change. */
export function writingWordCount(value: string): number { return value.trim() ? value.trim().split(/\s+/u).length : 0; }
/** Creates one native quiet icon button with a useful accessible name. */
export function iconButton(parent: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
  const button = parent.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label, title: label, type: 'button' } });
  setIcon(button, icon); button.addEventListener('click', action); return button;
}
/** Renders chapters/scenes as an ordered manuscript, retaining parent-child indentation. */
export function renderManuscript(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions): void {
  const pkg = snapshot.exchange, header = parent.createDiv({ cls: 'writeller-section-heading' });
  header.createEl('h3', { text: tr('Manuskript') });
  iconButton(header, 'plus', tr('Kapitel hinzufügen'), () => actions.add('chapter'));
  if (!pkg.chapters.length && !pkg.scenes.length) {
    const empty = parent.createDiv({ cls: 'writeller-empty' });
    empty.createEl('p', { text: tr('Hier wächst deine Geschichte.') });
    empty.createEl('p', { cls: 'writeller-muted', text: tr('Lege dein erstes Kapitel an. Die Szenen werden darin als normale Markdown-Notizen abgelegt.') });
    empty.createEl('button', { text: tr('Erstes Kapitel hinzufügen'), cls: 'mod-cta' }).addEventListener('click', () => actions.add('chapter'));
    empty.createEl('button', { text: tr('Mit einer Szene beginnen'), cls: 'writeller-text-button' }).addEventListener('click', () => actions.add('scene'));
    return;
  }
  const scenes = manuscriptOrder(pkg), depths = new Map<string, number>();
  for (const scene of scenes) depths.set(scene.id, scene.parentSceneId ? (depths.get(scene.parentSceneId) ?? 0) + 1 : 0);
  const chapters = [...pkg.chapters].sort(compareOrder);
  for (const [index, chapter] of chapters.entries()) {
    const group = parent.createDiv({ cls: 'writeller-chapter' }), head = group.createDiv({ cls: 'writeller-chapter-heading' });
    noteRow(head, snapshot, { collection: 'chapters', record: chapter }, actions, `${String(index + 1).padStart(2, '0')}  ${chapter.title}`);
    iconButton(head, 'plus', tr`Szene zu „${chapter.title}“ hinzufügen`, () => actions.add('scene', chapter.id));
    const children = scenes.filter(s => s.chapterId === chapter.id);
    for (const scene of children) noteRow(group, snapshot, { collection: 'scenes', record: scene }, actions, scene.title, depths.get(scene.id) ?? 0);
    if (!children.length) group.createEl('button', { cls: 'writeller-empty-row', text: tr('Erste Szene hinzufügen') }).addEventListener('click', () => actions.add('scene', chapter.id));
  }
  const unassigned = scenes.filter(s => s.chapterId === null);
  if (unassigned.length) {
    const group = parent.createDiv({ cls: 'writeller-chapter' }); group.createEl('h4', { text: tr('Szenen ohne Kapitel') });
    for (const scene of unassigned) noteRow(group, snapshot, { collection: 'scenes', record: scene }, actions, scene.title, depths.get(scene.id) ?? 0);
  }
}
/** Renders real writing object types, instead of exposing a generic catalog collection. */
export function renderPlanning(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions): void {
  parent.createEl('h3', { text: tr('Figuren, Welt und Ideen') });
  for (const kind of writingKinds.filter(k => !['chapter', 'scene'].includes(k.id))) {
    const items = entries(snapshot.exchange).filter(e => e.collection === kind.collection && (e.collection !== 'catalogItems' ||
      (kind.id === 'custom' ? !writingKinds.some(k => k.type === e.record.type) : e.record.type === kind.type)));
    const group = parent.createEl('details', { cls: 'writeller-kind-group' }); group.open = items.length > 0;
    const summary = group.createEl('summary');
    const label = summary.createSpan({ cls: 'writeller-kind-label' }); label.createSpan({ text: kind.plural });
    label.createSpan({ cls: 'writeller-count', text: String(items.length) });
    iconButton(summary, 'plus', tr`${kind.singular} hinzufügen`, () => actions.add(kind.id)).addEventListener('click', e => e.preventDefault());
    for (const entry of items) noteRow(group, snapshot, entry, actions);
  }
}
/** Opens the actual Markdown file; details/reorder remain secondary and keyboard reachable. */
function noteRow(parent: HTMLElement, snapshot: Snapshot, entry: Entry, actions: ProjectActions, label = title(entry.record), depth = 0): void {
  const path = snapshot.state.records.find(r => r.collection === entry.collection && r.id === entry.record.id)?.notePath;
  if (!path) return;
  const row = parent.createDiv({ cls: `writeller-note-row${entry.collection === 'chapters' ? ' is-chapter' : ''}` });
  row.style.setProperty('--writeller-depth', String(Math.min(depth, 8)));
  row.createEl('button', { text: label, cls: 'writeller-note-title' }).addEventListener('click', () => actions.open(path));
  if ('content' in entry.record) row.createSpan({ text: tr`${writingWordCount(entry.record.content.text).toLocaleString(language())} Wörter`, cls: 'writeller-word-count' });
  const more = iconButton(row, 'ellipsis', tr`Aktionen für „${label}“`, () => {
    const menu = new Menu(); menu.addItem(item => item.setTitle(tr('Details bearbeiten')).setIcon('pencil').onClick(() => actions.details(recordKey(entry.collection, entry.record.id))));
    if ('orderIndex' in entry.record) {
      menu.addItem(item => item.setTitle(tr('Nach oben')).setIcon('arrow-up').onClick(() => actions.move(entry, -1)));
      menu.addItem(item => item.setTitle(tr('Nach unten')).setIcon('arrow-down').onClick(() => actions.move(entry, 1)));
    }
    const bounds = more.getBoundingClientRect(); menu.showAtPosition({ x: bounds.right, y: bounds.bottom });
  });
}
