import { tr } from '../i18n/translate';
import { Notice } from 'obsidian';
import type { ExchangeRecord } from '../domain/types';
import { entries, title } from '../domain/records';
import { fail } from '../domain/diagnostics';
import { assertRecord } from '../exchange/schema';
import { parseJson } from '../exchange/parser';
import { previewRepair } from '../projects/repair';
import type { Decision } from '../transfer/import-plan';
import { CommandContext } from './command-context';
import { choose, confirmPreview, input } from './dialogs';
import { pendingJournals } from '../storage/recovery-index';
import { namedChoices } from '../objects/kinds';
import { reviewExportCoverage } from './unassigned-notes';

/** Manual transport workflows use visible vault files on both desktop and mobile. */
export class TransferCommands {
  /** Binds UI and the journal-backed domain service. */
  constructor(private readonly ctx: CommandContext) {}
  /** Selects only visible JSON files; old archives still reach the explicit version error. */
  private async importFile(): Promise<string | null> {
    const files = this.ctx.service.vault.files().filter(f => f.path.endsWith('.writeller-exchange.json') || f.path.endsWith('.writeller.json'));
    if (!files.length) { new Notice(tr('Projektdatei (.writeller-exchange.json) zuerst in einen beliebigen Ordner dieses Vaults kopieren. Danach hier auswählen.'), 12000); return null; }
    return choose(this.ctx.app, tr('Austauschdatei auswählen'), files.map(f => ({ label: f.path, value: f.path })));
  }
  /** Fully validates input, then requests explicit identity mode and every conflict decision. */
  async importProject(): Promise<void> {
    const path = await this.importFile(); if (!path) return;
    const pkg = await this.ctx.service.readImport(path);
    const mode = await choose(this.ctx.app, tr('Importziel und Identität'), [
      { label: tr('Neues Projekt'), value: 'new' as const }, { label: tr('Bekanntes Projekt aktualisieren'), value: 'update' as const },
      { label: tr('Als eigenständiges Projekt kopieren'), value: 'copy' as const }
    ]); if (!mode) return;
    let targetId: string | undefined;
    if (mode === 'update') {
      await this.ctx.service.index.rebuild();
      const chosen = await choose(this.ctx.app, tr('Welches Projekt möchtest du aktualisieren?'), namedChoices(this.ctx.service.index.manifests(), m => String(m.properties['writeller-title'])));
      if (!chosen) return; targetId = chosen.projectId;
    }
    const plan = await this.ctx.service.previewImport(pkg, mode, targetId), decisions = new Map<string, Decision>();
    for (const row of plan.rows.filter(r => r.action === 'conflict')) {
      const reason = { origin: tr('Abweichende Herkunft'), deleted: tr('Hier bereits gelöscht'), bothChanged: tr('Auf beiden Seiten geändert'), unknownBase: tr('Unterschiedliche Fassungen') };
      const choice = await choose(this.ctx.app, `${title(row.entry.record)} · ${row.reason ? reason[row.reason] : tr('Unterschiedliche Fassungen')}`, [
        { label: tr('Lokal behalten'), value: 'local' as const }, { label: tr('Eingehend übernehmen'), value: 'incoming' as const }, { label: tr('Manuell als JSON vereinigen'), value: 'merge' as const }
      ]); if (!choice) return;
      if (choice !== 'merge') { decisions.set(row.key, { choice }); continue; }
      let record: ExchangeRecord = row.entry.record;
      const json = await input(this.ctx.app, tr('Vereinigten vollständigen Datensatz prüfen'), JSON.stringify(row.local ?? row.entry.record, null, 2), true, async value => {
        const parsed = parseJson(value); assertRecord(parsed, row.entry.collection); record = parsed;
      }); if (json === null) return;
      decisions.set(row.key, { choice: 'merge', record });
    }
    let envelopeChoice: 'local' | 'incoming' | undefined;
    if (plan.envelopeConflict) {
      const choice = await choose(this.ctx.app, tr('Zusätzliche Projektangaben unterscheiden sich'), [{ label: tr('Meine Angaben behalten'), value: 'local' as const }, { label: tr('Importierte Angaben übernehmen'), value: 'incoming' as const }]);
      if (!choice) return; envelopeChoice = choice;
    }
    const preview = await this.ctx.service.resolve(plan, decisions, envelopeChoice);
    const counts = [['new', tr('Neu')], ['incoming', tr('Aktualisiert')], ['unchanged', tr('Unverändert')], ['local', tr('Lokal behalten')], ['conflict', tr('Mit deiner Entscheidung')]].map(([action, label]) => `${label}: ${plan.rows.filter(r => r.action === action).length}`);
    await this.ctx.commit(preview, tr('Projekt importieren'), [pkg.project.title, ...counts, tr`${pkg.attachments.length} Bilder. Zusätzliche Projektangaben bleiben erhalten.`]);
  }
  /** Asks for exactly one known partner when needed; then previews a uniquely named export. */
  async exportProject(projectId?: string): Promise<void> {
    const snapshot = await this.ctx.project(projectId, projectId === undefined); if (!snapshot) return;
    if (!await reviewExportCoverage(this.ctx, snapshot.state.projectId)) return;
    const peers = new Map([...snapshot.records.values()].flatMap(s => s.peerBaselines).map(b => [`${b.system}/${b.instanceId}`, { system: b.system, instanceId: b.instanceId }]));
    let peer: { system: string; instanceId: string } | null = null;
    if (peers.size === 1) peer = [...peers.values()][0]!;
    if (peers.size > 1) {
      const chosen = await choose(this.ctx.app, tr('Für welchen bisherigen Austausch?'), [...peers.values()].map((value, index) => ({ label: tr`${value.system} · Austausch ${index + 1}`, value })).concat([{ label: tr('Neuer Austausch'), value: { system: '', instanceId: '' } }]));
      if (!chosen) return; peer = chosen.system ? chosen : null;
    }
    const out = await this.ctx.service.previewExport(snapshot.exchange.project.id, peer);
    await this.ctx.commit(out.preview, tr('Exportvorschau'), [out.exchange.project.title, tr`Ausgabedatei: ${out.path}`, tr`Objekte: ${entries(out.exchange).length}; Bilder: ${out.exchange.attachments.length}.`,
      tr('Austauschdateien enthalten private Texte im Klartext. Export verändert keine Manuskripte.'),
      ...out.exchange.catalogItems.filter(r => !['character', 'location', 'object', 'timelineEvent', 'arc'].includes(r.type)).map(r => tr`Generisch erhaltener Typ: ${r.type}`)],
      tr`Export gespeichert im Vault:\n${out.path}`);
  }
  /** Repairs explicit missing metadata from an original file, retaining current note bodies. */
  async repairState(): Promise<void> {
    const path = await this.importFile(); if (!path) return;
    const original = await this.ctx.service.readImport(path), preview = await previewRepair(this.ctx.service, original);
    await this.ctx.commit(preview, tr('Begleitdaten aus Original reparieren'), [tr('Nur passende Identitäten werden repariert. Aktuelle Notizen bleiben erhalten. Abweichungen zum Original prüfen.')]);
  }
  /** Runs explicit journal recovery; foreign post-edits are reported rather than overwritten. */
  async recoverImport(): Promise<void> {
    const journals = await pendingJournals(this.ctx.service.vault);
    if (!journals.length) { new Notice(tr('Keine unvollständigen Journale vorhanden.')); return; }
    const selected = await choose(this.ctx.app, tr('Welchen Vorgang möchtest du wiederherstellen?'), journals.map((j, index) => {
      const name = this.ctx.service.index.manifests().find(m => m.projectId === j.projectId)?.properties['writeller-title'];
      return { label: tr`${String(name ?? (j.projectId === 'language' ? tr('Sprachwechsel') : tr('Schreibprojekt')))} · Vorgang ${index + 1}`, value: j };
    }));
    if (!selected || !await confirmPreview(this.ctx.app, tr('Wiederherstellung'), [tr('Nur unveränderte eigene Nachherstände werden zurückgerollt. Gesicherte Originale bleiben im Journal erhalten.')])) return;
    const result = await this.ctx.service.journal.recover(selected.path, selected.projectId);
    if (result.settings) { Object.assign(this.ctx.service.settings, result.settings); await this.ctx.savePreferences?.(); }
    if (result.conflicts.length) fail('LOCAL_CHANGED', tr`Wiederherstellung hat ${result.conflicts.length} Konflikte. Betroffene Dateien und journal.json mit den gesicherten Originalen manuell vergleichen. Nichts wurde fremd überschrieben.`);
    await this.ctx.service.index.rebuild(); new Notice(tr('Journal geprüft und wiederhergestellt.'));
  }
}
