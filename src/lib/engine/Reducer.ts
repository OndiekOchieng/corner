/**
 * Reducer — the pure heart of the engine.
 *
 *     reduce(state, command, ctx) -> { state, events }
 *
 * No mutation, no side effects, no clock/DOM/IO access. All time enters via
 * `ctx.now` (sampled from the injected Clock by the Engine shell). Invalid
 * commands are no-ops that return the state unchanged (guards G1–G6).
 *
 * Determinism: given the same (state, command, ctx) it returns the same result,
 * including event `seq` order (STATE_MACHINE §8).
 */

import type { Command } from './Commands';
import type { WorkoutEvent } from './Events';
import type { ExecutionState, Phase } from './State';
import type { Timeline } from './Timeline';
import type { WorkoutSession } from './WorkoutSession';

export interface ReducerContext {
  /** Current clock reading (ms). */
  readonly now: number;
  readonly timeline: Timeline;
  /** Real-time markers crossed more than this late are dropped. */
  readonly staleThresholdMs: number;
}

export interface ReduceResult {
  readonly state: ExecutionState;
  readonly events: readonly WorkoutEvent[];
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const isTimed = (p: Phase): boolean => p === 'warmup' || p === 'round' || p === 'rest';

/** Small typed builder that stamps + freezes an event and bumps the sequence. */
class EventSink {
  private seq: number;
  readonly events: WorkoutEvent[] = [];

  constructor(startSeq: number) {
    this.seq = startSeq;
  }

  push<E extends WorkoutEvent>(
    type: E['type'],
    at: number,
    elapsedMs: number,
    data: E['data']
  ): void {
    this.events.push(Object.freeze({ type, at, elapsedMs, seq: this.seq++, data }) as WorkoutEvent);
  }

