import { tr } from '../i18n/translate';
import type { ExchangeRecord } from '../domain/types';
import { sha256 } from '../exchange/hash';
import { warning, type Diagnostic } from '../domain/diagnostics';

/** Retains original opaque annotations for review after an intentional text/projection edit. */
export async function holdAnnotations(record: ExchangeRecord, originalText: string): Promise<Diagnostic[]> {
  if (!('parentSceneId' in record) || !Object.hasOwn(record.metadata, 'annotations')) return [];
  record.extensions['org.writeller.text-review'] = { basisHash: await sha256(originalText), annotations: record.metadata['annotations']! };
  delete record.metadata['annotations'];
  return [warning('ANNOTATIONS_NEED_REVIEW', tr('Alte Annotationen wurden zur manuellen Prüfung erhalten. UTF-16-Positionen werden nicht angewandt.'))];
}
