/**
 * Engine — the thin, imperative shell around the pure reducer.
 *
 * Responsibilities (and nothing more): receive commands, sample the injected
 * Clock, invoke the reducer, hold the current state, and append emitted events
 * to a log. It knows NOTHING about subscribers, rendering, speech, audio,
 * storage, or the network — a host adapter (PR-004) builds an event bus and
 * subscribers on top of `events()` / `dispatch()`.
 *
 * Public API: dispatch · state · events · reset (+ snapshot/session/timeline).
 */

import { SystemClock, type Clock } from './Clock';
import { advanceTime, cancelWorkout, pauseWorkout, resumeWorkout, startWorkout, type Command } from './Commands';
import type { WorkoutEvent } from './Events';
import { reduce } from './Reducer';
import {
  createInitialExecutionState,
  deriveSnapshot,
  type ExecutionState,
  type WorkoutSnapshot,
} from './State';
import { buildTimeline, type Timeline } from './Timeline';
import { DEFAULT_STALE_THRESHOLD_MS } from './Marker';
import type { WorkoutConfig } from '../../types/workout-config';
import type { WorkoutSession } from './WorkoutSession';

export interface EngineOptions {
  readonly clock?: Clock;
  /** Deterministic session-id factory (inject in tests). Defaults to an instance-scoped counter. */
  readonly idFactory?: () => string;
  readonly staleThresholdMs?: number;
}

export class Engine {
  private readonly config: WorkoutConfig;
  private readonly timeline: Timeline;
  private readonly clock: Clock;
  private readonly idFactory: () => string;
  private readonly staleThresholdMs: number;

  private _state: ExecutionState;
  private _log: WorkoutEvent[] = [];
  private idCounter = 0;

  constructor(config: WorkoutConfig, options: EngineOptions = {}) {
    this.config = config;
    this.timeline = buildTimeline(config);
    this.clock = options.clock ?? new SystemClock();
    this.idFactory = options.idFactory ?? (() => `session-${++this.idCounter}`);
    this.staleThresholdMs = options.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
    this._state = createInitialExecutionState(this.timeline, this.config, this.idFactory());
  }

  /** Apply a command; returns the events it produced (also appended to the log). */
  dispatch(command: Command): readonly WorkoutEvent[] {
    // Restart from a terminal session: mint a fresh `created` session first (G1).
    if (command.type === 'StartWorkout') {
      const s = this._state.session.status;
      if (s === 'completed' || s === 'cancelled') {
        this._state = createInitialExecutionState(this.timeline, this.config, this.idFactory());
      }
    }

    const { state, events } = reduce(this._state, command, {
      now: this.clock.now(),
      timeline: this.timeline,
      staleThresholdMs: this.staleThresholdMs,
    });

    this._state = state;
    for (const e of events) this._log.push(e);
    return events;
  }

  /** Immutable execution state. */
  state(): ExecutionState {
    return this._state;
  }

  /** Derived render snapshot (state channel). */
  snapshot(): WorkoutSnapshot {
    return deriveSnapshot(this._state, this.timeline);
  }

  /** The current persisted-execution record. */
  session(): WorkoutSession {
    return this._state.session;
  }

  /** The full ordered event log for this engine instance. */
  events(): readonly WorkoutEvent[] {
    return this._log;
  }

  /** The immutable compiled timeline (inspectable for tests / previews). */
  getTimeline(): Timeline {
    return this.timeline;
  }

  /** Reset to a fresh `created` session and clear the log. */
  reset(): void {
    this._state = createInitialExecutionState(this.timeline, this.config, this.idFactory());
    this._log = [];
  }

  // Convenience command wrappers (sugar over dispatch) -------------------------
  start(): readonly WorkoutEvent[] {
    return this.dispatch(startWorkout());
  }
  pause(): readonly WorkoutEvent[] {
    return this.dispatch(pauseWorkout());
  }
  resume(): readonly WorkoutEvent[] {
    return this.dispatch(resumeWorkout());
  }
  cancel(): readonly WorkoutEvent[] {
    return this.dispatch(cancelWorkout());
  }
  advance(): readonly WorkoutEvent[] {
    return this.dispatch(advanceTime());
  }
}
