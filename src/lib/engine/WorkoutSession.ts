/**
 * WorkoutSession — a first-class domain concept (ADR-0001 §9.A1, per the ARB
 * amendment that deferred ADR-0002).
 *
 * The Engine owns *execution* (see `State.ts`); the Session represents the
 * *persisted execution state* — a durable, schema-versioned record of a run.
 * This module defines the value object and pure lifecycle helpers only; it does
 * NOT persist anything (persistence is a Session-Runtime concern, behind the
 * `StorageAdapter` in `src/lib/session` — the engine never sees it).
 *
 * Timestamps are engine-`Clock` values (monotonic ms), never wall-clock — the
 * engine must not call `Date.now()`. A host adapter (PR-004) may attach
 * wall-clock stamps for display.
 */

export const SESSION_SCHEMA_VERSION = 1;

export type SessionStatus =
  | 'created' // constructed, not yet started
  | 'running'
  | 'paused'
  | 'completed' // terminal — reached the final boundary
  | 'cancelled'; // terminal — aborted by command

export interface WorkoutSession {
  readonly id: string;
  readonly schemaVersion: number;
  readonly workoutId: string;
  readonly status: SessionStatus;

  /** Elapsed ms at the last checkpoint (excludes paused time). Enables resume. */
  readonly cursorMs: number;

  readonly startedAt: number | null;
  readonly pausedAt: number | null;
  readonly completedAt: number | null;

  // Objective statistics (derived from timeline + elapsed) --------------------
  readonly plannedRounds: number;
  readonly roundsCompleted: number;
  readonly plannedDurationMs: number;
  readonly activeDurationMs: number;
  readonly pausedDurationMs: number;

  /** Free-form, host-owned extension data. Subjective rating/notes live here or in a History store. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * WORKOUT_COMPLETED carries the immutable session at completion.
 * (`SessionSnapshot` in EVENT_MODEL/ENGINE is the objective core of a `WorkoutSession`.)
 */
export type SessionSnapshot = WorkoutSession;

export interface CreateSessionArgs {
  readonly id: string;
  readonly workoutId: string;
  readonly plannedRounds: number;
  readonly plannedDurationMs: number;
}

/** A fresh session in the `created` state. */
export function createSession(args: CreateSessionArgs): WorkoutSession {
  return {
    id: args.id,
    schemaVersion: SESSION_SCHEMA_VERSION,
    workoutId: args.workoutId,
    status: 'created',
    cursorMs: 0,
    startedAt: null,
    pausedAt: null,
    completedAt: null,
    plannedRounds: args.plannedRounds,
    roundsCompleted: 0,
    plannedDurationMs: args.plannedDurationMs,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    metadata: {},
  };
}
