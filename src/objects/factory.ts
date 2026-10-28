import { tr } from '../i18n/translate';
import type { Collection, Entry, Exchange, ExchangeRecord, Ref } from '../domain/types';
import { newId, now } from '../exchange/hash';
import { fail } from '../domain/diagnostics';
import { pluginVersion } from '../domain/version';

export const catalogTypes = ['character', 'location', 'object', 'timelineEvent', 'arc'] as const;
/** Creates complete, explicit domain records; no installation, licence or server is consulted. */
export function createRecord(collection: Collection, projectId: string, instanceId: string, title: string,
  options: { type?: string; source?: Ref; target?: Ref } = {}): Entry {
  const id = collection === 'project' ? projectId : newId(), time = now();
  const base = { id, origin: { system: 'obsidian', instanceId, objectId: id }, baseHash: null, createdAt: time,
    updatedAt: time, metadata: {}, extensions: {} };
  const child = { ...base, projectId };
  let record: ExchangeRecord;
  switch (collection) {
    case 'project': record = { ...base, title, description: '', projectType: 'novel', genreOrTopic: '', languageCode: 'und', status: 'idea', wordTarget: null,
      extensions: { 'org.writeller.policy': { aiEnabled: false, cloudSyncEnabled: false, noAiNoCloud: true } } }; break;
    case 'chapters': record = { ...child, title, summary: '', partId: null, status: 'idea', orderIndex: 0 }; break;
    case 'scenes': record = { ...child, title, summary: '', content: { format: 'plain', text: '' }, chapterId: null, parentSceneId: null,
      authorIntent: '', povCharacterId: null, sceneType: 'scene', status: 'idea', orderIndex: 0, storyDateStart: null,
      storyDateEnd: null, estimatedWordTarget: null, tensionLevel: null, emotionalTone: null, goal: null, conflict: null, outcome: null }; break;
    case 'catalogItems': {
      const type = options.type ?? 'character';
      if (!catalogTypes.includes(type as typeof catalogTypes[number]) && !/^custom:[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(type)) fail('INVALID_FIELD', tr('Eigenen Typ als custom:namensraum.name angeben.'));
      record = { ...child, name: title, type, summary: '', status: 'idea', fields: {} }; break;
    }
    case 'relationships':
      if (!options.source || !options.target) fail('MISSING_REFERENCE', tr('Für eine Beziehung beide typisierten Endpunkte auswählen.'));
      record = { ...child, source: options.source, target: options.target, relationshipType: 'relatedTo', label: title,
        description: null, strength: null, direction: 'directed', validFromStoryTime: null, validToStoryTime: null }; break;
    case 'notes': record = { ...child, title, target: null, content: { format: 'plain', text: '' }, source: 'manual', sourceSuggestionId: null }; break;
    case 'researchItems': record = { ...child, title, kind: 'source', target: null, uri: '', content: { format: 'plain', text: '' }, source: '', tags: [] }; break;
  }
  return { collection, record } as Entry;
}
/** Creates a standalone empty package whose project record is ready for local storage. */
export function createProject(title: string, instanceId = newId()): Exchange {
  const projectId = newId(), entry = createRecord('project', projectId, instanceId, title);
  if (entry.collection !== 'project') throw new Error('factory invariant');
  return { format: 'writeller.exchange', version: '1.0.0', packageId: newId(), exportedAt: now(), producer: { system: 'obsidian', version: pluginVersion, instanceId },
    scope: { projectId, mode: 'snapshot' }, project: entry.record, chapters: [], scenes: [], catalogItems: [], relationships: [], notes: [], researchItems: [], attachments: [], extensions: {} };
}
