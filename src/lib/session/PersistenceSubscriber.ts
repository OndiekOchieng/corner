/**
 * PersistenceSubscriber — persistence implemented as a Runtime Plugin.
 *
 * It subscribes to lifecycle events only (WORKOUT_STARTED / PAUSED / RESUMED /
 * COMPLETED / CANCELLED) and checkpoints the resumable "active" session, moving
 * finished sessions to history. The engine and Event Runtime never know it
 * exists — it just observes events and reads the current session via an injected
 * getter (so the engine stays unaware persistence exists).
 *
 * Writes are debounced to at most one per second on the progress path
 * (`checkpoint()`); state-critical lifecycle transitions force an immediate write.
 * It never writes every frame.
 */

import type { Subscriber } from '../runtime';
import type { WorkoutEvent } from '../runtime';
import type { WorkoutSession } from '../engine';
import type { SessionRepository } from './SessionRepository';
import type { SessionRecord } from './SessionSerializer';
import type { SessionDiagnostics } from './SessionDiagnostics';
import { systemNow, type NowFn } from '../platform/time';

export interface PersistenceSubscriberOptions {
  readonly now?: NowFn;
  readonly minIntervalMs?: number;
  readonly diagnostics?: SessionDiagnostics;
  /** Supplies subjective rating/notes/coach at checkpoint time (default: none). */
  readonly meta?: () => { rating: number | null; notes: string | null; coach?: string | null };
  readonly priority?: number;
}

export const PERSISTENCE_SUBSCRIBER_ID = 'persistence';

const LIFECYCLE = new Set<WorkoutEvent['type']>([
  'WORKOUT_STARTED',
  'WORKOUT_PAUSED',
  'WORKOUT_RESUMED',
  'WORKOUT_COMPLETED',
  'WORKOUT_CANCELLED',
]);

export class PersistenceSubscriber implements Subscriber {
  readonly id = PERSISTENCE_SUBSCRIBER_ID;
  readonly priority: number;

  private readonly repository: SessionRepository;
  private readonly getSession: () => WorkoutSession;
  private readonly now: NowFn;
  private readonly minIntervalMs: number;
  private readonly diagnostics?: SessionDiagnostics;
  private readonly meta?: () => { rating: number | null; notes: string | null; coach?: string | null };

  private lastWriteAt = Number.NEGATIVE_INFINITY;

  constructor(
    repository: SessionRepository,
    getSession: () => WorkoutSession,
    options: PersistenceSubscriberOptions = {}
  ) {
    this.repository = repository;
    this.getSession = getSession;
    this.now = options.now ?? systemNow;
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.diagnostics = options.diagnostics;
    this.meta = options.meta;
    // Persistence runs after coaching/bells (low priority) so speech isn't delayed.
    this.priority = options.priority ?? -500;
  }

  canHandle(event: WorkoutEvent): boolean {
    return LIFECYCLE.has(event.type);
  }

  handle(event: WorkoutEvent): void | Promise<void> {
    switch (event.type) {
      case 'WORKOUT_STARTED':
      case 'WORKOUT_PAUSED':
      case 'WORKOUT_RESUMED':
        return this.checkpoint(true); // forced: state-critical
      case 'WORKOUT_COMPLETED':
        return this.finalize(); // completed → moves to history
      case 'WORKOUT_CANCELLED':
        return this.discard(); // cancelled → discarded, never enters history
      default:
        return;
    }
  }

  /**
   * Checkpoint the active session. On the progress path (`force = false`) it is
   * debounced to at most one write per `minIntervalMs`. Safe to call frequently
   * (e.g. once per second from the host) without writing every frame.
   */
  checkpoint(force = false): Promise<void> | void {
    const now = this.now();
    if (!force && now - this.lastWriteAt < this.minIntervalMs) return; // debounced
    this.lastWriteAt = now;
    this.diagnostics?.recordCheckpoint();
    return this.repository
      .saveActive(this.toRecord())
      .catch((error) => this.diagnostics?.recordStorageError('checkpoint', error));
  }

  private async finalize(): Promise<void> {
    this.lastWriteAt = this.now();
    const record = this.toRecord();
    try {
      await this.repository.appendHistory(record);
      await this.repository.clearActive();
      this.diagnostics?.recordCheckpoint();
    } catch (error) {
      this.diagnostics?.recordStorageError('finalize', error);
    }
  }

  /**
   * A cancelled workout is abandoned: drop the resumable active slot so it can't
   * be resumed, and do NOT append it to history (History is completed training).
   */
  private async discard(): Promise<void> {
    this.lastWriteAt = this.now();
    try {
      await this.repository.clearActive();
    } catch (error) {
      this.diagnostics?.recordStorageError('discard', error);
    }
  }

  private toRecord(): SessionRecord {
    const meta = this.meta?.() ?? { rating: null, notes: null, coach: null };
    return {
      session: this.getSession(),
      rating: meta.rating,
      notes: meta.notes,
      coach: meta.coach ?? null,
      savedAt: this.now(),
    };
  }
}
