/**
 * Marker — a discrete, real-time-only moment scheduled on the Timeline
 * (a countdown second, or a coaching cue). Markers are distinct from segment
 * boundaries: boundaries are always emitted (state correctness), markers are
 * `drop-if-stale` (EVENT_MODEL §2) so a background gap does not replay them.
 *
 * Marker offsets are absolute milliseconds from workout start.
 */

export type CountdownContext = 'round' | 'rest';

/** Fires once, at the first (largest-lead) countdown moment of a segment. */
export interface CountdownStartMarker {
  readonly kind: 'countdown-start';
  readonly atMs: number;
  readonly segmentIndex: number;
  readonly context: CountdownContext;
  readonly fromSeconds: number;
}

/** Fires at each countdown threshold (10, 5, 4, 3, 2, 1). */
export interface CountdownSecondMarker {
  readonly kind: 'countdown-second';
  readonly atMs: number;
  readonly segmentIndex: number;
  readonly context: CountdownContext;
  readonly secondsRemaining: number;
}

/** Fires when a coaching cue's scheduled time is crossed. */
export interface CueMarker {
  readonly kind: 'cue';
  readonly atMs: number;
  readonly segmentIndex: number;
  readonly roundIndex: number;
  readonly cueId: string;
  readonly text: string;
}

export type Marker = CountdownStartMarker | CountdownSecondMarker | CueMarker;

/** Default countdown thresholds, seconds remaining. */
export const DEFAULT_COUNTDOWN_LEAD_SECONDS: readonly number[] = [10, 5, 4, 3, 2, 1];

/**
 * Real-time markers crossed more than this many ms late (e.g. after a
 * backgrounded gap) are dropped rather than replayed. EVENT_MODEL §2 default.
 */
export const DEFAULT_STALE_THRESHOLD_MS = 1500;
