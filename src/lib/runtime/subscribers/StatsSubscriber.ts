/**
 * StatsSubscriber — observes events and accumulates a live, in-memory summary.
 *
 * NO persistence, NO analytics (both are out of scope). It simply watches the
 * event stream and maintains counters + the final session snapshot, preparing
 * the data PR-004c (Session Persistence & Resume) will persist.
 */

import type { Subscriber } from '../Subscriber';
import type { WorkoutEvent } from '../types';
import type { WorkoutSession } from '../../engine';

export interface RuntimeStats {
  readonly workoutId: string | null;
  readonly started: boolean;
  readonly roundsStarted: number;
  readonly roundsCompleted: number;
  readonly restsStarted: number;
  readonly cues: number;
  readonly countdowns: number;
  readonly pauses: number;
  readonly resumes: number;
  readonly completed: boolean;
  readonly cancelled: boolean;
  readonly lastEventSeq: number;
  readonly elapsedMs: number;
  /** The session snapshot carried by WORKOUT_COMPLETED (for PR-004c). */
  readonly finalSession: WorkoutSession | null;
}

const EMPTY: RuntimeStats = {
  workoutId: null,
  started: false,
  roundsStarted: 0,
  roundsCompleted: 0,
  restsStarted: 0,
  cues: 0,
  countdowns: 0,
  pauses: 0,
  resumes: 0,
  completed: false,
  cancelled: false,
  lastEventSeq: -1,
  elapsedMs: 0,
  finalSession: null,
};

export const STATS_SUBSCRIBER_ID = 'stats';

export class StatsSubscriber implements Subscriber {
  readonly id = STATS_SUBSCRIBER_ID;
  readonly priority: number;
  private stats: RuntimeStats = EMPTY;

  constructor(priority = 0) {
    this.priority = priority;
  }

  canHandle(): boolean {
    return true; // observe all events
  }

  handle(event: WorkoutEvent): void {
    const s = this.stats;
    const next: Mutable<RuntimeStats> = { ...s, lastEventSeq: event.seq, elapsedMs: event.elapsedMs };

    switch (event.type) {
      case 'WORKOUT_STARTED':
        Object.assign(next, EMPTY, {
          workoutId: event.data.workoutId,
          started: true,
          lastEventSeq: event.seq,
        });
        break;
      case 'ROUND_STARTED':
        next.roundsStarted = s.roundsStarted + 1;
        break;
      case 'ROUND_COMPLETED':
        next.roundsCompleted = s.roundsCompleted + 1;
        break;
      case 'REST_STARTED':
        next.restsStarted = s.restsStarted + 1;
        break;
      case 'COACH_CUE':
        next.cues = s.cues + 1;
        break;
      case 'COUNTDOWN_SECOND':
        next.countdowns = s.countdowns + 1;
        break;
      case 'WORKOUT_PAUSED':
        next.pauses = s.pauses + 1;
        break;
      case 'WORKOUT_RESUMED':
        next.resumes = s.resumes + 1;
        break;
      case 'WORKOUT_COMPLETED':
        next.completed = true;
        next.finalSession = event.data;
        break;
      case 'WORKOUT_CANCELLED':
        next.cancelled = true;
        break;
      default:
        break;
    }

    this.stats = next;
  }

  getStats(): RuntimeStats {
    return this.stats;
  }

  reset(): void {
    this.stats = EMPTY;
  }
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
