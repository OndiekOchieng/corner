/**
 * Timeline — the immutable compilation of a `WorkoutConfig` into an ordered set
 * of Segments and a merged Schedule of boundaries + markers.
 *
 * This is the deterministic heart of the engine (ADR-0001 Option C). `stateAt`
 * and "what crosses this interval" are pure lookups over sorted, absolute-offset
 * data. Construction validates the config and the resulting schedule.
 *
 * Read-only: all arrays are frozen; there are no mutators.
 */

import type { WorkoutConfig, RoundConfig } from '../../types/workout-config';
import { DEFAULT_COUNTDOWN_LEAD_SECONDS } from './Marker';
import type { Marker } from './Marker';
import type { Segment, SegmentKind } from './Segment';

export class TimelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimelineError';
  }
}

/** What the machine enters when a boundary is crossed. */
export type EnteringSpec =
  | {
      readonly to: 'round';
      readonly roundIndex: number;
      readonly roundNumber: number;
      readonly durationMs: number;
      readonly round: RoundConfig;
    }
  | {
      readonly to: 'rest';
      readonly restRoundIndex: number;
      readonly durationMs: number;
      readonly nextRoundIndex: number;
      readonly nextRound: RoundConfig;
    }
  | { readonly to: 'finished' };

/** A segment-boundary transition point. Always emitted (state correctness). */
export interface BoundaryEntry {
  readonly kind: 'boundary';
  readonly atMs: number;
  readonly leaving: { readonly kind: SegmentKind; readonly roundIndex: number };
  readonly entering: EnteringSpec;
}

export type ScheduleEntry = Marker | BoundaryEntry;

/** Tie-break order at a shared offset: boundary first, then countdown-start, second, cue. */
function entryOrder(entry: ScheduleEntry): number {
  switch (entry.kind) {
    case 'boundary':
      return 0;
    case 'countdown-start':
      return 1;
    case 'countdown-second':
      return 2;
    case 'cue':
      return 3;
  }
}

function compareEntries(a: ScheduleEntry, b: ScheduleEntry): number {
  return a.atMs - b.atMs || entryOrder(a) - entryOrder(b);
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}
function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

function validateConfig(config: WorkoutConfig): void {
  if (!config.workoutId) {
    throw new TimelineError('WorkoutConfig.workoutId is required');
  }
  if (!isNonNegativeInt(config.warmupMs)) {
    throw new TimelineError(`warmupMs must be a non-negative integer (got ${config.warmupMs})`);
  }
  if (config.rounds.length === 0) {
    throw new TimelineError('WorkoutConfig must have at least one round');
  }
  config.rounds.forEach((round, i) => {
    if (!isPositiveInt(round.workMs)) {
      throw new TimelineError(`rounds[${i}].workMs must be a positive integer (got ${round.workMs})`);
    }
    if (!isNonNegativeInt(round.restMs)) {
      throw new TimelineError(`rounds[${i}].restMs must be a non-negative integer (got ${round.restMs})`);
    }
    round.cues.forEach((cue, j) => {
      if (!isNonNegativeInt(cue.atMs)) {
        throw new TimelineError(`rounds[${i}].cues[${j}].atMs must be a non-negative integer`);
      }
      if (cue.atMs >= round.workMs) {
        throw new TimelineError(
          `rounds[${i}].cues[${j}].atMs (${cue.atMs}) must fall within the round (< ${round.workMs}ms)`
        );
      }
    });
  });
  const leads = config.countdownLeadSeconds;
  if (leads && leads.some((s) => !isPositiveInt(s))) {
    throw new TimelineError('countdownLeadSeconds must all be positive integers');
  }
}

function buildSegments(config: WorkoutConfig): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let index = 0;

  if (config.warmupMs > 0) {
    segments.push({ kind: 'warmup', index: index++, roundIndex: -1, startMs: 0, endMs: config.warmupMs });
    cursor = config.warmupMs;
  }

  const lastRound = config.rounds.length - 1;
  config.rounds.forEach((round, i) => {
    const start = cursor;
    const end = start + round.workMs;
    segments.push({ kind: 'round', index: index++, roundIndex: i, startMs: start, endMs: end });
    cursor = end;

    if (i < lastRound && round.restMs > 0) {
      const restStart = cursor;
      const restEnd = restStart + round.restMs;
      segments.push({ kind: 'rest', index: index++, roundIndex: i, startMs: restStart, endMs: restEnd });
      cursor = restEnd;
    }
  });

  return segments;
}

function enteringFor(next: Segment, config: WorkoutConfig): EnteringSpec {
  if (next.kind === 'round') {
    return {
      to: 'round',
      roundIndex: next.roundIndex,
      roundNumber: next.roundIndex + 1,
      durationMs: next.endMs - next.startMs,
      round: config.rounds[next.roundIndex],
    };
  }
  // next.kind === 'rest'  (warmup can never be a "next" segment)
  return {
    to: 'rest',
    restRoundIndex: next.roundIndex,
    durationMs: next.endMs - next.startMs,
    nextRoundIndex: next.roundIndex + 1,
    nextRound: config.rounds[next.roundIndex + 1],
  };
}

