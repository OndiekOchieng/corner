/**
 * WorkoutConfig — the immutable input to the Execution Engine.
 *
 * The engine owns this type (it does NOT depend on the app's `types/workout.ts`).
 * A host adapter (PR-004) will map the app's `Workout`/`CustomWorkout` into a
 * `WorkoutConfig`. Keeping the config engine-local is what lets the engine
 * compile and run under Node with zero React / DOM / browser dependencies.
 *
 * All durations are in **integer milliseconds** (see ADR-0001 §9 / review S6:
 * integer-ms discipline avoids float boundary/countdown drift).
 */

export const WORKOUT_CONFIG_SCHEMA_VERSION = 1;

/** A coaching cue scheduled relative to the start of its round. */
export interface CueConfig {
  readonly id: string;
  readonly text: string;
  /** Offset from the round's start, in ms. Should be > 0 (0 coincides with the round intro). */
  readonly atMs: number;
}

/** One work round plus the rest that follows it (rest omitted after the final round). */
export interface RoundConfig {
  readonly id: string;
  readonly name?: string;
  /** Work duration, ms. Must be > 0. */
  readonly workMs: number;
  /** Rest duration that follows this round, ms. Must be >= 0; ignored for the last round. */
  readonly restMs: number;
  readonly cues: readonly CueConfig[];
}

export interface WorkoutConfig {
  readonly schemaVersion: number;
  readonly workoutId: string;
  /** Optional lead-in before round 1, ms. A warmup segment exists iff this is > 0. */
  readonly warmupMs: number;
  readonly rounds: readonly RoundConfig[];
  /**
   * Seconds-remaining thresholds that trigger a spoken countdown, per timed
   * round/rest segment. Defaults to [10, 5, 4, 3, 2, 1].
   */
  readonly countdownLeadSeconds?: readonly number[];
}
