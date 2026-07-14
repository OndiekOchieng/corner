/**
 * SpeechPlanner — coaching intent → the actual line to say.
 *
 * Composed lines (intros, rest, recovery, teaching, encouragement, urgency,
 * finish) come from the personality's banks, rotated deterministically so the
 * coach never loops. Authored cue text (instruction/reminder/correction) is
 * spoken VERBATIM — the Cue Library already chose those words, and the runtime
 * must not corrupt them. Countdown renders exact number words.
 *
 * Pure and deterministic: rotation is a counter in CoachingMemory, not RNG.
 */

import type { CoachIntent } from './CoachAction';
import type { CoachingMemory } from './CoachingMemory';
import type { PersonalityProfile, ComposedKey } from './personalities';
import type { SessionGreeting, TimeOfDay } from './SessionIntroduction';
import { anchorBank, type AnchorKind } from './anchors';
import { reinforcementBank, encouragementReferenceBank, type Dimension } from './reinforcements';

export interface PlanParams {
  roundNumber?: number;
  roundName?: string;
  nextRoundName?: string;
  totalRounds?: number;
  workoutName?: string;
  secondsRemaining?: number;
  /** Authored cue text, spoken verbatim for instruction/reminder/correction. */
  cueText?: string;
  isFinalRound?: boolean;
  /** Layer 2: which time anchor this is. */
  anchorKind?: AnchorKind;
  /** Layer 3: the coaching dimension, for reinforcement wording. */
  dimension?: Dimension;
  /** Session-introduction facts (PR-020B): the workout's focus/objective, and the injected time of day. */
  focus?: string;
  objective?: string;
  timeOfDay?: TimeOfDay;
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
] as const;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function countdownText(seconds: number): string {
  if (seconds === 10) return 'Ten seconds.';
  if (seconds >= 0 && seconds < NUMBER_WORDS.length) return `${capitalize(NUMBER_WORDS[seconds])}.`;
  return `${seconds}.`;
}

