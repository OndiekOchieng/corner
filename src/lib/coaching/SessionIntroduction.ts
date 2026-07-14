/**
 * SessionIntroduction — the authored opening of a session (PR-020B).
 *
 * The workout owns the FACTS (name, objective, focus, difficulty, stance); the
 * Coach Pack owns the EXPRESSION. A `SessionIntroduction` is how a pack frames
 * those facts: an optional short greeting, its signature opening, and a natural
 * hand-off to work — each a bank of deterministically-rotated variants.
 *
 * PR-028 (philosophy correction): the opening coaches, it does not brief. A great
 * coach says "Southpaw today. Let's work." — not a paragraph. The session no longer
 * voices the workout's focus/objective: naming a concept in the intro AND again in
 * the round is teaching it twice (LAW FOUR). Teach once, coach afterwards — the
 * round intros and the work itself carry the concept.
 *
 * It is AUTHORED, not generated: every line is written by a person. Time-of-day is
 * never hard-coded — a pack references it only if it authors the matching greeting
 * bank, and the value is injected (the Coach Runtime never reads a clock).
 *
 * Placeholders (filled by SpeechPlanner): {name} workout.
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
  /** The pack's signature framing line(s) — short. Always present. */
  readonly opening: readonly string[];
  /** A natural hand-off to work — short. Always present. */
  readonly transition: readonly string[];
  /** The energy the session opens at (colours later wording). */
  readonly energy: CoachEnergy;
}
