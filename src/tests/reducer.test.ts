import { describe, it, expect } from 'vitest';
import {
  Engine,
  FakeClock,
  reduce,
  createInitialExecutionState,
  buildTimeline,
  advanceTime,
  startWorkout,
} from '../lib/engine';
import { makeConfig, makeEngine, play, lifecycle, byType, seqIds } from './fixtures';

describe('Fast-forward (background gap) reconciliation', () => {
  it('lands in the correct terminal state via a single large tick', () => {
    const h = makeEngine();
    h.engine.start();
    h.clock.set(46000); // one huge jump (e.g. phone locked)
    h.engine.advance();

    expect(lifecycle(h.engine.events())).toEqual([
      'WORKOUT_STARTED',
      'WARMUP_STARTED',
      'WARMUP_COMPLETED',
      'ROUND_STARTED',
      'ROUND_COMPLETED',
      'REST_STARTED',
      'REST_COMPLETED',
      'ROUND_STARTED',
      'ROUND_COMPLETED',
      'REST_STARTED',
      'REST_COMPLETED',
      'ROUND_STARTED',
      'ROUND_COMPLETED',
      'WORKOUT_COMPLETED',
    ]);
    expect(h.engine.session().status).toBe('completed');
  });

  it('drops stale real-time markers instead of replaying them', () => {
    const h = makeEngine();
    h.engine.start();
    h.clock.set(46000);
    h.engine.advance();

    // Mid-workout countdown-starts and all cues are far in the past → dropped.
    expect(byType(h.engine.events(), 'COUNTDOWN_STARTED')).toHaveLength(0);
    expect(byType(h.engine.events(), 'COACH_CUE')).toHaveLength(0);
    // No burst of countdown seconds (only ones within the stale window may survive).
    expect(byType(h.engine.events(), 'COUNTDOWN_SECOND').length).toBeLessThanOrEqual(1);
  });

  it('respects a custom stale threshold', () => {
    // With an effectively-infinite threshold, nothing is dropped on fast-forward.
    const h = makeEngine(makeConfig(), Number.MAX_SAFE_INTEGER);
    h.engine.start();
    h.clock.set(46000);
    h.engine.advance();
    expect(byType(h.engine.events(), 'COACH_CUE')).toHaveLength(3);
  });
});

describe('Cadence independence (property-style)', () => {
  const run = (step: number) => {
    const clock = new FakeClock(0);
    const engine = new Engine(makeConfig(), { clock, idFactory: seqIds() });
    engine.start();
    for (let t = step; t <= 46000; t += step) {
      clock.set(t);
      engine.advance();
    }
    return engine.events();
  };

  it('produces identical lifecycle + countdown output regardless of tick size', () => {
    // All step sizes are < the 1500ms stale window, so markers stay fresh.
    const stepsToTry = [50, 100, 250, 500, 1000];
    const baseline = run(1000);
    const baseLifecycle = lifecycle(baseline);
    const baseCue = byType(baseline, 'COACH_CUE').map((e) => e.data.text);
    const baseCount = byType(baseline, 'COUNTDOWN_SECOND').length;

    for (const step of stepsToTry) {
      const evs = run(step);
      expect(lifecycle(evs)).toEqual(baseLifecycle);
      expect(byType(evs, 'COACH_CUE').map((e) => e.data.text)).toEqual(baseCue);
      expect(byType(evs, 'COUNTDOWN_SECOND').length).toBe(baseCount);
    }
  });
});

describe('Determinism', () => {
  it('two identical input sequences yield byte-identical event logs', () => {
    const runOnce = () => {
      const clock = new FakeClock(0);
      const engine = new Engine(makeConfig(), { clock, idFactory: seqIds() });
      engine.start();
      play({ engine, clock }, 46000);
      return engine.events();
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('completes with exactly roundCount ROUND_STARTED and ROUND_COMPLETED', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 46000);
    expect(byType(h.engine.events(), 'ROUND_STARTED')).toHaveLength(3);
    expect(byType(h.engine.events(), 'ROUND_COMPLETED')).toHaveLength(3);
    expect(byType(h.engine.events(), 'WORKOUT_COMPLETED')).toHaveLength(1);
  });
});

describe('Reducer purity', () => {
  it('does not mutate the input state', () => {
    const config = makeConfig();
    const timeline = buildTimeline(config);
    const idle = createInitialExecutionState(timeline, config, 'sX');
    // Move to a running state so AdvanceTime produces a new state.
    const running = reduce(idle, startWorkout(), { now: 0, timeline, staleThresholdMs: 1500 }).state;
    const before = JSON.stringify(running);

    const result = reduce(running, advanceTime(), { now: 5000, timeline, staleThresholdMs: 1500 });

    expect(JSON.stringify(running)).toBe(before); // input untouched
    expect(result.state).not.toBe(running); // new object returned
    expect(result.state.phase).toBe('round'); // crossed the warmup boundary
  });

  it('is a no-op when advancing an idle (not-started) state', () => {
    const config = makeConfig();
    const timeline = buildTimeline(config);
    const state = createInitialExecutionState(timeline, config, 'sY');
    const result = reduce(state, advanceTime(), { now: 10000, timeline, staleThresholdMs: 1500 });
    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe('idle');
  });
});
