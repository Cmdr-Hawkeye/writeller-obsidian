import { Notice, MarkdownView } from 'obsidian';
import { planOrganization, organizationFresh } from '../projects/organize-plan';
import { LayoutJournalService } from '../storage/layout-journal';
import { fail } from '../domain/diagnostics';
import { confirmPreview } from './dialogs';
import type { CommandContext } from './command-context';

/** Explicit upgrade for older hashed paths; no automatic project reorganisation on plugin load. */
export async function organizeProject(ctx: CommandContext, projectId?: string): Promise<void> {
  const snapshot = await ctx.project(projectId); if (!snapshot) return;
  const plan = await planOrganization(ctx.service.vault, ctx.service.index, snapshot, ctx.service.settings);
  if (!plan.moves.length && !plan.writes.length) { new Notice('Die Projektdateien sind bereits lesbar geordnet.'); return; }
  const lines = [`${snapshot.exchange.project.title}: ${plan.moves.length} Notizen werden lesbar benannt und nach Kapiteln, Figuren, Orten und weiteren Notizarten abgelegt.`,
    'Texte, eigene Eigenschaften und Projektzugehörigkeit bleiben erhalten. Nur zugeordnete Projektdateien werden umgeordnet.',
    ...plan.moves.slice(0, 8).map(m => m.to), 'Vor dem Umordnen werden die Originale für eine mögliche Wiederherstellung gesichert.'];
  if (!await confirmPreview(ctx.app, 'Projektdateien lesbar ordnen', lines)) return;
  await ctx.app.workspace.getActiveViewOfType(MarkdownView)?.save(false);
  if (!await organizationFresh(ctx.service.vault, ctx.service.index, plan)) fail('LOCAL_CHANGED', 'Das Projekt wurde seit der Vorschau verändert. Bitte erneut ordnen.');
  await new LayoutJournalService(ctx.service.vault).commit(plan); await ctx.service.index.rebuild();
  for (const listener of ctx.changed) listener();
  new Notice('Deine Projektdateien sind jetzt lesbar geordnet.');
}
