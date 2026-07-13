/**
 * SessionRestorer — reconstructs a running engine at the saved cursor WITHOUT
 * replaying history (no duplicated events / speech / bells).
 *
 * Strategy: build a fresh engine on a `ResumeClock`, then drive it privately
 * (start → jump to cursorMs) so the fast-forward's events are DISCARDED — they
 * are never handed to the Event Runtime. The caller then wraps the primed engine
 * in a live controller/bus, and only events from the cursor onward are published.
 *
 * This needs no engine change: the engine already fast-forwards deterministically
 * (PR-003), and the runtime only publishes events the controller forwards.
 */

import { Engine, type Clock, type WorkoutConfig } from '../engine';
import type { SessionRecord } from './SessionSerializer';

/** A clock that reports `real.now() + offset`, letting us seek elapsed time. */
export class ResumeClock implements Clock {
  private readonly real: Clock;
  private offsetMs: number;

  constructor(real: Clock, offsetMs = 0) {
    this.real = real;
    this.offsetMs = offsetMs;
  }

  now(): number {
    return this.real.now() + this.offsetMs;
  }

  setOffset(offsetMs: number): void {
    this.offsetMs = offsetMs;
  }
}

export interface RestoredEngine {
  readonly engine: Engine;
  /** The clock the live controller must use (continues from the cursor). */
  readonly clock: Clock;
  readonly wasPaused: boolean;
  readonly cursorMs: number;
}

export class SessionRestorer {
  restore(record: SessionRecord, config: WorkoutConfig, realClock: Clock): RestoredEngine {
    const cursorMs = record.session.cursorMs;
    const resumeClock = new ResumeClock(realClock, 0);

    // Reuse the SAME session id so the restore is idempotent w.r.t. the store.
    const engine = new Engine(config, { clock: resumeClock, idFactory: () => record.session.id });

    // Prime silently. These events are intentionally NOT published anywhere.
    engine.start(); // anchors startedAt at realClock.now()
    resumeClock.setOffset(cursorMs); // seek: now() jumps forward by cursorMs
    engine.advance(); // elapsed → cursorMs (fast-forward; events discarded)

    const wasPaused = record.session.status === 'paused';
    if (wasPaused) engine.pause(); // restore the paused state (event discarded)

    return { engine, clock: resumeClock, wasPaused, cursorMs };
  }
}
