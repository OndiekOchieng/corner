/**
 * ConversationState — the coach's lightweight, mutable memory.
 *
 * It exists ONLY to make coaching better: enough to avoid repetition, space out
 * lines, keep encouragement earned, and colour wording by energy. It deliberately
 * does NOT mirror engine state (remaining time, exact phase machinery) — those
 * are read from events when needed.
 *
 * All timing is the engine's deterministic `elapsedMs`, so the same event stream
 * always yields the same conversation.
 */

import { isStructural, type CoachEnergy, type CoachIntent } from './CoachAction';
import type { Dimension } from './reinforcements';

/** Immutable view handed to the silence controller and planner. */
export interface ConversationSnapshot {
  readonly currentRound: number;
  readonly totalRounds: number;
  readonly energy: CoachEnergy;
  readonly lastIntent: CoachIntent | null;
  readonly lastSpokenElapsedMs: number | null;
  /** Last NON-structural coaching line — structural intros/countdown don't count. */
  readonly lastCoachingElapsedMs: number | null;
  readonly lastCorrectionElapsedMs: number | null;
  readonly lastEncouragementElapsedMs: number | null;
  readonly recentTexts: readonly string[];
  readonly linesSpoken: number;
}

export class ConversationState {
  private currentRound = 0;
  private totalRounds = 0;
  private energy: CoachEnergy = 'calm';
  private lastIntent: CoachIntent | null = null;
  private lastSpokenElapsedMs: number | null = null;
  private lastCoachingElapsedMs: number | null = null;
  private lastCorrectionElapsedMs: number | null = null;
  private lastEncouragementElapsedMs: number | null = null;
  private linesSpoken = 0;

  private readonly recentTexts: string[] = [];
  private readonly reminderTextAt = new Map<string, number>();
  private readonly rotations = new Map<string, number>();
  /** Coaching dimensions already taught in the CURRENT round (reset each round). */
  private readonly roundTaughtDimensions = new Set<Dimension>();

  constructor(private readonly dedupeWindow: number) {}

  // --- reads -----------------------------------------------------------------

  snapshot(): ConversationSnapshot {
    return {
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      energy: this.energy,
      lastIntent: this.lastIntent,
      lastSpokenElapsedMs: this.lastSpokenElapsedMs,
      lastCoachingElapsedMs: this.lastCoachingElapsedMs,
      lastCorrectionElapsedMs: this.lastCorrectionElapsedMs,
      lastEncouragementElapsedMs: this.lastEncouragementElapsedMs,
      recentTexts: this.recentTexts.slice(),
      linesSpoken: this.linesSpoken,
    };
  }

  isFinalRound(): boolean {
    return this.totalRounds > 0 && this.currentRound === this.totalRounds;
  }

  wasReminderRecent(text: string, nowMs: number, withinMs: number): boolean {
    const at = this.reminderTextAt.get(text);
    return at != null && nowMs - at < withinMs;
  }

  hasRecentText(text: string): boolean {
    return this.recentTexts.includes(text);
  }

  /** Has this coaching dimension already been taught in the current round? */
  wasDimensionTaughtThisRound(dimension: Dimension): boolean {
    return this.roundTaughtDimensions.has(dimension);
  }

  /** Next deterministic rotation index for a variant bank (no randomness). */
  nextRotation(key: string): number {
    const n = this.rotations.get(key) ?? 0;
    this.rotations.set(key, n + 1);
    return n;
  }

  // --- context updates (do not count as "spoken") ----------------------------

  setTotalRounds(total: number): void {
    this.totalRounds = total;
  }

  enterRound(roundNumber: number): void {
    this.currentRound = roundNumber;
    this.energy = 'steady';
    // A new round is a fresh focus — dimensions can be taught verbatim again.
    this.roundTaughtDimensions.clear();
  }

  setEnergy(energy: CoachEnergy): void {
    this.energy = energy;
  }

  // --- record what was actually said -----------------------------------------

  noteSpoken(intent: CoachIntent, text: string, elapsedMs: number, dimension?: Dimension): void {
    this.lastIntent = intent;
    this.lastSpokenElapsedMs = elapsedMs;
    this.linesSpoken += 1;

    this.recentTexts.push(text);
    while (this.recentTexts.length > this.dedupeWindow) this.recentTexts.shift();

    // Structural intros/countdown/finish don't count toward coaching density —
    // the density gap is about spacing *coaching* lines, not the trust skeleton.
    if (!isStructural(intent)) this.lastCoachingElapsedMs = elapsedMs;
    if (intent === 'correction') this.lastCorrectionElapsedMs = elapsedMs;
    if (intent === 'encouragement') this.lastEncouragementElapsedMs = elapsedMs;
    if (intent === 'reminder') this.reminderTextAt.set(text, elapsedMs);
    // Remember the dimension so the next same-dimension cue reinforces (varies).
    if (dimension) this.roundTaughtDimensions.add(dimension);
  }

  /** Full reset for a new session (also used defensively on cancel). */
  reset(): void {
    this.currentRound = 0;
    this.totalRounds = 0;
    this.energy = 'calm';
    this.lastIntent = null;
    this.lastSpokenElapsedMs = null;
    this.lastCoachingElapsedMs = null;
    this.lastCorrectionElapsedMs = null;
    this.lastEncouragementElapsedMs = null;
    this.linesSpoken = 0;
    this.recentTexts.length = 0;
    this.reminderTextAt.clear();
    this.rotations.clear();
    this.roundTaughtDimensions.clear();
  }
}
