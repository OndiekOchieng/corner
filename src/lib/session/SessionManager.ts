/**
 * SessionManager — the Session Runtime facade / composition root.
 *
 * Owns session lifecycle orchestration: it wires the PersistenceSubscriber to the
 * repository, exposes the HistoryService, and drives the resume flow
 * (Repository → Hydrator → Restorer → primed engine). Storage is only an adapter
 * reached via the repository.
 */

import type { Clock, WorkoutConfig, WorkoutSession } from '../engine';
import type { SessionRepository } from './SessionRepository';
import { HistoryService } from './HistoryService';
import { SessionRestorer, type RestoredEngine } from './SessionRestorer';
import { SessionDiagnostics, type NowFn, type SessionDiagnosticsSnapshot } from './SessionDiagnostics';
import {
  PersistenceSubscriber,
  type PersistenceSubscriberOptions,
} from './PersistenceSubscriber';
import type { SessionRecord } from './SessionSerializer';
import type { HydrationError } from './SessionHydrator';

export type ResumeOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'resumable'; readonly record: SessionRecord }
  | { readonly kind: 'error'; readonly error: HydrationError };

export interface SessionManagerDeps {
  readonly repository: SessionRepository;
  /** Maps a persisted workoutId back to a runnable config (owned by the app). */
  readonly resolveConfig: (workoutId: string) => WorkoutConfig | null;
  readonly diagnostics?: SessionDiagnostics;
  readonly now?: NowFn;
}

export class SessionManager {
  readonly history: HistoryService;
  private readonly repository: SessionRepository;
  private readonly resolveConfig: (workoutId: string) => WorkoutConfig | null;
  private readonly diag: SessionDiagnostics;
  private readonly now?: NowFn;
  private readonly restorer = new SessionRestorer();

  constructor(deps: SessionManagerDeps) {
    this.repository = deps.repository;
    this.resolveConfig = deps.resolveConfig;
    this.diag = deps.diagnostics ?? new SessionDiagnostics(deps.now);
    this.now = deps.now;
    this.history = new HistoryService(deps.repository);
  }

  /**
   * Build the persistence plugin to register on the runtime's EventBus. Compose
   * as: create runtime → `createPersistenceSubscriber(() => controller.getSession())`
   * → `eventBus.register(sub)` → `controller.start()`.
   */
  createPersistenceSubscriber(
    getSession: () => WorkoutSession,
    options: PersistenceSubscriberOptions = {}
  ): PersistenceSubscriber {
    return new PersistenceSubscriber(this.repository, getSession, {
      now: this.now,
      diagnostics: this.diag,
      ...options,
    });
  }

  /** Look for an unfinished session to resume on startup. */
  async loadResumable(): Promise<ResumeOutcome> {
    const result = await this.repository.loadActive();
    if (!result.ok) {
      if (result.error.code === 'empty') return { kind: 'none' };
      this.diag.recordFailedRestore();
      return { kind: 'error', error: result.error };
    }
    const status = result.record.session.status;
    if (status !== 'running' && status !== 'paused') return { kind: 'none' };
    return { kind: 'resumable', record: result.record };
  }

  /** Prime an engine at the saved cursor. Returns null if the config can't be resolved. */
  restore(record: SessionRecord, realClock: Clock): RestoredEngine | null {
    const config = this.resolveConfig(record.session.workoutId);
    if (!config) {
      this.diag.recordFailedRestore();
      return null;
    }
    const restored = this.restorer.restore(record, config, realClock);
    this.diag.recordRestore();
    return restored;
  }

  async discardResumable(): Promise<void> {
    await this.repository.clearActive();
  }

  diagnostics(): SessionDiagnosticsSnapshot {
    return this.diag.snapshot();
  }
}
