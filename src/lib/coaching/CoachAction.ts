/**
 * CoachAction — the immutable unit of coaching output.
 *
 * The Coach Runtime consumes engine events and produces `CoachAction`s: a
 * decided coaching intent, the resolved line to say, and the metadata the queue
 * needs to order, interrupt, and expire it. Actions are RENDERED by a
 * `SpeechSink` (the existing SpeechService) — the runtime never synthesizes
 * speech itself.
 *
 * Everything here is pure data + timing measured in the engine's deterministic
 * `elapsedMs`. No wall-clock, no browser, no randomness.
 */

/** The six Coach Packs, as behavioural + phrasing personalities (docs: PERSONALITY_SYSTEM.md). */
export type CoachPackId =
  | 'technical'
  | 'oldschool'
  | 'fightnight'
  | 'calm'
  | 'competition'
  | 'southpaw';

/**
 * What the coach is doing when it speaks. Structural intents carry the trust
 * skeleton (intros, countdown, finish); coaching intents carry judgement
 * (instruction/correction/etc.). See CONVERSATION_PATTERNS.md.
 */
export type CoachIntent =
  | 'workout_intro'
  | 'warmup'
  | 'round_intro'
  | 'time_anchor'
  | 'instruction'
  | 'combination'
  | 'reminder'
  | 'correction'
  | 'reinforcement'
  | 'encouragement'
  | 'urgency'
  | 'countdown'
  | 'rest_intro'
  | 'recovery'
  | 'teaching'
  | 'finish';

/** Energy across the round arc (ROUND_DIRECTING.md), used to colour wording. */
export type CoachEnergy = 'low' | 'calm' | 'steady' | 'rising' | 'peak';

/**
 * Base priority per intent. Higher wins. Critical structural moments (countdown,
 * finish) sit at the top and interrupt; encouragement sits at the bottom and
 * never interrupts. PriorityResolver owns the rules; this is the data.
 */
export const INTENT_PRIORITY: Readonly<Record<CoachIntent, number>> = {
  countdown: 100,
  finish: 95,
  workout_intro: 85,
  warmup: 80,
  round_intro: 78,
  rest_intro: 72,
  time_anchor: 66,
  urgency: 60,
  correction: 52,
  reinforcement: 46,
  combination: 45,
  instruction: 44,
  reminder: 40,
  teaching: 34,
  recovery: 30,
  encouragement: 22,
};

/**
 * Intents that form the trust skeleton — never silenced, never deduped away.
 * Time anchors join it: they orient the athlete and must land (Layer 2), but they
 * are sparse, so always speaking them never threatens the silence budget.
 */
const STRUCTURAL: ReadonlySet<CoachIntent> = new Set([
  'workout_intro',
  'warmup',
  'round_intro',
  'rest_intro',
  'countdown',
  'finish',
  'time_anchor',
]);

/** Intents that may cut off whatever is currently being said. */
const CRITICAL: ReadonlySet<CoachIntent> = new Set(['countdown', 'finish']);

/** Intents whose wording repeats often, so they must dedupe/rotate hard. */
const REPEATABLE: ReadonlySet<CoachIntent> = new Set([
  'instruction',
  'reminder',
  'correction',
  'reinforcement',
  'encouragement',
  'urgency',
  'recovery',
]);

export const isStructural = (intent: CoachIntent): boolean => STRUCTURAL.has(intent);
export const isCritical = (intent: CoachIntent): boolean => CRITICAL.has(intent);
export const isRepeatable = (intent: CoachIntent): boolean => REPEATABLE.has(intent);
export const basePriority = (intent: CoachIntent): number => INTENT_PRIORITY[intent];

/**
 * Temporal validity (PR-021): how long after creation an action stays relevant.
 * Speech is a live view of the timeline, so a line that could not be spoken within
 * its window is stale and discarded rather than replayed. `null` = never expires
 * (the countdown/finish trust skeleton is always valid when it fires). The Coach
 * Runtime sets `expiresElapsedMs = createdElapsedMs + ttl`; the queue drops any
 * action past it. All in engine `elapsedMs` — deterministic, no wall clock.
 */
export const VALIDITY_TTL_MS: Readonly<Record<CoachIntent, number | null>> = {
  countdown: null,
  finish: null,
  workout_intro: 8000, // the welcome is only relevant at the very start
  warmup: 12000,
  round_intro: 20000, // a round intro belongs at the top of the round, not later
  rest_intro: 15000,
  time_anchor: 6000, // "one minute to go" is wrong ten seconds later
  urgency: 2500,
  correction: 12000,
  reinforcement: 12000,
  combination: 12000,
  instruction: 12000,
  reminder: 12000,
  teaching: 15000,
  recovery: 10000,
  encouragement: 9000,
};

export const validityTtlMs = (intent: CoachIntent): number | null => VALIDITY_TTL_MS[intent];

/**
 * A deterministic estimate of how long a line takes to speak, for structural-
 * deadline preemption (PR-021). Pure function of the text (~167 wpm + a little
 * latency) — no wall clock, no measurement. Used to decide whether a coaching line
 * can finish before a countdown/bell, so we never start speech we'd have to cut.
 */
export function estimateSpeechMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return 300 + words * 360;
}

export interface CoachAction {
  /** Deterministic identity: `${sourceSeq}:${intent}`. */
  readonly id: string;
  readonly intent: CoachIntent;
  readonly priority: number;
  /** The resolved line to speak. */
  readonly text: string;
  /** The engine event `seq` that produced this action. */
  readonly sourceSeq: number;
  /** Engine `elapsedMs` when the action was created. */
  readonly createdElapsedMs: number;
  /** After this engine elapsed, the action is stale and must be discarded. `null` = never. */
  readonly expiresElapsedMs: number | null;
  /** Whether rendering should cancel current speech first. */
  readonly interrupt: boolean;
}

/**
 * The narrow rendering port. The existing SpeechService satisfies this shape
 * (speak/pause/resume/cancel, plus clearQueue → clearPending). The runtime only
 * ever calls these; it never imports the speech synthesis API.
 */
export interface SpeechSink {
  speak(text: string): void;
  pause(): void;
  resume(): void;
  /** Stop current speech and drop everything pending. */
  cancel(): void;
  /** Drop pending speech but let the current line finish. */
  clearPending(): void;
}
