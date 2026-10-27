import type { Attachment, Collection, ExchangeRecord, JsonObject } from '../domain/types';

export interface ProjectionLink { localPath: string; originalUrl: string; image: boolean }
export interface Projection { body: string; links: ProjectionLink[]; protected: boolean }
export interface PeerBaseline { system: string; instanceId: string; acceptedRecord: ExchangeRecord; acceptedHash: string }
export interface RecordState {
  stateVersion: 1; collection: Collection; id: string; record: ExchangeRecord;
  lastAcceptedRecord: ExchangeRecord | null; knownHashes: { accepted: string | null; exported: string[] };
  peerBaselines: PeerBaseline[]; projection: Projection | null;
}
export interface RecordLocation { collection: Collection; id: string; notePath: string; sidecarPath: string }
export interface AssetLocation { id: string; path: string; mimeType: Attachment['mimeType']; width: number; height: number }
export interface ProjectState {
  stateVersion: 1; projectId: string; localInstanceId: string; manifestPath: string;
  records: RecordLocation[]; packages: { id: string; hash: string }[]; locallyDeleted: string[];
  pendingJournal: string | null; assets: AssetLocation[]; extensions: JsonObject;
}
