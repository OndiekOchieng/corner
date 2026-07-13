/**
 * State — the engine's execution context (the FSM's extended state) plus the
 * derived read-only snapshot consumers render from.
 *
 * `ExecutionState` is immutable: the reducer returns a new state, never mutates.
 * It embeds the `WorkoutSession` (persisted execution state) so a single value
 * carries both live execution and the durable record.
 */

import type { Timeline } from './Timeline';
import type { WorkoutConfig } from '../../types/workout-config';
import { createSession, type WorkoutSession } from './WorkoutSession';

export type Phase = 'idle' | 'warmup' | 'round' | 'rest' | 'finished';
export type Status = 'running' | 'paused';

export interface ExecutionState {
  readonly phase: Phase;
  /** Whether the clock advances. Meaningful only in timed phases. */
  readonly status: Status;
  /** 0-based active round; -1 outside rounds (idle / warmup / finished). */
  readonly roundIndex: number;

  readonly startedAt: number | null;
  /** Derived elapsed ms (excludes paused time). */
  readonly elapsedMs: number;
  readonly pausedAccumMs: number;
  readonly pausedAt: number | null;

  /** Highest elapsed already reconciled — the marker/boundary cursor. */
  readonly cursorMs: number;
  /** Last clock value observed, for the monotonic-clock guard (G4). */
  readonly lastNow: number;
  /** Next event sequence number (session-monotonic). */
  readonly nextSeq: number;

  readonly session: WorkoutSession;
}

/** The continuous state-channel snapshot the UI renders (EVENT_MODEL §1). */
export interface WorkoutSnapshot {
  readonly phase: Phase;
  readonly status: Status;
  readonly roundIndex: number;
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly remainingMs: number;
  readonly remainingSeconds: number;
  readonly elapsedMs: number;
  readonly phaseDurationMs: number;
  readonly progress: number;
}

export function createInitialExecutionState(
  timeline: Timeline,
  config: WorkoutConfig,
  sessionId: string
): ExecutionState {
  return {
    phase: 'idle',
    status: 'running',
    roundIndex: -1,
    startedAt: null,
    elapsedMs: 0,
    pausedAccumMs: 0,
    pausedAt: null,
    cursorMs: 0,
    lastNow: 0,
    nextSeq: 0,
    session: createSession({
      id: sessionId,
      workoutId: config.workoutId,
      plannedRounds: timeline.roundCount,
      plannedDurationMs: timeline.totalMs,
    }),
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Derive the render snapshot from execution state + timeline (pure). */
export function deriveSnapshot(state: ExecutionState, timeline: Timeline): WorkoutSnapshot {
  const totalRounds = timeline.roundCount;
  const roundNumber = state.roundIndex >= 0 ? state.roundIndex + 1 : 0;

  if (state.phase === 'idle' || state.phase === 'finished') {
    return {
      phase: state.phase,
      status: state.status,
      roundIndex: state.roundIndex,
      roundNumber,
      totalRounds,
      remainingMs: 0,
      remainingSeconds: 0,
      elapsedMs: state.elapsedMs,
      phaseDurationMs: 0,
      progress: state.phase === 'finished' ? 1 : 0,
    };
  }

  const segment =
    state.phase === 'warmup'
      ? timeline.findSegment('warmup', -1)
      : timeline.findSegment(state.phase, state.roundIndex);

  if (!segment) {
    // Defensive: should not happen for a valid timed phase.
    return {
      phase: state.phase,
      status: state.status,
      roundIndex: state.roundIndex,
      roundNumber,
      totalRounds,
      remainingMs: 0,
      remainingSeconds: 0,
      elapsedMs: state.elapsedMs,
      phaseDurationMs: 0,
      progress: 0,
    };
  }

  const phaseDurationMs = segment.endMs - segment.startMs;
  const remainingMs = clamp(segment.endMs - state.elapsedMs, 0, phaseDurationMs);
  const intoSegment = clamp(state.elapsedMs - segment.startMs, 0, phaseDurationMs);

  return {
    phase: state.phase,
    status: state.status,
    roundIndex: state.roundIndex,
    roundNumber,
    totalRounds,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    elapsedMs: state.elapsedMs,
    phaseDurationMs,
    progress: phaseDurationMs > 0 ? intoSegment / phaseDurationMs : 0,
  };
}
