import { tr } from '../i18n/translate';
import type { Exchange, Attachment, Entry } from '../domain/types';
import { entries, clone, setEntry } from '../domain/records';
import { fail, warning } from '../domain/diagnostics';
import { createAttachment, decodeBase64 } from '../exchange/images';
import { sha256, now } from '../exchange/hash';
import { loadProjectState } from '../storage/state';
import { markdownInfo, linkWithUrl, replaceSpans } from '../mapping/markdown';
import { reverseBody } from '../mapping/projection';
import { snapshotProject } from './snapshot';
import type { TransferCoordinator, CommitPreview } from '../transfer/coordinator';

/** Previews new identities for changed image files while retaining original bytes from an explicit import. */
export async function previewChangedAssets(service: TransferCoordinator, original: Exchange): Promise<CommitPreview> {
  await service.index.rebuild(); service.index.assertClean();
  const projectId = original.project.id, manifest = service.index.find(projectId, 'project', projectId);
  const statePath = manifest?.properties['writeller-state-path'];
  if (typeof statePath !== 'string') fail('STATE_MISSING', tr('Passendes Projektmanifest fehlt.'));
  const state = await loadProjectState(service.vault, statePath, projectId), originals = new Map<string, Uint8Array>();
  const replacements = new Map<string, Attachment>();
  for (const asset of state.assets) {
    const bytes = await service.vault.read(asset.path);
    if (!bytes) fail('STATE_MISSING', tr('Bilddatei fehlt. Original-Import zur Reparatur verwenden.'));
    if (await sha256(bytes) === asset.id) continue;
    const preserved = original.attachments.find(a => a.id === asset.id);
    if (!preserved) fail('STATE_MISSING', tr('Original-Import enthält nicht alle veränderten Bildoriginale. Passende Sicherung auswählen.'));
    originals.set(asset.id, decodeBase64(preserved.data));
    replacements.set(asset.id, await createAttachment(bytes, projectId));
  }
  if (!replacements.size) fail('INVALID_FIELD', tr('Keine geänderten Assetdateien gefunden. Neues Bild über „Bild aufnehmen“ auswählen.'));
  const snapshot = await snapshotProject(service.vault, service.index, projectId, false, originals), pkg = clone(snapshot.exchange);
  for (const [oldId, image] of replacements) {
    if (!pkg.attachments.some(a => a.id === image.id)) pkg.attachments.push(image);
    const old = snapshot.state.assets.find(a => a.id === oldId)!;
    old.path = `${snapshot.root}/assets/originals/${oldId}.${old.mimeType === 'image/png' ? 'png' : 'jpg'}`;
  }
  for (const e of entries(pkg)) {
    if (!('content' in e.record) || e.record.content.format !== 'markdown') continue;
    const content = e.record.content, spans = markdownInfo(content.text).links.filter(l => l.image && replacements.has(l.url.slice(6, 70)));
    if (!spans.length) continue;
    const body = replaceSpans(content.text, spans.map(l => ({ start: l.start, end: l.end,
      text: linkWithUrl(l, `asset:${replacements.get(l.url.slice(6, 70))!.id}${l.url.slice(70)}`) })));
    const modified = await reverseBody(e.record, body, null, { entityUrl: () => null, assetHash: () => null });
    modified.record.updatedAt = now(); setEntry(pkg, { collection: e.collection, record: modified.record } as Entry);
  }
  const preview = await service.previewSave(pkg, snapshot);
  preview.warnings.push(warning('UNSUPPORTED_REPRESENTATION', tr`${replacements.size} geänderte Bilder erhalten neue Hash-IDs. Betroffene Vorkommen behalten ihr Layout. Alte Originale und die extern bearbeiteten Quelldateien bleiben erhalten.`));
  return preview;
}
