/**
 * Events — the discrete, immutable output stream of the engine.
 *
 * Every event shares an envelope (`type`, `at`, `elapsedMs`, `seq`, `data`);
 * `data` is a discriminated payload. Events are deterministic: the same inputs
 * produce the same events with the same `seq` order (STATE_MACHINE §8).
 *
 * The engine EMITS these; it knows nothing about who consumes them.
 */

import type { Phase } from './State';
import type { RoundConfig } from '../../types/workout-config';
import type { SessionSnapshot } from './WorkoutSession';

export type WorkoutEventType =
  | 'WORKOUT_STARTED'
  | 'WARMUP_STARTED'
  | 'WARMUP_COMPLETED'
  | 'ROUND_STARTED'
  | 'ROUND_COMPLETED'
  | 'REST_STARTED'
  | 'REST_COMPLETED'
  | 'COUNTDOWN_STARTED'
  | 'COUNTDOWN_SECOND'
  | 'COACH_CUE'
  | 'WORKOUT_PAUSED'
  | 'WORKOUT_RESUMED'
  | 'WORKOUT_COMPLETED'
  | 'WORKOUT_CANCELLED';

export interface WorkoutStartedData {
  readonly workoutId: string;
  readonly totalRounds: number;
  readonly plannedDurationMs: number;
  readonly hasWarmup: boolean;
}
export interface WarmupStartedData {
  readonly durationMs: number;
}
export type WarmupCompletedData = Record<string, never>;
export interface RoundStartedData {
  readonly roundIndex: number;
  readonly roundNumber: number;
  readonly round: RoundConfig;
  readonly durationMs: number;
}
export interface RoundCompletedData {
  readonly roundIndex: number;
  readonly roundNumber: number;
}
export interface RestStartedData {
  readonly durationMs: number;
  readonly nextRoundIndex: number;
  readonly nextRound: RoundConfig;
}
export interface RestCompletedData {
  readonly restIndex: number;
}
export interface CountdownStartedData {
  readonly context: 'round' | 'rest';
  readonly fromSeconds: number;
}
export interface CountdownSecondData {
  readonly context: 'round' | 'rest';
  readonly secondsRemaining: number;
}
export interface CoachCueData {
  readonly roundIndex: number;
  readonly cueId: string;
  readonly text: string;
  readonly atMs: number;
}
export interface WorkoutPausedData {
  readonly phase: Phase;
  readonly elapsedMs: number;
}
export interface WorkoutResumedData {
  readonly phase: Phase;
  readonly elapsedMs: number;
  readonly pausedForMs: number;
}
export type WorkoutCompletedData = SessionSnapshot;
export interface WorkoutCancelledData {
  readonly elapsedMs: number;
  readonly roundsCompleted: number;
}

interface Envelope<Type extends WorkoutEventType, Data> {
  readonly type: Type;
  /** Engine clock (ms) at which the event logically occurred. */
  readonly at: number;
  /** Session elapsed (ms) at emission. */
  readonly elapsedMs: number;
  /** Session-monotonic sequence number. */
  readonly seq: number;
  readonly data: Data;
}

export type WorkoutEvent =
  | Envelope<'WORKOUT_STARTED', WorkoutStartedData>
  | Envelope<'WARMUP_STARTED', WarmupStartedData>
  | Envelope<'WARMUP_COMPLETED', WarmupCompletedData>
  | Envelope<'ROUND_STARTED', RoundStartedData>
  | Envelope<'ROUND_COMPLETED', RoundCompletedData>
  | Envelope<'REST_STARTED', RestStartedData>
  | Envelope<'REST_COMPLETED', RestCompletedData>
  | Envelope<'COUNTDOWN_STARTED', CountdownStartedData>
  | Envelope<'COUNTDOWN_SECOND', CountdownSecondData>
  | Envelope<'COACH_CUE', CoachCueData>
  | Envelope<'WORKOUT_PAUSED', WorkoutPausedData>
  | Envelope<'WORKOUT_RESUMED', WorkoutResumedData>
  | Envelope<'WORKOUT_COMPLETED', WorkoutCompletedData>
  | Envelope<'WORKOUT_CANCELLED', WorkoutCancelledData>;
