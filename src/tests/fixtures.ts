import type { WorkoutConfig, RoundConfig, CueConfig } from '../types/workout-config';
import type { WorkoutEvent, WorkoutEventType } from '../lib/engine';
import { Engine, FakeClock } from '../lib/engine';

export function cue(id: string, text: string, atMs: number): CueConfig {
  return { id, text, atMs };
}

export function round(
  id: string,
  name: string,
  workMs: number,
  restMs: number,
  cues: readonly CueConfig[] = []
): RoundConfig {
  return { id, name, workMs, restMs, cues };
}

/**
 * Canonical fixture: 4s warmup + three 12s rounds with 3s rests (none after the
 * last), one cue per round.
 *
 * Timeline: warmup 0–4000 · round0 4000–16000 · rest0 16000–19000 ·
 * round1 19000–31000 · rest1 31000–34000 · round2 34000–46000 (total 46000).
 */
export function makeConfig(overrides: Partial<WorkoutConfig> = {}): WorkoutConfig {
  return {
    schemaVersion: 1,
    workoutId: 'w1',
    warmupMs: 4000,
    rounds: [
      round('r0', 'Jab', 12000, 3000, [cue('c0', 'Jab', 6000)]),
      round('r1', 'Cross', 12000, 3000, [cue('c1', 'Cross', 6000)]),
      round('r2', 'Hook', 12000, 0, [cue('c2', 'Hook', 6000)]),
    ],
    ...overrides,
  };
}

/** Deterministic session-id factory. */
export function seqIds(): () => string {
  let n = 0;
  return () => `s${++n}`;
}

export interface Harness {
  engine: Engine;
  clock: FakeClock;
}

export function makeEngine(config: WorkoutConfig = makeConfig(), staleThresholdMs?: number): Harness {
  const clock = new FakeClock(0);
  const engine = new Engine(config, { clock, idFactory: seqIds(), staleThresholdMs });
  return { engine, clock };
}

/** Step the clock from now to `toMs` in `step` increments, ticking each step. */
export function play(h: Harness, toMs: number, step = 250): void {
  let t = h.clock.now();
  while (t < toMs) {
    t = Math.min(t + step, toMs);
    h.clock.set(t);
    h.engine.advance();
  }
}

export const LIFECYCLE_TYPES: ReadonlySet<WorkoutEventType> = new Set<WorkoutEventType>([
  'WORKOUT_STARTED',
  'WARMUP_STARTED',
  'WARMUP_COMPLETED',
  'ROUND_STARTED',
  'ROUND_COMPLETED',
  'REST_STARTED',
  'REST_COMPLETED',
  'WORKOUT_PAUSED',
  'WORKOUT_RESUMED',
  'WORKOUT_COMPLETED',
  'WORKOUT_CANCELLED',
]);

export const types = (events: readonly WorkoutEvent[]): WorkoutEventType[] => events.map((e) => e.type);

export const lifecycle = (events: readonly WorkoutEvent[]): WorkoutEventType[] =>
  types(events).filter((t) => LIFECYCLE_TYPES.has(t));

export const byType = <T extends WorkoutEventType>(
  events: readonly WorkoutEvent[],
  type: T
): Extract<WorkoutEvent, { type: T }>[] =>
  events.filter((e): e is Extract<WorkoutEvent, { type: T }> => e.type === type);
