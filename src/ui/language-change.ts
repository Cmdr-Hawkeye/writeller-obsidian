import { getLanguage, MarkdownView, Notice } from 'obsidian';
import type { CommandContext } from './command-context';
import { confirmPreview } from './dialogs';
import { planLanguage } from '../projects/language-plan';
import { LanguageJournalService } from '../storage/language-journal';
import { resolveLanguage, setLanguage, language, type LanguagePreference } from '../i18n/language';
import { validateSettings } from './settings';
import { tr } from '../i18n/translate';
import { isBelow } from '../storage/paths';
import { translatedRoot } from '../i18n/folders';

/** Applies one user-selected preference and a recoverable folder plan as one serialized UI action. */
export async function changeWritingLanguage(ctx: CommandContext, preference: LanguagePreference, save: () => Promise<void>, initial = false): Promise<boolean> {
  const settings = ctx.service.settings, previous = { ...settings }, previousLanguage = language();
  const locale = resolveLanguage(preference, getLanguage());
  await ctx.service.index.rebuild();
  const roots = ctx.service.index.manifests().map(note => note.path.split('/').slice(0, -1).join('/')).filter(Boolean);
  if (translatedRoot(settings.projectFolder, 'projects', locale) !== settings.projectFolder) roots.push(settings.projectFolder);
  if (translatedRoot(settings.exchangeFolder, 'exports', locale) !== settings.exchangeFolder) roots.push(settings.exchangeFolder);
  // Flush only affected editor buffers. An unrelated open note is outside this operation.
  for (const leaf of ctx.app.workspace.getLeavesOfType('markdown')) {
    const view = leaf.view;
    if (view instanceof MarkdownView && view.file && (ctx.active(view.file.path) || roots.some(root => isBelow(view.file!.path, root))) && view.getViewData() !== view.data) await view.save(false);
  }
  const plan = await planLanguage(ctx.service, locale); plan.settings.language = preference; validateSettings(plan.settings);
  if (plan.moves.length && !await confirmPreview(ctx.app, tr('Sprache und Ordner wechseln'), [
    tr`${plan.moves.length} Strukturordner werden umbenannt. Eigene Ordnernamen und .md-Dateinamen bleiben erhalten.`,
    ...plan.moves.map(move => `${move.from} → ${move.to}`), tr('Keine Notizdatei wird umbenannt. Inhalte, eigene Eigenschaften und Projektidentitäten bleiben erhalten.')
  ])) return false;
  try {
    await new LanguageJournalService(ctx.service.vault).commit(plan, previous, async () => {
      Object.assign(settings, plan.settings); setLanguage(locale); await save();
    });
  } catch (error) { Object.assign(settings, previous); setLanguage(previousLanguage); throw error; }
  ctx.service.index.invalidate(); await ctx.service.index.rebuild();
  for (const listener of ctx.changed) listener();
  if (!initial) new Notice(tr('Sprache geändert.'));
  return true;
}
