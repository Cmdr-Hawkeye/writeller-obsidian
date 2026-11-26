import { tr } from '../i18n/translate';
import type { Snapshot } from '../projects/snapshot';
import type { Chapter, Exchange, Scene } from '../domain/types';
import { recordKey } from '../domain/records';
import { compareOrder, manuscriptOrder } from '../domain/order';
import { statusLabels } from '../objects/kinds';
import { entryMenu, formatCount, iconButton, labelButton, notePath, planningItems, planningKinds, povName, statusBadge, statusTone,
  tensionMeter, writingWordCount, type ProjectActions } from './project-sections';
import { renderWorldGroups } from './world';

/** Display-only layout choice of one open view; never written to notes or exports. */
export interface WorkbenchState { tab: 'manuscript' | 'world' }

/** Variant B: status cards, a sortable-looking manuscript table and the world in a second tab. */
export function renderWorkbench(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions, state: WorkbenchState): void {
  const pkg = snapshot.exchange, root = parent.createDiv({ cls: 'writeller-workbench' });
  const cards = root.createDiv({ cls: 'writeller-cards' });
  continueCard(cards, snapshot, actions); progressCard(cards, pkg, actions); structureCard(cards, pkg);
  const worldCount = planningKinds().reduce((sum, kind) => sum + planningItems(pkg, kind).length, 0);
  const tabs = root.createDiv({ cls: 'writeller-tabs', attr: { role: 'tablist', 'aria-label': tr('Projektbereiche') } });
  const manuscript = root.createDiv({ cls: 'writeller-manuscript writeller-tab-panel', attr: { role: 'tabpanel', id: 'writeller-panel-manuscript' } });
  const world = root.createDiv({ cls: 'writeller-planning writeller-tab-panel', attr: { role: 'tabpanel', id: 'writeller-panel-world' } });
  const panels = { manuscript, world }, buttons: HTMLButtonElement[] = [];
  const select = (tab: WorkbenchState['tab']): void => {
    state.tab = tab;
    for (const button of buttons) button.setAttribute('aria-selected', String(button.dataset['tab'] === tab));
    for (const [key, panel] of Object.entries(panels)) panel.toggleAttribute('hidden', key !== tab);
  };
  for (const [tab, label, count] of [['manuscript', tr('Manuskript'), null], ['world', tr('Figuren, Welt und Ideen'), worldCount]] as const) {
    const button = tabs.createEl('button', { cls: 'writeller-tab', attr: { type: 'button', role: 'tab', 'data-tab': tab, 'aria-controls': `writeller-panel-${tab}` } });
    button.createSpan({ text: label }); if (count !== null) button.createSpan({ cls: 'writeller-count', text: String(count) });
    button.addEventListener('click', () => select(tab)); buttons.push(button);
  }
  manuscriptTable(manuscript, snapshot, actions); renderWorldGroups(world, snapshot, actions); select(state.tab);
}

/** Primary writing entry: the last scene in manuscript order, otherwise the first scene to create. */
function continueCard(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions): void {
  const pkg = snapshot.exchange, scene = manuscriptOrder(pkg).at(-1), card = parent.createDiv({ cls: 'writeller-card is-continue' });
  card.createDiv({ cls: 'writeller-label', text: tr('Weiterschreiben') });
  const path = scene ? notePath(snapshot, { collection: 'scenes', record: scene }) : undefined;
  if (scene) {
    card.createDiv({ cls: 'writeller-card-title', text: scene.title });
    const chapter = pkg.chapters.find(c => c.id === scene.chapterId);
    card.createDiv({ cls: 'writeller-muted', text: [chapter?.title ?? tr('Ohne Kapitel'), tr`${formatCount(writingWordCount(scene.content.text))} Wörter`].join(' · ') });
  } else card.createDiv({ cls: 'writeller-card-title', text: tr('Noch keine Szene') });
  const row = card.createDiv({ cls: 'writeller-card-actions' });
  labelButton(row, 'pen-line', path ? tr('Szene öffnen') : tr('Szene hinzufügen'), () => path ? actions.open(path) : actions.add('scene', scene?.chapterId ?? undefined), 'mod-cta');
  if (path) labelButton(row, 'plus', tr('Neue Szene'), () => actions.add('scene', scene?.chapterId ?? undefined));
}

