import { tr } from '../i18n/translate';
import { Notice } from 'obsidian';
import { entries, recordKey, title } from '../domain/records';
import { kindFor, namedChoices } from '../objects/kinds';
import { isBelow } from '../storage/paths';
import { fail } from '../domain/diagnostics';
import { createAttachment } from '../exchange/images';
import { previewChangedAssets } from '../projects/assets';
import { CommandContext } from './command-context';
import { choose } from './dialogs';

/** Explicit image adoption never fetches, rescales or re-encodes a user's file. */
export class ImageCommands {
  /** Binds native selection and the shared transaction pipeline. */
  constructor(private readonly ctx: CommandContext) {}
  /** Fully validates a consciously selected vault PNG/JPEG, then previews its optional insertion. */
  async addImage(): Promise<void> {
    const snapshot = await this.ctx.project(); if (!snapshot) return;
    const files = this.ctx.service.vault.files().filter(f => /\.(?:png|jpe?g)$/i.test(f.path) && !isBelow(f.path, snapshot.root) && !isBelow(f.path, this.ctx.service.settings.dataFolder));
    if (!files.length) { new Notice(tr('PNG oder JPEG zuerst in den Vault kopieren. Maximal 2 MiB und 2400 × 2400 Pixel.')); return; }
    const path = await choose(this.ctx.app, tr('Bild bewusst aufnehmen'), files.map(f => ({ label: f.path, value: f.path }))); if (!path) return;
    const bytes = await this.ctx.service.vault.read(path); if (!bytes) fail('LOCAL_CHANGED', tr('Bilddatei fehlt.'));
    const image = await createAttachment(bytes, snapshot.exchange.project.id);
    if (!snapshot.exchange.attachments.some(a => a.id === image.id)) snapshot.exchange.attachments.push(image);
    const options = namedChoices(entries(snapshot.exchange).filter(e => 'content' in e.record), e => `${kindFor(e).singular} · ${title(e.record)}`)
      .map(c => ({ label: c.label, value: recordKey(c.value.collection, c.value.record.id) }));
    const target = await choose(this.ctx.app, tr('Bildverwendung (Einfügen stellt den Inhalt ausdrücklich auf Markdown um)'), [{ label: tr('Als unbenutztes Original erhalten'), value: 'unused' }, ...options]);
    if (!target) return;
    if (target !== 'unused') {
      const entry = this.ctx.service.entry(snapshot, target);
      if ('content' in entry.record) {
        entry.record.content.format = 'markdown'; entry.record.content.text += `\n\n![${tr('Bild')}](asset:${image.id}?width=70&align=center)\n`;
      }
    }
    const preview = await this.ctx.service.previewSave(snapshot.exchange, snapshot);
    preview.guards.set(path, bytes);
    await this.ctx.commit(preview, tr('Bild hinzufügen'), [tr`${image.width} × ${image.height} Pixel. Das Bild bleibt in Originalqualität erhalten.`, tr('Es werden keine externen Bilder geladen.')]);
  }
  /** Restores originals into new preserved paths and re-identifies all deliberately changed asset bytes. */
  async changedImages(): Promise<void> {
    const files = this.ctx.service.vault.files().filter(f => f.path.endsWith('.writeller-exchange.json'));
    const path = await choose(this.ctx.app, tr('Original-Exchange-Datei zur Bilderhaltung auswählen'), files.map(f => ({ label: f.path, value: f.path })));
    if (!path) return;
    const original = await this.ctx.service.readImport(path), preview = await previewChangedAssets(this.ctx.service, original);
    await this.ctx.commit(preview, tr('Geänderte Bilder aufnehmen'));
  }
}
