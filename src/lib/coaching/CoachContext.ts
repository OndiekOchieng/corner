/**
 * CoachContext — the immutable configuration the runtime decides against.
 *
 * This is the static "who is coaching and how carefully" — the personality plus
 * the tunable thresholds that encode the Silence Guide and Timing Model. It does
 * NOT hold live conversation state (that's CoachingMemory) and it never
 * duplicates engine state.
 */

import type { CoachPackId } from './CoachAction';
import type { TimeOfDay } from './SessionIntroduction';

export interface CoachConfig {
  /** Minimum quiet between two non-structural coaching lines (Silence Guide density). */
  readonly minCoachingGapMs: number;
  /** A correction may arrive sooner than a normal line — but not stacked. */
  readonly minCorrectionGapMs: number;
  /** Earned encouragement is rare: minimum spacing between encouragements. */
  readonly encouragementCooldownMs: number;
  /** After a correction, stay off encouragement for this long (Motivation Model §3). */
  readonly encouragementAfterCorrectionMs: number;
  /** The same reminder wording may not recur within this window. */
  readonly reminderCooldownMs: number;
  /** Urgency expires fast so the countdown always wins the air (Timing Model §7). */
  readonly urgencyTtlMs: number;
  /** How many recent lines to remember for repetition avoidance. */
  readonly dedupeWindow: number;
  /** Max actions buffered in one batch before the lowest is discarded. */
  readonly maxQueueDepth: number;
  /** Whether the rest teaching line is emitted at all. */
  readonly teachingEnabled: boolean;
}

export const DEFAULT_COACH_CONFIG: CoachConfig = {
  minCoachingGapMs: 5000,
  minCorrectionGapMs: 2500,
  encouragementCooldownMs: 45000,
  encouragementAfterCorrectionMs: 6000,
  reminderCooldownMs: 15000,
  urgencyTtlMs: 2500,
  dedupeWindow: 5,
  maxQueueDepth: 4,
  teachingEnabled: true,
};

/**
 * The workout FACTS the coach frames in its session introduction (PR-020B). The
 * workout owns these; the Coach Pack owns how they are spoken. All optional — an
 * absent focus simply omits the objective segment of the opening.
 */
export interface SessionFacts {
  /** The session's focus, e.g. "distance control" (voiced by the intro's objective). */
  readonly focus?: string;
  /** An explicit objective sentence, if the workout provides one (falls back to focus). */
  readonly objective?: string;
  /** Injected time of day — the coach never reads a clock (determinism). */
  readonly timeOfDay?: TimeOfDay;
}

export interface CoachContext {
  /** Which coach is in the corner. */
  readonly personality: CoachPackId;
  /** Display name for the workout (events only carry an id). */
  readonly workoutName?: string;
  /** Session-introduction facts owned by the workout. */
  readonly facts: SessionFacts;
  readonly config: CoachConfig;
}

export function makeContext(
  personality: CoachPackId,
  options: {
    workoutName?: string;
    facts?: SessionFacts;
    config?: Partial<CoachConfig>;
  } = {},
): CoachContext {
  return {
    personality,
    workoutName: options.workoutName,
    facts: options.facts ?? {},
    config: { ...DEFAULT_COACH_CONFIG, ...options.config },
  };
}
