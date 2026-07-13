/**
 * Clock — the engine's only source of time.
 *
 * The engine core NEVER calls `Date.now()`, `performance.now()`, or
 * `requestAnimationFrame()` directly. All time enters through this injected
 * abstraction, which is what makes execution deterministic and testable.
 */

export interface Clock {
  /** Current time in milliseconds. Expected to be monotonic; the reducer clamps regressions (guard G4). */
  now(): number;
}

/**
 * Production clock. Uses `Date.now()` — an ECMAScript API available in Node,
 * not a browser API. A host may inject a monotonic (`performance.now`-based)
 * clock instead; the reducer tolerates non-monotonic sources via clamping.
 */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * Deterministic clock for tests. Time only moves when the test moves it.
 * No real timers are ever involved.
 */
export class FakeClock implements Clock {
  private t: number;

  constructor(start = 0) {
    this.t = start;
  }

  now(): number {
    return this.t;
  }

  /** Set absolute time. */
  set(ms: number): number {
    this.t = ms;
    return this.t;
  }

  /** Advance by a delta and return the new time. */
  advance(deltaMs: number): number {
    this.t += deltaMs;
    return this.t;
  }
}
