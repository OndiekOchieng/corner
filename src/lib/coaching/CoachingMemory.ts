/**
 * CoachingMemory — the coach's lightweight, mutable memory.
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
export interface CoachingMemorySnapshot {
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
  // --- Coaching memory (PR-020C) --------------------------------------------
  /** Every dimension taught at least once this SESSION (not just this round). */
  readonly taughtDimensions: readonly Dimension[];
  /** The dimension of the most recent teaching/reinforcement (for encouragement reference). */
  readonly lastTaughtDimension: Dimension | null;
  /** How many times each dimension has been reinforced this session. */
  readonly reinforcementCounts: Readonly<Record<string, number>>;
}

export class CoachingMemory {
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

  // --- Coaching memory (PR-020C): remembers teaching, not dialogue -----------
  /** Dimensions taught at least once this SESSION (persists across rounds). */
  private readonly taughtDimensionsSession = new Set<Dimension>();
  /** Reinforcement count per dimension (concept progression). */
  private readonly reinforcementCounts = new Map<Dimension, number>();
  private lastTaughtDimensionValue: Dimension | null = null;
  private lastTechniqueValue: string | null = null;
  private lastAnchorElapsedMs: number | null = null;
  /** Engine elapsed at which the current round ends (PR-021), for deadline preemption. */
  private roundEndsAtElapsedMs: number | null = null;
  /** Boxing call signs the coach has already introduced (teach-before-shorthand). */
  private readonly introducedCallSigns = new Set<string>();

  constructor(private readonly dedupeWindow: number) {}

  // --- reads -----------------------------------------------------------------

  snapshot(): CoachingMemorySnapshot {
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
      taughtDimensions: [...this.taughtDimensionsSession],
      lastTaughtDimension: this.lastTaughtDimensionValue,
      reinforcementCounts: Object.fromEntries(this.reinforcementCounts),
    };
  }

  /** How many times this dimension has been reinforced this session (concept progression). */
  reinforcementCount(dimension: Dimension): number {
    return this.reinforcementCounts.get(dimension) ?? 0;
  }

  /** The dimension of the most recent teaching — what an encouragement can reference. */
  lastTaughtDimension(): Dimension | null {
    return this.lastTaughtDimensionValue;
  }

  /** The exact wording of the most recent authored technique cue. */
  lastTechnique(): string | null {
    return this.lastTechniqueValue;
  }

  /** Has this dimension been taught anywhere in the session yet? */
  wasDimensionTaughtThisSession(dimension: Dimension): boolean {
    return this.taughtDimensionsSession.has(dimension);
  }

  // --- Boxing vocabulary (teach a call sign once, then use the shorthand) -----
  hasIntroducedCallSign(sign: string): boolean {
    return this.introducedCallSigns.has(sign);
  }

  noteCallSignIntroduced(sign: string): void {
    this.introducedCallSigns.add(sign);
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

  /** Record when the current round ends (PR-021) so coaching can respect the countdown. */
  setRoundEnd(endElapsedMs: number): void {
    this.roundEndsAtElapsedMs = endElapsedMs;
  }

  /** Engine elapsed at which the current round ends, or null outside a round. */
  roundEndsAtMs(): number | null {
    return this.roundEndsAtElapsedMs;
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
    if (intent === 'time_anchor') this.lastAnchorElapsedMs = elapsedMs;

    // Remember the dimension so the next same-dimension cue reinforces (varies).
    if (dimension) this.roundTaughtDimensions.add(dimension);

    // Coaching memory (PR-020C): remember the LESSON across the whole session.
    if (intent === 'reinforcement' && dimension) {
      this.reinforcementCounts.set(dimension, (this.reinforcementCounts.get(dimension) ?? 0) + 1);
    }
    const teaches =
      intent === 'instruction' ||
      intent === 'reminder' ||
      intent === 'correction' ||
      intent === 'reinforcement';
    if (teaches && dimension && dimension !== 'general') {
      this.taughtDimensionsSession.add(dimension);
      this.lastTaughtDimensionValue = dimension;
    }
    if (intent === 'instruction' || intent === 'reminder' || intent === 'correction') {
      this.lastTechniqueValue = text;
    }
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
    this.taughtDimensionsSession.clear();
    this.reinforcementCounts.clear();
    this.lastTaughtDimensionValue = null;
    this.lastTechniqueValue = null;
    this.lastAnchorElapsedMs = null;
    this.roundEndsAtElapsedMs = null;
    this.introducedCallSigns.clear();
  }
}
