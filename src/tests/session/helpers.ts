import { Engine, FakeClock, type WorkoutSession } from '../../lib/engine';
import type { SessionRecord } from '../../lib/session';
import { makeConfig, seqIds } from '../fixtures';

/** Run a fresh engine to `cursorMs` and return its live session. */
export function sessionAt(cursorMs: number): WorkoutSession {
  const clock = new FakeClock(0);
  const engine = new Engine(makeConfig(), { clock, idFactory: seqIds() });
  engine.start();
  for (let t = 250; t < cursorMs; t += 250) {
    clock.set(t);
    engine.advance();
  }
  clock.set(cursorMs);
  engine.advance();
  return engine.session();
}

/** Run to completion and return the completed session. */
export function completedSession(): WorkoutSession {
  return sessionAt(46000);
}

export function recordFrom(session: WorkoutSession, savedAt = 0): SessionRecord {
  return { session, rating: null, notes: null, coach: null, savedAt };
}

/** A `now` controlled by the test. */
export function controllableNow(): { now: () => number; set: (v: number) => void; advance: (d: number) => void } {
  let t = 0;
  return {
    now: () => t,
    set: (v: number) => {
      t = v;
    },
    advance: (d: number) => {
      t += d;
    },
  };
}
