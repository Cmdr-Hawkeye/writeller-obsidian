import { tr } from '../i18n/translate';
import type { CommandContext } from './command-context';
import type { WritingCommands } from './writing-commands';
import { discoverNotes, suggestNote, type NoteCandidate } from '../projects/note-discovery';
import { writingKinds } from '../objects/kinds';
import { choose } from './dialogs';
import { fail } from '../domain/diagnostics';

/** Turns a reviewed folder suggestion into an explicit form submission, never a silent import. */
export async function adoptNote(ctx: CommandContext, writing: WritingCommands, candidate: NoteCandidate, otherKind = false): Promise<void> {
  await ctx.service.index.rebuild();
  const current = suggestNote(ctx.service.index, candidate.path, candidate.projectId);
  if (!current || ctx.active(candidate.path) || !ctx.service.vault.files().some(file => file.markdown && file.path === candidate.path)) fail('LOCAL_CHANGED', tr('Die Notiz oder ihre Projektzuordnung hat sich geändert. Bitte die Übersicht aktualisieren.'));
  const kind = otherKind ? await choose(ctx.app, tr('Als welche Notizart übernehmen?'), writingKinds.filter(k => k.id !== 'relationship')
    .map(k => ({ label: k.singular, value: k.id }))) : current.kindId;
  if (kind) await writing.add(kind, current.projectId, current.chapterId, current.path);
}
/** Exposes files created with native Obsidian actions alongside their proposed writing types. */
export function renderUnassigned(parent: HTMLElement, candidates: NoteCandidate[], ctx: CommandContext, writing: WritingCommands, run: (action: () => Promise<void>) => void): void {
  if (!candidates.length) return;
  const section = parent.createEl('section', { cls: 'writeller-unassigned', attr: { 'aria-label': tr('Noch nicht zugeordnete Notizen') } });
  section.createEl('h3', { text: tr`Noch nicht im Schreibprojekt · ${candidates.length}` });
  section.createEl('p', { cls: 'writeller-muted', text: tr('Diese Markdown-Dateien liegen im Projektordner. Übernimm sie einmal als passende Notizart, damit sie in der Übersicht und im Export enthalten sind.') });
  for (const candidate of candidates) {
    const row = section.createDiv({ cls: 'writeller-unassigned-row' }), info = row.createDiv();
    info.createEl('button', { cls: 'writeller-note-title', text: candidate.title }).addEventListener('click', () => run(() => ctx.open(candidate.path)));
    info.createEl('small', { cls: 'writeller-muted', text: candidate.path });
    if (candidate.ambiguousProject) info.createEl('small', { text: tr('Mehrere Projekte nutzen diesen Ordner. Prüfe den Projektnamen im Formular.') });
    const kind = writingKinds.find(k => k.id === candidate.kindId)!;
    row.createEl('button', { text: tr`Als ${kind.singular} übernehmen` }).addEventListener('click', () => run(() => adoptNote(ctx, writing, candidate)));
    row.createEl('button', { cls: 'writeller-text-button', text: tr('Andere Notizart…') }).addEventListener('click', () => run(() => adoptNote(ctx, writing, candidate, true)));
  }
}
/** Requires a conscious decision when ordinary project-folder notes would otherwise be omitted. */
export async function reviewExportCoverage(ctx: CommandContext, projectId: string): Promise<boolean> {
  const candidates = discoverNotes(ctx.service.vault, ctx.service.index, projectId);
  if (!candidates.length) return true;
  const count = candidates.length, noun = count === 1 ? tr('Notiz ist') : tr('Notizen sind');
  const choice = await choose(ctx.app, tr`${count} ${noun} noch nicht zugeordnet: ${candidates.slice(0, 3).map(c => c.title).join(', ')}`, [
    { label: tr('Zuerst in der Schreibübersicht zuordnen'), value: 'review' },
    { label: tr`Nur zugeordnete Notizen exportieren (${count} gewöhnliche ${count === 1 ? tr('Notiz') : tr('Notizen')} auslassen)`, value: 'skip' }
  ]);
  if (choice === 'review') await ctx.openProjectView?.(projectId);
  return choice === 'skip';
}