/** Word goal as a ring; without a goal the total is shown with a direct way to set one. */
function progressCard(parent: HTMLElement, pkg: Exchange, actions: ProjectActions): void {
  const total = pkg.scenes.reduce((sum, s) => sum + writingWordCount(s.content.text), 0), target = pkg.project.wordTarget, card = parent.createDiv({ cls: 'writeller-card is-progress' });
  if (target) {
    const percent = Math.min(100, Math.floor(total / target * 100));
    const ring = card.createDiv({ cls: 'writeller-ring', attr: { role: 'img', 'aria-label': tr`${percent} Prozent des Schreibziels` } });
    ring.style.setProperty('--writeller-progress', String(Math.max(percent, total ? 1 : 0)));
    ring.createSpan({ text: `${percent} %` });
  }
  const text = card.createDiv();
  text.createDiv({ cls: 'writeller-label', text: target ? tr('Schreibziel') : tr('Geschrieben') });
  text.createDiv({ cls: 'writeller-figure', text: formatCount(total) });
  if (target) text.createDiv({ cls: 'writeller-muted', text: tr`von ${formatCount(target)} · noch ${formatCount(Math.max(0, target - total))}` });
  else text.createEl('button', { cls: 'writeller-link-button', text: tr('Schreibziel festlegen'), attr: { type: 'button' } }).addEventListener('click', () => actions.details(recordKey('project', pkg.project.id)));
}

/** Counts plus the share of scenes per status tone; unknown statuses are counted, not renamed. */
function structureCard(parent: HTMLElement, pkg: Exchange): void {
  const card = parent.createDiv({ cls: 'writeller-card is-structure' });
  card.createDiv({ cls: 'writeller-label', text: tr('Struktur') });
  const figures = card.createDiv({ cls: 'writeller-figures' });
  const world = planningKinds().reduce((sum, kind) => sum + planningItems(pkg, kind).length, 0);
  for (const [value, label] of [[pkg.chapters.length, tr('Kapitel')], [pkg.scenes.length, tr('Szenen')], [world, tr('Weltobjekte')]] as const) {
    const cell = figures.createDiv(); cell.createDiv({ cls: 'writeller-figure', text: formatCount(value) }); cell.createDiv({ cls: 'writeller-faint', text: label });
  }
  if (!pkg.scenes.length) return;
  const byStatus = new Map<string, number>();
  for (const scene of pkg.scenes) byStatus.set(scene.status, (byStatus.get(scene.status) ?? 0) + 1);
  const legend = [...byStatus].map(([status, count]) => `${formatCount(count)} ${Object.hasOwn(statusLabels, status) ? statusLabels[status] : status}`).join(' · ');
  const bar = card.createDiv({ cls: 'writeller-status-bar', attr: { role: 'img', 'aria-label': legend } });
  for (const [status, count] of byStatus) bar.createSpan({ cls: statusTone(status) }).style.setProperty('flex-grow', String(count));
  card.createDiv({ cls: 'writeller-faint', text: legend });
}

/** Chapters as group rows, scenes with their existing planning fields; empty project keeps the first-step prompts. */
function manuscriptTable(parent: HTMLElement, snapshot: Snapshot, actions: ProjectActions): void {
  const pkg = snapshot.exchange, head = parent.createDiv({ cls: 'writeller-section-heading is-end' });
  labelButton(head, 'plus', tr('Kapitel'), () => actions.add('chapter'), 'writeller-quiet').setAttribute('aria-label', tr('Kapitel hinzufügen'));
  if (!pkg.chapters.length && !pkg.scenes.length) {
    const empty = parent.createDiv({ cls: 'writeller-empty' });
    empty.createEl('p', { text: tr('Hier wächst deine Geschichte.') });
    empty.createEl('p', { cls: 'writeller-muted', text: tr('Lege dein erstes Kapitel an. Die Szenen werden darin als normale Markdown-Notizen abgelegt.') });
    empty.createEl('button', { text: tr('Erstes Kapitel hinzufügen'), cls: 'mod-cta' }).addEventListener('click', () => actions.add('chapter'));
    empty.createEl('button', { text: tr('Mit einer Szene beginnen'), cls: 'writeller-text-button' }).addEventListener('click', () => actions.add('scene'));
    return;
  }
  const table = parent.createDiv({ cls: 'writeller-table-scroll' }).createEl('table', { cls: 'writeller-table' });
  const header = table.createEl('thead').createEl('tr');
  for (const label of [tr('Szene'), tr('Stand'), tr('Perspektive'), tr('Spannung'), tr('Wörter')]) header.createEl('th', { text: label, attr: { scope: 'col' } });
  header.createEl('th', { attr: { scope: 'col', 'aria-label': tr('Aktionen') } });
  const body = table.createEl('tbody'), scenes = manuscriptOrder(pkg), depths = new Map<string, number>();
  for (const scene of scenes) depths.set(scene.id, scene.parentSceneId ? (depths.get(scene.parentSceneId) ?? 0) + 1 : 0);
  for (const [index, chapter] of [...pkg.chapters].sort(compareOrder).entries()) {
    const children = scenes.filter(s => s.chapterId === chapter.id);
    chapterRow(body, snapshot, chapter, index, children, actions);
    for (const scene of children) sceneRow(body, snapshot, scene, depths.get(scene.id) ?? 0, actions);
    if (!children.length) body.createEl('tr', { cls: 'writeller-add-row' }).createEl('td', { attr: { colspan: '6' } })
      .createEl('button', { cls: 'writeller-empty-row', text: tr('Erste Szene hinzufügen'), attr: { type: 'button' } }).addEventListener('click', () => actions.add('scene', chapter.id));
  }
  const loose = scenes.filter(s => s.chapterId === null);
  if (loose.length) {
    body.createEl('tr', { cls: 'writeller-chapter-row' }).createEl('th', { text: tr('Szenen ohne Kapitel'), attr: { colspan: '6', scope: 'rowgroup' } });
    for (const scene of loose) sceneRow(body, snapshot, scene, depths.get(scene.id) ?? 0, actions);
  }
}