function buildSchedule(segments: Segment[], config: WorkoutConfig): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
  const leads = (config.countdownLeadSeconds ?? DEFAULT_COUNTDOWN_LEAD_SECONDS)
    .slice()
    .sort((a, b) => b - a); // descending

  // Boundaries — one per segment end.
  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k];
    const next = segments[k + 1];
    schedule.push({
      kind: 'boundary',
      atMs: seg.endMs,
      leaving: { kind: seg.kind, roundIndex: seg.roundIndex },
      entering: next ? enteringFor(next, config) : { to: 'finished' },
    });
  }

  // Markers — countdown (round/rest) and cues (round).
  for (const seg of segments) {
    if (seg.kind === 'round' || seg.kind === 'rest') {
      const context = seg.kind;
      const fitting = leads.filter((s) => seg.endMs - s * 1000 >= seg.startMs);
      const maxLead = fitting.length > 0 ? Math.max(...fitting) : null;
      for (const s of fitting) {
        const atMs = seg.endMs - s * 1000;
        if (s === maxLead) {
          schedule.push({ kind: 'countdown-start', atMs, segmentIndex: seg.index, context, fromSeconds: s });
        }
        schedule.push({ kind: 'countdown-second', atMs, segmentIndex: seg.index, context, secondsRemaining: s });
      }
    }
    if (seg.kind === 'round') {
      const round = config.rounds[seg.roundIndex];
      for (const cue of round.cues) {
        const atMs = seg.startMs + cue.atMs;
        if (atMs >= seg.startMs && atMs < seg.endMs) {
          schedule.push({
            kind: 'cue',
            atMs,
            segmentIndex: seg.index,
            roundIndex: seg.roundIndex,
            cueId: cue.id,
            text: cue.text,
          });
        }
      }
    }
  }

  schedule.sort(compareEntries);
  return schedule;
}

function validateSchedule(segments: Segment[], schedule: ScheduleEntry[]): void {
  // Segment contiguity + strictly increasing offsets.
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].startMs !== segments[i - 1].endMs) {
      throw new TimelineError(
        `segments not contiguous at index ${i}: ${segments[i - 1].endMs} !== ${segments[i].startMs}`
      );
    }
    if (segments[i].endMs <= segments[i].startMs) {
      throw new TimelineError(`segment ${i} has non-positive duration`);
    }
  }

  // Duplicate markers (same identity at the same offset).
  const seen = new Set<string>();
  for (const e of schedule) {
    if (e.kind === 'boundary') continue;
    const key =
      e.kind === 'cue'
        ? `cue:${e.atMs}:${e.cueId}`
        : `${e.kind}:${e.atMs}:${e.kind === 'countdown-second' ? e.secondsRemaining : e.fromSeconds}`;
    if (seen.has(key)) {
      throw new TimelineError(`duplicate marker: ${key}`);
    }
    seen.add(key);
  }

  // Sorted invariant (defensive; buildSchedule sorts).
  for (let i = 1; i < schedule.length; i++) {
    if (compareEntries(schedule[i - 1], schedule[i]) > 0) {
      throw new TimelineError('schedule is not sorted');
    }
  }
}

export class Timeline {
  private readonly _segments: readonly Segment[];
  private readonly _schedule: readonly ScheduleEntry[];
  private readonly _rounds: readonly RoundConfig[];
  readonly totalMs: number;
  readonly roundCount: number;
  readonly hasWarmup: boolean;

  private constructor(
    segments: Segment[],
    schedule: ScheduleEntry[],
    rounds: readonly RoundConfig[],
    totalMs: number,
    hasWarmup: boolean
  ) {
    this._segments = Object.freeze(segments.slice());
    this._schedule = Object.freeze(schedule.slice());
    this._rounds = rounds;
    this.totalMs = totalMs;
    this.roundCount = rounds.length;
    this.hasWarmup = hasWarmup;
  }

  static build(config: WorkoutConfig): Timeline {
    validateConfig(config);
    const segments = buildSegments(config);
    const schedule = buildSchedule(segments, config);
    validateSchedule(segments, schedule);
    const totalMs = segments.length > 0 ? segments[segments.length - 1].endMs : 0;
    return new Timeline(segments, schedule, config.rounds, totalMs, config.warmupMs > 0);
  }

  get segments(): readonly Segment[] {
    return this._segments;
  }

  /** Markers only (excludes boundaries), in schedule order. */
  markers(): readonly Marker[] {
    return this._schedule.filter((e): e is Marker => e.kind !== 'boundary');
  }

  /** Schedule entries (boundaries + markers) with `fromMs < atMs <= toMs`, in order. */
  entriesInRange(fromMs: number, toMs: number): readonly ScheduleEntry[] {
    return this._schedule.filter((e) => e.atMs > fromMs && e.atMs <= toMs);
  }

  roundAt(roundIndex: number): RoundConfig {
    return this._rounds[roundIndex];
  }

  findSegment(kind: SegmentKind, roundIndex: number): Segment | undefined {
    return this._segments.find((s) => s.kind === kind && s.roundIndex === roundIndex);
  }

  /** The segment containing `elapsedMs` (last segment when at/after the end). */
  segmentAt(elapsedMs: number): Segment {
    for (const seg of this._segments) {
      if (elapsedMs >= seg.startMs && elapsedMs < seg.endMs) return seg;
    }
    return this._segments[this._segments.length - 1];
  }
}

export function buildTimeline(config: WorkoutConfig): Timeline {
  return Timeline.build(config);
}
