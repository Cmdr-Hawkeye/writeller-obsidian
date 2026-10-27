/** JSON values retain their native types; user keys are never merged into prototypes. */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export const collections = ['project', 'chapters', 'scenes', 'catalogItems', 'relationships', 'notes', 'researchItems'] as const;
export type Collection = typeof collections[number];
export type ChildCollection = Exclude<Collection, 'project'>;
export interface Ref { collection: Collection; id: string }
export interface Origin { system: string; instanceId: string; objectId: string }
export interface Producer { system: string; version: string; instanceId: string }
export interface Content { format: 'plain' | 'markdown'; text: string }
export interface CommonRecord {
  id: string; origin: Origin; baseHash: string | null; createdAt: string; updatedAt: string;
  metadata: JsonObject; extensions: JsonObject;
}
export interface Project extends CommonRecord {
  title: string; description: string; projectType: string; genreOrTopic: string;
  languageCode: string; status: string; wordTarget: number | null;
}
export interface ChildRecord extends CommonRecord { projectId: string }
export interface Chapter extends ChildRecord {
  partId: string | null; title: string; summary: string; orderIndex: number; status: string;
}
export interface Scene extends ChildRecord {
  chapterId: string | null; parentSceneId: string | null; title: string; summary: string;
  content: Content; authorIntent: string; povCharacterId: string | null; sceneType: string;
  status: string; orderIndex: number; storyDateStart: string | null; storyDateEnd: string | null;
  estimatedWordTarget: number | null; tensionLevel: number | null; emotionalTone: string | null;
  goal: string | null; conflict: string | null; outcome: string | null;
}
export interface CatalogItem extends ChildRecord {
  type: string; name: string; summary: string; status: string; fields: JsonObject;
}
export interface Relationship extends ChildRecord {
  source: Ref; target: Ref; relationshipType: string; label: string | null;
  description: string | null; strength: number | null; direction: 'directed' | 'undirected';
  validFromStoryTime: string | null; validToStoryTime: string | null;
}
export interface Note extends ChildRecord {
  target: Ref | null; title: string; content: Content; source: string; sourceSuggestionId: string | null;
}
export interface ResearchItem extends ChildRecord {
  kind: 'link' | 'file' | 'image' | 'pdf' | 'webNote' | 'source'; target: Ref | null;
  title: string; uri: string; content: Content; source: string; tags: string[];
}
export interface Attachment {
  id: string; projectId: string; mimeType: 'image/png' | 'image/jpeg'; width: number; height: number; data: string;
}
export interface Exchange {
  format: 'writeller.exchange'; version: '1.0.0'; packageId: string; exportedAt: string;
  producer: Producer; scope: { projectId: string; mode: 'snapshot' }; project: Project;
  chapters: Chapter[]; scenes: Scene[]; catalogItems: CatalogItem[]; relationships: Relationship[];
  notes: Note[]; researchItems: ResearchItem[]; attachments: Attachment[]; extensions: JsonObject;
}
export type RecordMap = { project: Project; chapters: Chapter; scenes: Scene; catalogItems: CatalogItem;
  relationships: Relationship; notes: Note; researchItems: ResearchItem };
export type ExchangeRecord = RecordMap[Collection];
export type Entry = { [C in Collection]: { collection: C; record: RecordMap[C] } }[Collection];
