import { tr } from '../i18n/translate';
import type { Snapshot } from '../projects/snapshot';
import type { Chapter, Scene } from '../domain/types';
import { recordKey } from '../domain/records';
import { compareOrder, manuscriptOrder } from '../domain/order';
import { entryMenu, formatCount, iconButton, initials, notePath, povName, statusBadge, tensionMeter, writingWordCount, type ProjectActions } from './project-sections';
import { renderWorldDrawer, type WorldFilter } from './world';

/** Variant C: chapters as columns, scenes as index cards, the world in a searchable drawer. */
export function renderStoryboard(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions, filter: WorldFilter): void {
  const layout = parent.createDiv({ cls: 'writeller-storyboard' });
  const board = layout.createDiv({ cls: 'writeller-board writeller-manuscript', attr: { role: 'region', 'aria-label': tr('Manuskript'), tabindex: '0' } });
  renderBoard(board, snapshot, actions);
  renderWorldDrawer(layout.createEl('aside', { cls: 'writeller-drawer writeller-planning', attr: { 'aria-label': tr('Figuren, Welt und Ideen') } }), snapshot, actions, filter);
}

/** Columns follow manuscript order; reordering stays an explicit, saved menu action. */
function renderBoard(board: HTMLElement, snapshot: Snapshot, actions: ProjectActions): void {
  const pkg = snapshot.exchange, scenes = manuscriptOrder(pkg), depths = new Map<string, number>();
  for (const scene of scenes) depths.set(scene.id, scene.parentSceneId ? (depths.get(scene.parentSceneId) ?? 0) + 1 : 0);
  for (const [index, chapter] of [...pkg.chapters].sort(compareOrder).entries()) {
    column(board, snapshot, actions, chapter, index, scenes.filter(s => s.chapterId === chapter.id), depths);
  }
  const loose = scenes.filter(s => s.chapterId === null);
  if (loose.length) column(board, snapshot, actions, null, -1, loose, depths);
  const add = board.createDiv({ cls: 'writeller-column is-add' });
  const button = add.createEl('button', { cls: 'writeller-add-card', attr: { type: 'button' } });
  button.createSpan({ cls: 'writeller-add-plus', text: '+', attr: { 'aria-hidden': 'true' } });
  button.createSpan({ text: pkg.chapters.length ? tr('Neues Kapitel') : tr('Erstes Kapitel hinzufügen') });
  button.addEventListener('click', () => actions.add('chapter'));
  if (!pkg.chapters.length && !pkg.scenes.length) {
    add.createEl('button', { cls: 'writeller-text-button', text: tr('Mit einer Szene beginnen'), attr: { type: 'button' } }).addEventListener('click', () => actions.add('scene'));
  }
}

/** One chapter (or the unassigned scenes) with its cards and a direct add action. */
function column(board: HTMLElement, snapshot: Snapshot, actions: ProjectActions, chapter: Chapter | null, index: number, scenes: Scene[], depths: Map<string, number>): void {
  const col = board.createDiv({ cls: 'writeller-column' }), head = col.createDiv({ cls: 'writeller-column-head' });
  if (chapter) {
    head.createSpan({ cls: 'writeller-ordinal', text: String(index + 1).padStart(2, '0') });
    const path = notePath(snapshot, { collection: 'chapters', record: chapter });
    const label = head.createEl('button', { cls: 'writeller-note-title', text: chapter.title, attr: { type: 'button' } });
    if (path) label.addEventListener('click', () => actions.open(path));
  } else head.createEl('h4', { cls: 'writeller-column-title', text: tr('Szenen ohne Kapitel') });
  head.createSpan({ cls: 'writeller-faint', text: formatCount(scenes.reduce((sum, s) => sum + writingWordCount(s.content.text), 0)) });
  if (chapter) { const more = iconButton(head, 'ellipsis', tr`Aktionen für „${chapter.title}“`, () => entryMenu({ collection: 'chapters', record: chapter }, actions, more)); }
  for (const scene of scenes) card(col, snapshot, actions, scene, depths.get(scene.id) ?? 0);
  const add = col.createEl('button', { cls: 'writeller-add-card is-small', text: chapter && !scenes.length ? tr('Erste Szene hinzufügen') : tr('Szene hinzufügen'), attr: { type: 'button' } });
  add.addEventListener('click', () => actions.add('scene', chapter?.id));
}

/** Index card: the title button opens the note and covers the card; the menu stays separately focusable. */
function card(col: HTMLElement, snapshot: Snapshot, actions: ProjectActions, scene: Scene, depth: number): void {
  const path = notePath(snapshot, { collection: 'scenes', record: scene });
  if (!path) return;
  const el = col.createDiv({ cls: `writeller-scene-card${depth ? ' is-child' : ''}` });
  el.style.setProperty('--writeller-depth', String(Math.min(depth, 4)));
  const top = el.createDiv({ cls: 'writeller-scene-card-top' });
  statusBadge(top, scene.status);
  const more = iconButton(top, 'ellipsis', tr`Aktionen für „${scene.title}“`, () => entryMenu({ collection: 'scenes', record: scene }, actions, more));
  el.createEl('button', { cls: 'writeller-note-title writeller-card-link', text: scene.title, attr: { type: 'button' } }).addEventListener('click', () => actions.open(path));
  if (scene.summary) el.createDiv({ cls: 'writeller-summary', text: scene.summary });
  else el.createEl('button', { cls: 'writeller-link-button writeller-summary-add', text: tr('Kurzbeschreibung ergänzen'), attr: { type: 'button' } })
    .addEventListener('click', () => actions.details(recordKey('scenes', scene.id)));
  const meta = el.createDiv({ cls: 'writeller-scene-meta' }), pov = povName(snapshot.exchange, scene);
  if (pov) {
    const who = meta.createSpan({ cls: 'writeller-pov', attr: { title: tr('Perspektive') } });
    who.createSpan({ cls: 'writeller-avatar is-character is-small', text: initials(pov), attr: { 'aria-hidden': 'true' } }); who.createSpan({ text: pov });
  }
  meta.createSpan({ cls: 'writeller-faint', text: tr`${formatCount(writingWordCount(scene.content.text))} Wörter` });
  if (scene.tensionLevel !== null) tensionMeter(meta, scene.tensionLevel);
}