function fill(template: string, params: PlanParams): string {
  // {name} is the subject of the line: the round name in a round intro, else the
  // workout name. Round intros pass roundName; workout intro passes workoutName.
  return template
    .replace(/\{name\}/g, params.roundName ?? params.workoutName ?? 'this session')
    .replace(/\{round\}/g, String(params.roundNumber ?? ''))
    .replace(/\{total\}/g, String(params.totalRounds ?? ''))
    .replace(/\{next\}/g, params.nextRoundName ?? 'the next round')
    // Session-introduction facts (PR-020B).
    .replace(/\{focus\}/g, params.focus ?? params.objective ?? 'the fundamentals')
    .replace(/\{objective\}/g, params.objective ?? params.focus ?? 'clean work')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Which personality bank an intent draws from (null = not bank-composed). */
function composedKey(intent: CoachIntent, params: PlanParams): ComposedKey | null {
  switch (intent) {
    case 'warmup': return 'warmup';
    case 'round_intro': return params.isFinalRound ? 'round_intro_final' : 'round_intro';
    case 'rest_intro': return 'rest_intro';
    case 'recovery': return 'recovery';
    case 'teaching': return 'teaching';
    case 'encouragement': return 'encouragement';
    case 'urgency': return 'urgency';
    case 'finish': return 'finish';
    default: return null;
  }
}

export class SpeechPlanner {
  constructor(private readonly profile: PersonalityProfile) {}

  /**
   * Resolve a line for the intent. Returns null when there is nothing valid to
   * say (empty cue text, or an exhausted bank). `attempt` advances the rotation
   * for repetition-avoidance retries.
   */
  plan(
    intent: CoachIntent,
    params: PlanParams,
    convo: CoachingMemory,
    attempt = 0,
  ): string | null {
    if (intent === 'countdown') {
      const s = params.secondsRemaining;
      return s == null ? null : countdownText(s);
    }

    // The session opening is COMPOSED from the pack's authored SessionIntroduction
    // (greeting? + opening + objective? + transition), not drawn from a flat bank.
    if (intent === 'workout_intro') {
      return this.composeIntroduction(params, convo);
    }

    if (intent === 'instruction' || intent === 'reminder' || intent === 'correction') {
      const text = params.cueText?.trim();
      return text ? text : null;
    }

    // Layer 2 — a personality-voiced time anchor, rotated for variety.
    if (intent === 'time_anchor') {
      if (!params.anchorKind) return null;
      return this.fromBank(anchorBank(this.profile.id, params.anchorKind), `anchor:${params.anchorKind}`, convo, attempt);
    }

    // Layer 3 — reinforce a lesson with fresh wording (same dimension, new words).
    if (intent === 'reinforcement') {
      const dim = params.dimension ?? 'general';
      return this.fromBank(reinforcementBank(dim), `reinforce:${dim}`, convo, attempt);
    }

    // Encouragement that references the lesson just taught (PR-020C). When the
    // memory knows a taught dimension, praise reinforces THAT concept ("Good.
    // Keep protecting yourself.") rather than a hollow "Great job". Falls back to
    // the pack's generic encouragement when nothing specific has been taught.
    if (intent === 'encouragement' && params.dimension && params.dimension !== 'general') {
      return this.fromBank(
        encouragementReferenceBank(params.dimension),
        `encourage-ref:${params.dimension}`,
        convo,
        attempt,
      );
    }

    const key = composedKey(intent, params);
    if (!key) return null;
    return this.fromBank(this.profile.banks[key], `${this.profile.id}:${key}`, convo, attempt, params);
  }

  /**
   * Compose the authored session opening (PR-020B): greeting? + opening +
   * objective? + transition, each a deterministically-rotated variant, joined
   * into one natural line. The objective segment is included only when the
   * workout provides a focus/objective. Fully deterministic — rotation is a
   * CoachingMemory counter, and time-of-day is injected (never read here).
   */
  private composeIntroduction(params: PlanParams, convo: CoachingMemory): string | null {
    const intro = this.profile.introduction;
    const id = this.profile.id;
    const parts: string[] = [];

    const greeting = this.pickGreeting(intro.greeting, params.timeOfDay, convo);
    if (greeting) parts.push(greeting);

    const opening = this.fromBank(intro.opening, `${id}:intro:opening`, convo, 0, params);
    if (opening) parts.push(opening);

    // Voice the objective only when the workout actually provides a focus/objective.
    if (params.focus || params.objective) {
      const objective = this.fromBank(intro.objective, `${id}:intro:objective`, convo, 0, params);
      if (objective) parts.push(objective);
    }

    const transition = this.fromBank(intro.transition, `${id}:intro:transition`, convo, 0, params);
    if (transition) parts.push(transition);

    const text = parts.join(' ').replace(/\s+/g, ' ').trim();
    return text.length ? text : null;
  }

  /**
   * Pick the greeting. A pack that authored no greeting (or none for the given
   * time of day) gets the neutral bank; time is referenced ONLY when the pack
   * opted in by authoring that time's bank. Neutral is always the default.
   */
  private pickGreeting(
    greeting: SessionGreeting | undefined,
    timeOfDay: TimeOfDay | undefined,
    convo: CoachingMemory,
  ): string | null {
    if (!greeting) return null;
    let bank: readonly string[] = greeting.neutral;
    if (timeOfDay && timeOfDay !== 'neutral') {
      const timed = greeting[timeOfDay];
      if (timed && timed.length > 0) bank = timed;
    }
    return this.fromBank(bank, `${this.profile.id}:intro:greeting`, convo, 0);
  }

  /** Pick a rotated variant from a bank; fill placeholders when params are given. */
  private fromBank(
    bank: readonly string[] | undefined,
    rotationKey: string,
    convo: CoachingMemory,
    attempt: number,
    params?: PlanParams,
  ): string | null {
    if (!bank || bank.length === 0) return null;
    const base = convo.nextRotation(rotationKey);
    const template = bank[(base + attempt) % bank.length];
    return params ? fill(template, params) : template;
  }
}
