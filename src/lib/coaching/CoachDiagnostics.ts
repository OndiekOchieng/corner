/**
 * CoachDiagnostics — observability for coaching judgement.
 *
 * Records what the runtime decided (generated / spoken / discarded / silenced /
 * interrupted), how deep the queue went, coaching density, and how many repeats
 * it avoided. Exposes immutable snapshots only; recording never affects
 * behaviour. Density uses the engine's `elapsedMs`, so it is deterministic.
 */

import type { CoachIntent } from './CoachAction';

export interface CoachDiagnosticsSnapshot {
  readonly actionsGenerated: number;
  readonly actionsSpoken: number;
  readonly actionsDiscarded: number;
  readonly actionsExpired: number;
  readonly silenceDecisions: number;
  readonly interruptions: number;
  readonly repetitionAvoided: number;
  readonly queueDepth: number;
  readonly peakQueueDepth: number;
  /** Spoken lines per minute of session elapsed. */
  readonly averageCoachingDensity: number;
  readonly spokenByIntent: Readonly<Record<string, number>>;
  readonly lastElapsedMs: number;
}

export class CoachDiagnostics {
  private actionsGenerated = 0;
  private actionsSpoken = 0;
  private actionsDiscarded = 0;
  private actionsExpired = 0;
  private silenceDecisions = 0;
  private interruptions = 0;
  private repetitionAvoided = 0;
  private queueDepth = 0;
  private peakQueueDepth = 0;
  private lastElapsedMs = 0;
  private readonly spokenByIntent = new Map<CoachIntent, number>();

  recordGenerated(): void {
    this.actionsGenerated += 1;
  }

  recordSpoken(intent: CoachIntent): void {
    this.actionsSpoken += 1;
    this.spokenByIntent.set(intent, (this.spokenByIntent.get(intent) ?? 0) + 1);
  }

  recordDiscarded(n = 1): void {
    this.actionsDiscarded += n;
  }

  recordExpired(n = 1): void {
    this.actionsExpired += n;
  }

  recordSilence(): void {
    this.silenceDecisions += 1;
  }

  recordInterruptions(n: number): void {
    this.interruptions += n;
  }

  recordRepetitionAvoided(): void {
    this.repetitionAvoided += 1;
  }

  recordQueueDepth(depth: number, peak: number): void {
    this.queueDepth = depth;
    if (peak > this.peakQueueDepth) this.peakQueueDepth = peak;
  }

  recordElapsed(elapsedMs: number): void {
    if (elapsedMs > this.lastElapsedMs) this.lastElapsedMs = elapsedMs;
  }

  snapshot(): CoachDiagnosticsSnapshot {
    const minutes = this.lastElapsedMs > 0 ? this.lastElapsedMs / 60000 : 0;
    const density = minutes > 0 ? this.actionsSpoken / minutes : 0;
    const spokenByIntent: Record<string, number> = {};
    for (const [intent, count] of this.spokenByIntent) spokenByIntent[intent] = count;

    return {
      actionsGenerated: this.actionsGenerated,
      actionsSpoken: this.actionsSpoken,
      actionsDiscarded: this.actionsDiscarded,
      actionsExpired: this.actionsExpired,
      silenceDecisions: this.silenceDecisions,
      interruptions: this.interruptions,
      repetitionAvoided: this.repetitionAvoided,
      queueDepth: this.queueDepth,
      peakQueueDepth: this.peakQueueDepth,
      averageCoachingDensity: Math.round(density * 100) / 100,
      spokenByIntent,
      lastElapsedMs: this.lastElapsedMs,
    };
  }

  reset(): void {
    this.actionsGenerated = 0;
    this.actionsSpoken = 0;
    this.actionsDiscarded = 0;
    this.actionsExpired = 0;
    this.silenceDecisions = 0;
    this.interruptions = 0;
    this.repetitionAvoided = 0;
    this.queueDepth = 0;
    this.peakQueueDepth = 0;
    this.lastElapsedMs = 0;
    this.spokenByIntent.clear();
  }
}
