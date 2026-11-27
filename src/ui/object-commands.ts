import { tr } from '../i18n/translate';
import { Notice } from 'obsidian';
import { entries, recordKey, title } from '../domain/records';
import { kindFor, namedChoices } from '../objects/kinds';
import type { Detachment } from '../objects/detach';
import { inspectReferences, planObjectDeletion, planReferenceRepair, trashRemoved, type RemovalPlan } from '../projects/object-removal';
import type { CommandContext } from './command-context';
import { choose, confirmPreview } from './dialogs';

/** Readable consequences of cleaning references; empty counts are left out. */
function consequences(d: Detachment, skip = 0): string[] {
  const lines: string[] = [], related = d.removed.length - skip;
  if (d.pov) lines.push(tr`${d.pov} Szenen verlieren ihre Perspektive.`);
  if (d.placement) lines.push(tr`${d.placement} Zuordnungen zu Kapiteln oder übergeordneten Szenen werden gelöst.`);
  if (related > 0) lines.push(tr`${related} Beziehungen werden mit entfernt.`);
  if (d.targets) lines.push(tr`${d.targets} Notizen verlieren ihr verknüpftes Objekt.`);
  if (d.links) lines.push(tr`${d.links} Verweise im Text werden zu normalem Text.`);
  return lines;
}

/** Regular deletion and reference repair for single writing objects. */
export class ObjectCommands {
  /** Uses the shared, journal-backed save path; nothing is written before confirmation. */
  constructor(private readonly ctx: CommandContext) {}
  /** Deletes one object, cleans every reference in one save and moves its note to the trash. */
  async delete(projectId?: string, key?: string): Promise<void> {
    const active = this.ctx.active(), id = projectId ?? active?.projectId;
    const target = key ?? (active ? recordKey(active.collection, active.id) : undefined);
    if (!id || !target || target.startsWith('project/')) return;
    await this.ctx.flushEditors(id);
    const plan = await planObjectDeletion(this.ctx.service, id, target);
    const entry = entries(plan.preview.source!.exchange).find(e => recordKey(e.collection, e.record.id) === target)!;
    const label = tr`${kindFor(entry).singular} „${title(entry.record)}“`;
    const lines = [...consequences(plan.detachment, 1), tr('Die Notiz kommt in den Papierkorb, wie in Obsidian eingestellt. Die gesicherten Daten bleiben erhalten; mit „Fehlende Verweise reparieren“ lässt sich das Objekt wiederherstellen.')];
    if (!await confirmPreview(this.ctx.app, tr`${label} löschen`, [...lines, ...new Set(plan.preview.warnings.map(w => w.message))])) return;
    await this.apply(plan, tr`${label} wurde gelöscht.`);
  }
  /** Restores deleted objects or removes references to them; the choice stays with the user. */
  async repair(projectId?: string, mode?: 'restore' | 'detach'): Promise<void> {
    const id = projectId ?? this.ctx.active()?.projectId ?? this.ctx.selectedProjectId ?? await this.pickProject(); if (!id) return;
    await this.ctx.flushEditors(id);
    const found = await inspectReferences(this.ctx.service, id);
    if (!found.missing.length && !found.invalid) { new Notice(tr('Keine fehlenden Verweise gefunden.')); return; }
    let restore = mode === 'restore';
    if (!mode && found.restorable.length) {
      const choice = await choose(this.ctx.app, tr('Wie soll repariert werden?'), [
        { label: tr`Gelöschte Objekte wiederherstellen (${found.restorable.length})`, value: 'restore' as const },
        { label: tr('Verweise auf fehlende Objekte entfernen'), value: 'detach' as const }]);
      if (!choice) return; restore = choice === 'restore';
    }
    const plan = await planReferenceRepair(this.ctx.service, id, restore), names = plan.restored.map(k => {
      const record = found.snapshot.records.get(k)?.record; return record ? `„${title(record)}“` : k;
    });
    const lines = [...(names.length ? [tr`Wiederhergestellt: ${names.join(', ')}`] : []),
      ...(plan.moved.length ? [tr('Der alte Dateiname ist belegt; die Wiederherstellung erhält einen neuen Namen. Eine dort neu angelegte leere Datei kannst du danach löschen.')] : []),
      ...consequences(plan.detachment)];
    if (restore && !found.restorable.length) lines.unshift(tr('Für die fehlenden Objekte sind keine gesicherten Daten vorhanden. Es werden nur die Verweise entfernt.'));
    if (!await confirmPreview(this.ctx.app, tr('Fehlende Verweise reparieren'), [...lines, ...new Set(plan.preview.warnings.map(w => w.message))])) return;
    await this.apply(plan, tr('Das Projekt ist wieder vollständig.'));
  }
  /** Commits the checked plan, then trashes removed notes and refreshes every listener. */
  private async apply(plan: RemovalPlan, message: string): Promise<void> {
    await this.ctx.save(plan.preview);
    await trashRemoved(this.ctx.service, plan);
    for (const listener of this.ctx.changed) listener();
    new Notice(message);
  }
  /** Asks only when several projects exist. */
  private async pickProject(): Promise<string | null> {
    const manifests = this.ctx.service.index.manifests();
    if (manifests.length <= 1) return manifests[0]?.projectId ?? null;
    return (await choose(this.ctx.app, tr('Für welches Schreibprojekt?'), namedChoices(manifests, n => String(n.properties['writeller-title']))))?.projectId ?? null;
  }
}