  get nextSeq(): number {
    return this.seq;
  }
}

export function reduce(state: ExecutionState, command: Command, ctx: ReducerContext): ReduceResult {
  switch (command.type) {
    case 'StartWorkout':
      return start(state, ctx);
    case 'PauseWorkout':
      return pause(state, ctx);
    case 'ResumeWorkout':
      return resume(state, ctx);
    case 'CancelWorkout':
      return cancel(state, ctx);
    case 'AdvanceTime':
      return advance(state, ctx);
  }
}

const noop = (state: ExecutionState): ReduceResult => ({ state, events: [] });

// --- START -------------------------------------------------------------------
// G1: only valid from a fresh (`created`) session. The Engine shell resets a
// terminal session before dispatching Start (restart); Start while running or
// paused reaches here and is a no-op.
function start(state: ExecutionState, ctx: ReducerContext): ReduceResult {
  if (state.session.status !== 'created') return noop(state);

  const { now, timeline: tl } = ctx;
  const sink = new EventSink(state.nextSeq);
  const first = tl.segments[0];

  sink.push('WORKOUT_STARTED', now, 0, {
    workoutId: state.session.workoutId,
    totalRounds: tl.roundCount,
    plannedDurationMs: tl.totalMs,
    hasWarmup: tl.hasWarmup,
  });

  let phase: Phase;
  let roundIndex: number;
  if (tl.hasWarmup) {
    phase = 'warmup';
    roundIndex = -1;
    sink.push('WARMUP_STARTED', now, 0, { durationMs: first.endMs - first.startMs });
  } else {
    phase = 'round';
    roundIndex = 0;
    sink.push('ROUND_STARTED', now, 0, {
      roundIndex: 0,
      roundNumber: 1,
      round: tl.roundAt(0),
      durationMs: first.endMs - first.startMs,
    });
  }

  const session: WorkoutSession = {
    ...state.session,
    status: 'running',
    startedAt: now,
    cursorMs: 0,
    roundsCompleted: 0,
    activeDurationMs: 0,
    pausedDurationMs: 0,
  };

  return {
    state: {
      phase,
      status: 'running',
      roundIndex,
      startedAt: now,
      elapsedMs: 0,
      pausedAccumMs: 0,
      pausedAt: null,
      cursorMs: 0,
      lastNow: now,
      nextSeq: sink.nextSeq,
      session,
    },
    events: sink.events,
  };
}

// --- PAUSE (G2) --------------------------------------------------------------
function pause(state: ExecutionState, ctx: ReducerContext): ReduceResult {
  if (state.status !== 'running' || !isTimed(state.phase)) return noop(state);

  const { now } = ctx;
  const sink = new EventSink(state.nextSeq);
  sink.push('WORKOUT_PAUSED', now, state.elapsedMs, { phase: state.phase, elapsedMs: state.elapsedMs });

  const session: WorkoutSession = { ...state.session, status: 'paused', pausedAt: now };

  return {
    state: {
      ...state,
      status: 'paused',
      pausedAt: now,
      lastNow: Math.max(now, state.lastNow),
      nextSeq: sink.nextSeq,
      session,
    },
    events: sink.events,
  };
}

// --- RESUME (G3) -------------------------------------------------------------
function resume(state: ExecutionState, ctx: ReducerContext): ReduceResult {
  if (state.status !== 'paused') return noop(state);

  const { now } = ctx;
  const pausedFor = state.pausedAt != null ? Math.max(0, now - state.pausedAt) : 0;
  const pausedAccumMs = state.pausedAccumMs + pausedFor;

  const sink = new EventSink(state.nextSeq);
  sink.push('WORKOUT_RESUMED', now, state.elapsedMs, {
    phase: state.phase,
    elapsedMs: state.elapsedMs,
    pausedForMs: pausedFor,
  });

  const session: WorkoutSession = {
    ...state.session,
    status: 'running',
    pausedAt: null,
    pausedDurationMs: pausedAccumMs,
  };

  return {
    state: {
      ...state,
      status: 'running',
      pausedAt: null,
      pausedAccumMs,
      lastNow: Math.max(now, state.lastNow),
      nextSeq: sink.nextSeq,
      session,
    },
    events: sink.events,
  };
}

// --- CANCEL ------------------------------------------------------------------
// Valid from running/paused. From a terminal or created session it is a no-op
// (use Engine.reset() to leave `finished`).
function cancel(state: ExecutionState, ctx: ReducerContext): ReduceResult {
  if (state.session.status !== 'running' && state.session.status !== 'paused') {
    return noop(state);
  }

  const { now } = ctx;
  const sink = new EventSink(state.nextSeq);
  sink.push('WORKOUT_CANCELLED', now, state.elapsedMs, {
    elapsedMs: state.elapsedMs,
    roundsCompleted: state.session.roundsCompleted,
  });

  const session: WorkoutSession = {
    ...state.session,
    status: 'cancelled',
    completedAt: now,
    cursorMs: state.elapsedMs,
    activeDurationMs: state.elapsedMs,
    pausedDurationMs: state.pausedAccumMs,
  };

  // Return execution to idle; the session record is terminal (cancelled).
  return {
    state: {
      phase: 'idle',
      status: 'running',
      roundIndex: -1,
      startedAt: null,
      elapsedMs: 0,
      pausedAccumMs: 0,
      pausedAt: null,
      cursorMs: 0,
      lastNow: Math.max(now, state.lastNow),
      nextSeq: sink.nextSeq,
      session,
    },
    events: sink.events,
  };
}

// --- ADVANCE TIME (the TICK) -------------------------------------------------
function advance(state: ExecutionState, ctx: ReducerContext): ReduceResult {
  // Only running, timed phases progress. Paused freezes; idle/finished ignore.
  if (state.status !== 'running' || !isTimed(state.phase)) return noop(state);

  const tl = ctx.timeline;
  const now = Math.max(ctx.now, state.lastNow); // G4: monotonic clamp
  const startedAt = state.startedAt ?? now;
  const target = clamp(now - startedAt - state.pausedAccumMs, 0, tl.totalMs);

  // Idempotency (invariant 5): nothing new crossed → no events.
  if (target <= state.cursorMs) {
    return { state: { ...state, lastNow: now }, events: [] };
  }

  const sink = new EventSink(state.nextSeq);
  let phase = state.phase;
  let roundIndex = state.roundIndex;
  let roundsCompleted = state.session.roundsCompleted;
  let completedSession: WorkoutSession | null = null;

  for (const entry of tl.entriesInRange(state.cursorMs, target)) {
    const atClock = startedAt + state.pausedAccumMs + entry.atMs;

    if (entry.kind === 'boundary') {
      // Leaving the current segment.
      if (entry.leaving.kind === 'warmup') {
        sink.push('WARMUP_COMPLETED', atClock, entry.atMs, {});
      } else if (entry.leaving.kind === 'round') {
        roundsCompleted += 1;
        sink.push('ROUND_COMPLETED', atClock, entry.atMs, {
          roundIndex: entry.leaving.roundIndex,
          roundNumber: entry.leaving.roundIndex + 1,
        });
      } else {
        sink.push('REST_COMPLETED', atClock, entry.atMs, { restIndex: entry.leaving.roundIndex });
      }

      // Entering the next segment (or finishing).
      const en = entry.entering;
      if (en.to === 'round') {
        phase = 'round';
        roundIndex = en.roundIndex;
        sink.push('ROUND_STARTED', atClock, entry.atMs, {
          roundIndex: en.roundIndex,
          roundNumber: en.roundNumber,
          round: en.round,
          durationMs: en.durationMs,
        });
      } else if (en.to === 'rest') {
        phase = 'rest';
        roundIndex = en.restRoundIndex;
        sink.push('REST_STARTED', atClock, entry.atMs, {
          durationMs: en.durationMs,
          nextRoundIndex: en.nextRoundIndex,
          nextRound: en.nextRound,
        });
      } else {
        phase = 'finished';
        completedSession = {
          ...state.session,
          status: 'completed',
          completedAt: atClock,
          cursorMs: tl.totalMs,
          roundsCompleted,
          activeDurationMs: tl.totalMs,
          pausedDurationMs: state.pausedAccumMs,
        };
        sink.push('WORKOUT_COMPLETED', atClock, tl.totalMs, completedSession);
      }
    } else {
      // Real-time marker: drop if crossed too late (drop-if-stale).
      const lateBy = target - entry.atMs;
      if (lateBy > ctx.staleThresholdMs) continue;

      if (entry.kind === 'countdown-start') {
        sink.push('COUNTDOWN_STARTED', atClock, entry.atMs, {
          context: entry.context,
          fromSeconds: entry.fromSeconds,
        });
      } else if (entry.kind === 'countdown-second') {
        sink.push('COUNTDOWN_SECOND', atClock, entry.atMs, {
          context: entry.context,
          secondsRemaining: entry.secondsRemaining,
        });
      } else {
        sink.push('COACH_CUE', atClock, entry.atMs, {
          roundIndex: entry.roundIndex,
          cueId: entry.cueId,
          text: entry.text,
          atMs: entry.atMs,
        });
      }
    }
  }

  const session: WorkoutSession =
    completedSession ??
    {
      ...state.session,
      cursorMs: target,
      roundsCompleted,
      activeDurationMs: target,
      pausedDurationMs: state.pausedAccumMs,
    };

  return {
    state: {
      ...state,
      phase,
      roundIndex,
      elapsedMs: target,
      cursorMs: target,
      lastNow: now,
      nextSeq: sink.nextSeq,
      session,
    },
    events: sink.events,
  };
}
