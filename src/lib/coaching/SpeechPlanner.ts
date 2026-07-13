/**
 * SpeechPlanner — coaching intent → the actual line to say.
 *
 * Composed lines (intros, rest, recovery, teaching, encouragement, urgency,
 * finish) come from the personality's banks, rotated deterministically so the
 * coach never loops. Authored cue text (instruction/reminder/correction) is
 * spoken VERBATIM — the Cue Library already chose those words, and the runtime
 * must not corrupt them. Countdown renders exact number words.
 *
 * Pure and deterministic: rotation is a counter in ConversationState, not RNG.
 */

import type { CoachIntent } from './CoachAction';
import type { ConversationState } from './ConversationState';
import type { PersonalityProfile, ComposedKey } from './personalities';
import { anchorBank, type AnchorKind } from './anchors';
import { reinforcementBank, type Dimension } from './reinforcements';

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
    .replace(/\s+/g, ' ')
    .trim();
}

/** Which personality bank an intent draws from (null = not bank-composed). */
function composedKey(intent: CoachIntent, params: PlanParams): ComposedKey | null {
  switch (intent) {
    case 'workout_intro': return 'workout_intro';
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
    convo: ConversationState,
    attempt = 0,
  ): string | null {
    if (intent === 'countdown') {
      const s = params.secondsRemaining;
      return s == null ? null : countdownText(s);
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

    const key = composedKey(intent, params);
    if (!key) return null;
    return this.fromBank(this.profile.banks[key], `${this.profile.id}:${key}`, convo, attempt, params);
  }

  /** Pick a rotated variant from a bank; fill placeholders when params are given. */
  private fromBank(
    bank: readonly string[] | undefined,
    rotationKey: string,
    convo: ConversationState,
    attempt: number,
    params?: PlanParams,
  ): string | null {
    if (!bank || bank.length === 0) return null;
    const base = convo.nextRotation(rotationKey);
    const template = bank[(base + attempt) % bank.length];
    return params ? fill(template, params) : template;
  }
}