/** Chapter heading row with its word sum and chapter actions. */
function chapterRow(body: HTMLElement, snapshot: Snapshot, chapter: Chapter, index: number, scenes: Scene[], actions: ProjectActions): void {
  const row = body.createEl('tr', { cls: 'writeller-chapter-row' }), cell = row.createEl('th', { attr: { colspan: '4', scope: 'rowgroup' } });
  const path = notePath(snapshot, { collection: 'chapters', record: chapter });
  cell.createSpan({ cls: 'writeller-ordinal', text: String(index + 1).padStart(2, '0') });
  const label = cell.createEl('button', { cls: 'writeller-note-title', text: chapter.title, attr: { type: 'button' } });
  if (path) label.addEventListener('click', () => actions.open(path));
  row.createEl('td', { cls: 'writeller-number', text: formatCount(scenes.reduce((sum, s) => sum + writingWordCount(s.content.text), 0)) });
  const tools = row.createEl('td', { cls: 'writeller-row-tools' });
  iconButton(tools, 'plus', tr`Szene zu „${chapter.title}“ hinzufügen`, () => actions.add('scene', chapter.id));
  const more = iconButton(tools, 'ellipsis', tr`Aktionen für „${chapter.title}“`, () => entryMenu({ collection: 'chapters', record: chapter }, actions, more));
}

/** One scene row; the summary is shown verbatim as plain text. */
function sceneRow(body: HTMLElement, snapshot: Snapshot, scene: Scene, depth: number, actions: ProjectActions): void {
  const path = notePath(snapshot, { collection: 'scenes', record: scene });
  if (!path) return;
  const row = body.createEl('tr', { cls: 'writeller-scene-row' }), main = row.createEl('td');
  main.style.setProperty('--writeller-depth', String(Math.min(depth, 8)));
  main.createEl('button', { cls: 'writeller-note-title', text: scene.title, attr: { type: 'button' } }).addEventListener('click', () => actions.open(path));
  main.createDiv({ cls: scene.summary ? 'writeller-summary' : 'writeller-summary is-missing', text: scene.summary || tr('Noch keine Kurzbeschreibung') });
  statusBadge(row.createEl('td'), scene.status);
  const pov = povName(snapshot.exchange, scene);
  row.createEl('td', { cls: pov ? '' : 'writeller-faint', text: pov ?? '—' });
  tensionMeter(row.createEl('td'), scene.tensionLevel);
  const words = writingWordCount(scene.content.text);
  row.createEl('td', { cls: 'writeller-number', text: scene.estimatedWordTarget ? `${formatCount(words)} / ${formatCount(scene.estimatedWordTarget)}` : formatCount(words) });
  const tools = row.createEl('td', { cls: 'writeller-row-tools' });
  const more = iconButton(tools, 'ellipsis', tr`Aktionen für „${scene.title}“`, () => entryMenu({ collection: 'scenes', record: scene }, actions, more));
}
