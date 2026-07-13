/**
 * Session Runtime — public surface (PR-004c).
 *
 * Owns checkpointing, resume, finish, history, statistics, and persistence —
 * implemented as a Runtime Plugin (a subscriber). The Execution Engine and the
 * Event Runtime remain unaware persistence exists; storage is only an adapter.
 *
 *   Engine → Host Runtime → Event Runtime → Session Runtime → Storage Adapter
 */

export { type StorageAdapter, InMemoryStorageAdapter } from './StorageAdapter';
export { LocalStorageAdapter } from './LocalStorageAdapter';

export {
  SessionSerializer,
  PERSISTENCE_SCHEMA_VERSION,
  type SessionRecord,
  type DeserializeResult,
  type SerializeError,
  type SerializeErrorCode,
} from './SessionSerializer';

export {
  SessionHydrator,
  type HydrationResult,
  type HydrationError,
  type HydrationErrorCode,
} from './SessionHydrator';

export {
  SessionRepository,
  toSummary,
  type SessionSummary,
  type SessionRepositoryOptions,
} from './SessionRepository';

export { HistoryService } from './HistoryService';

export { SessionRestorer, ResumeClock, type RestoredEngine } from './SessionRestorer';

export {
  PersistenceSubscriber,
  PERSISTENCE_SUBSCRIBER_ID,
  type PersistenceSubscriberOptions,
} from './PersistenceSubscriber';

export {
  SessionDiagnostics,
  type SessionDiagnosticsSnapshot,
  type StorageErrorEntry,
  type NowFn,
} from './SessionDiagnostics';

export {
  SessionManager,
  type SessionManagerDeps,
  type ResumeOutcome,
} from './SessionManager';
