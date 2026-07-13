/**
 * session-store — the app's single, canonical persistence entry point.
 *
 * Every consumer (the live workout runtime, the History screen, the Finish
 * screen) goes through these factories, so there is exactly ONE storage format
 * and ONE backend (LocalStorage, via the Session Runtime's adapter). No second
 * persistence mechanism exists.
 *
 *   Engine events → PersistenceSubscriber → SessionRepository → LocalStorageAdapter → LocalStorage
 *                                                                      ▲
 *                                          History / Finish screens read + patch here
 */

import {
  SessionRepository,
  HistoryService,
  LocalStorageAdapter,
} from '../session';

/** The canonical repository over LocalStorage (prefix `corner:session`). */
export function createSessionRepository(): SessionRepository {
  return new SessionRepository(new LocalStorageAdapter());
}

/** The canonical history service (read/patch completed sessions). */
export function createHistoryService(): HistoryService {
  return new HistoryService(createSessionRepository());
}
