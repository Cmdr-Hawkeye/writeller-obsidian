import { Notice } from 'obsidian';
import type { CommandContext } from './command-context';
import { planDeletion } from '../projects/deletion';
import { DeletionJournalService } from '../storage/deletion-journal';
import { writingForm } from './form';
import { withActivity } from './activity';
import { fail } from '../domain/diagnostics';
import { tr } from '../i18n/translate';

/** Offers a concrete named-project confirmation; cancellation performs no storage writes. */
export async function deleteProject(ctx: CommandContext, projectId?: string): Promise<void> {
  const snapshot = await ctx.project(projectId, projectId === undefined); if (!snapshot) return;
  const plan = await withActivity(tr('Löschen vorbereiten…'), () => planDeletion(ctx.service, snapshot.state.projectId));
  const name = plan.snapshot.exchange.project.title;
  const confirmed = await writingForm(ctx.app, tr`„${name}“ löschen?`, [
    { key: 'confirmation', label: tr('Projektnamen zur Bestätigung eingeben'), required: true,
      description: tr`${plan.noteCount} zugeordnete Notizen und ihre Projektdaten werden gelöscht. Nicht zugeordnete Dateien und vorhandene Exporte bleiben erhalten.` },
    { key: 'notice', label: tr('Löschen folgt deiner Obsidian-Einstellung für gelöschte Dateien. Bei einer Unterbrechung bleiben Originale zur Wiederherstellung gesichert.'), kind: 'message' }
  ], tr('Projekt löschen'), values => {
    if (values['confirmation'] !== name) fail('INVALID_FIELD', tr('Bitte den Projektnamen genau wie oben eingeben.'));
  }, true);
  if (!confirmed) return;
  await ctx.flushEditors(plan.snapshot.state.projectId, plan.files.keys());
  await withActivity(tr('Projekt wird gelöscht…'), () => new DeletionJournalService(ctx.service.vault).commit(ctx.service, plan));
  if (ctx.selectedProjectId === plan.snapshot.state.projectId) ctx.selectedProjectId = null;
  for (const listener of ctx.changed) listener();
  await ctx.openProjectView?.(); new Notice(tr`„${name}“ wurde gelöscht.`);
}
