/**
 * SessionIntroduction — the authored opening of a session (PR-020B).
 *
 * The workout owns the FACTS (name, objective, focus, difficulty, stance); the
 * Coach Pack owns the EXPRESSION. A `SessionIntroduction` is how a pack frames
 * those facts: an optional greeting, its signature opening, the objective voiced
 * in the coach's own words, and a natural hand-off to round one — each a bank of
 * deterministically-rotated variants.
 *
 * It is AUTHORED, not generated: every line is written by a person. Time-of-day is
 * never hard-coded — a pack references it only if it authors the matching greeting
 * bank, and the value is injected (the Coach Runtime never reads a clock).
 *
 * Placeholders (filled by SpeechPlanner): {name} workout, {focus}/{objective} the
 * session's focus.
 */

import type { CoachEnergy } from './CoachAction';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'neutral';

/**
 * A greeting bank. `neutral` is always present and is the default; the timed banks
 * are optional — a pack that never references time simply omits them (or omits the
 * whole greeting).
 */
export interface SessionGreeting {
  readonly neutral: readonly string[];
  readonly morning?: readonly string[];
  readonly afternoon?: readonly string[];
  readonly evening?: readonly string[];
}

export interface SessionIntroduction {
  /** Authoring note — documents the intent of this opening. NOT spoken. */
  readonly purpose: string;
  /** Optional greeting. Omit entirely for packs that don't greet. */
  readonly greeting?: SessionGreeting;
  /** The pack's signature framing line(s). Always present. */
  readonly opening: readonly string[];
  /** Voices the session's focus/objective; only used when the workout provides one. */
  readonly objective: readonly string[];
  /** A natural hand-off to round one. Always present. */
  readonly transition: readonly string[];
  /** The energy the session opens at (colours later wording). */
  readonly energy: CoachEnergy;
}
