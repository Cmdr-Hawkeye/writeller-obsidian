import { tr } from '../i18n/translate';
import { setIcon } from 'obsidian';
import type { Snapshot } from '../projects/snapshot';
import type { Entry } from '../domain/types';
import { title } from '../domain/records';
import type { WritingKind } from '../objects/kinds';
import { addMenu, entryMenu, formatCount, iconButton, initials, notePath, noteRow, planningItems, planningKinds, sceneAppearances, type ProjectActions } from './project-sections';

/** Display-only filter of the world drawer; it survives re-rendering but is never stored in records. */
export interface WorldFilter { query: string; kind: string }

/** Workbench tab: one card per concept, filled groups open, empty ones quiet and closed. */
export function renderWorldGroups(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions): void {
  const grid = parent.createDiv({ cls: 'writeller-world-grid' });
  for (const kind of planningKinds()) {
    const items = planningItems(snapshot.exchange, kind);
    const group = grid.createEl('details', { cls: `writeller-kind-group${items.length ? '' : ' is-empty'}` }); group.open = items.length > 0;
    const summary = group.createEl('summary');
    setIcon(summary.createSpan({ cls: 'writeller-kind-icon', attr: { 'aria-hidden': 'true' } }), kind.icon);
    const label = summary.createSpan({ cls: 'writeller-kind-label' }); label.createSpan({ text: kind.plural });
    label.createSpan({ cls: 'writeller-count', text: String(items.length) });
    iconButton(summary, 'plus', tr`${kind.singular} hinzufügen`, () => actions.add(kind.id)).addEventListener('click', e => e.preventDefault());
    for (const entry of items) noteRow(group, snapshot, entry, actions);
    if (!items.length) group.createEl('p', { cls: 'writeller-muted writeller-kind-empty', text: tr('Noch nichts angelegt.') });
  }
}

/** Storyboard drawer: searchable list of every planning object with scene appearances. */
export function renderWorldDrawer(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions, filter: WorldFilter): void {
  const head = parent.createDiv({ cls: 'writeller-drawer-head' });
  head.createEl('h3', { text: tr('Figuren, Welt und Ideen') });
  const add = iconButton(head, 'plus', tr('Hinzufügen…'), () => addMenu(add, actions));
  const groups = planningKinds().map(kind => ({ kind, items: planningItems(snapshot.exchange, kind) })).filter(g => g.items.length);
  if (!groups.length) { quickAdd(parent, actions); return; }
  if (!groups.some(g => g.kind.id === filter.kind)) filter.kind = '';
  const search = parent.createEl('input', { cls: 'writeller-search', attr: { type: 'search', placeholder: tr('Figuren, Orte, Notizen …'), 'aria-label': tr('Figuren, Welt und Ideen durchsuchen') } });
  search.value = filter.query;
  const chips = parent.createDiv({ cls: 'writeller-chips', attr: { role: 'group', 'aria-label': tr('Nach Art filtern') } });
  const list = parent.createDiv({ cls: 'writeller-drawer-list' });
  const rendered = groups.map(g => renderGroup(list, snapshot, actions, g.kind, g.items));
  const empty = list.createEl('p', { cls: 'writeller-muted', text: tr('Keine Treffer.') });
  const apply = (): void => {
    const query = filter.query.trim().toLocaleLowerCase();
    let visible = 0;
    for (const group of rendered) {
      const kindMatch = !filter.kind || filter.kind === group.kind;
      let shown = 0;
      for (const item of group.items) { const match = kindMatch && (!query || item.name.includes(query)); item.el.toggleAttribute('hidden', !match); if (match) shown++; }
      group.el.toggleAttribute('hidden', shown === 0); visible += shown;
    }
    empty.toggleAttribute('hidden', visible > 0);
    for (const chip of chips.querySelectorAll<HTMLButtonElement>('button')) chip.setAttribute('aria-pressed', String(chip.dataset['kind'] === filter.kind));
  };
  for (const option of [{ id: '', label: tr('Alle') }, ...groups.map(g => ({ id: g.kind.id, label: g.kind.plural }))]) {
    const chip = chips.createEl('button', { cls: 'writeller-chip', text: option.label, attr: { type: 'button', 'data-kind': option.id } });
    chip.addEventListener('click', () => { filter.kind = option.id; apply(); });
  }
  search.addEventListener('input', () => { filter.query = search.value; apply(); });
  apply();
}

/** One titled block of drawer entries; names are lower-cased once for filtering. */
function renderGroup(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions, kind: WritingKind, items: Entry[]): { kind: string; el: HTMLElement; items: { name: string; el: HTMLElement }[] } {
  const el = parent.createDiv({ cls: 'writeller-drawer-group' });
  el.createEl('h4', { text: kind.plural });
  const rows: { name: string; el: HTMLElement }[] = [];
  for (const entry of items) {
    const path = notePath(snapshot, entry);
    if (!path) continue;
    const name = title(entry.record), row = el.createDiv({ cls: 'writeller-entity' });
    const avatar = row.createSpan({ cls: `writeller-avatar is-${kind.id}`, attr: { 'aria-hidden': 'true' } });
    if (kind.id === 'character') avatar.setText(initials(name)); else setIcon(avatar, kind.icon);
    const text = row.createDiv({ cls: 'writeller-entity-text' });
    text.createEl('button', { cls: 'writeller-note-title', text: name, attr: { type: 'button' } }).addEventListener('click', () => actions.open(path));
    const count = entry.collection === 'catalogItems' ? sceneAppearances(snapshot.exchange, entry.record.id) : 0;
    if (count) text.createDiv({ cls: 'writeller-faint', text: count === 1 ? tr('in 1 Szene') : tr`in ${formatCount(count)} Szenen` });
    const more = iconButton(row, 'ellipsis', tr`Aktionen für „${name}“`, () => entryMenu(entry, actions, more));
    rows.push({ name: name.toLocaleLowerCase(), el: row });
  }
  return { kind: kind.id, el, items: rows };
}

/** Empty world: direct creation buttons instead of a list of zero counters. */
function quickAdd(parent: HTMLElement, actions: ProjectActions): void {
  const box = parent.createDiv({ cls: 'writeller-quick-add' });
  box.createEl('p', { cls: 'writeller-strong', text: tr('Noch leer') });
  box.createEl('p', { cls: 'writeller-muted', text: tr('Lege an, was dein Text braucht: Figuren, Orte, Notizen oder Recherche.') });
  const grid = box.createDiv({ cls: 'writeller-quick-grid' });
  for (const kind of planningKinds()) {
    const button = grid.createEl('button', { cls: 'writeller-quick-kind', attr: { type: 'button', 'aria-label': tr`${kind.singular} hinzufügen` } });
    setIcon(button.createSpan({ cls: 'writeller-button-icon', attr: { 'aria-hidden': 'true' } }), kind.icon); button.createSpan({ text: kind.singular });
    button.addEventListener('click', () => actions.add(kind.id));
  }
}
