import { describe, it, expect } from 'vitest';
import type { CountdownSecondData, RoundStartedData, WorkoutResumedData } from '../lib/engine';
import { makeConfig, makeEngine, play, lifecycle, types, byType } from './fixtures';

describe('Engine — start', () => {
  it('emits WORKOUT_STARTED then WARMUP_STARTED and enters warmup', () => {
    const h = makeEngine();
    const events = h.engine.start();
    expect(types(events)).toEqual(['WORKOUT_STARTED', 'WARMUP_STARTED']);
    expect(h.engine.snapshot().phase).toBe('warmup');
    expect(h.engine.session().status).toBe('running');
    expect(h.engine.session().id).toBe('s1');
  });

  it('skips warmup and enters round 0 when warmupMs is 0', () => {
    const h = makeEngine(makeConfig({ warmupMs: 0 }));
    const events = h.engine.start();
    expect(types(events)).toEqual(['WORKOUT_STARTED', 'ROUND_STARTED']);
    expect(h.engine.snapshot().phase).toBe('round');
    expect(h.engine.snapshot().roundNumber).toBe(1);
  });
});

describe('Engine — full multi-round workout', () => {
  it('runs idle→…→finished with correctly ordered lifecycle events', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 46000);

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

    const session = h.engine.session();
    expect(session.status).toBe('completed');
    expect(session.roundsCompleted).toBe(3);
    expect(session.activeDurationMs).toBe(46000);
    expect(h.engine.snapshot().phase).toBe('finished');
  });

  it('speaks each round countdown once, in order (10,5,4,3,2,1)', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 16000); // through the end of round 0

    const round0Counts = byType(h.engine.events(), 'COUNTDOWN_SECOND')
      .map((e) => e.data as CountdownSecondData)
      .filter((d) => d.context === 'round');
    expect(round0Counts.map((d) => d.secondsRemaining)).toEqual([10, 5, 4, 3, 2, 1]);

    // Exactly one round-context countdown-start (round 0). (A 3s rest legitimately
    // fires its own rest-context countdown-start at the boundary.)
    const roundStarts = byType(h.engine.events(), 'COUNTDOWN_STARTED').filter(
      (e) => e.data.context === 'round'
    );
    expect(roundStarts).toHaveLength(1);
  });

  it('emits each coaching cue exactly once', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 46000);
    const cues = byType(h.engine.events(), 'COACH_CUE').map((e) => e.data.text);
    expect(cues).toEqual(['Jab', 'Cross', 'Hook']);
  });

  it('ROUND_STARTED carries the round config and 1-based number', () => {
    const h = makeEngine(makeConfig({ warmupMs: 0 }));
    const events = h.engine.start();
    const data = byType(events, 'ROUND_STARTED')[0].data as RoundStartedData;
    expect(data.roundNumber).toBe(1);
    expect(data.round.name).toBe('Jab');
    expect(data.durationMs).toBe(12000);
  });
});

describe('Engine — pause / resume', () => {
  it('freezes the clock while paused and conserves elapsed time', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 10000);
    expect(h.engine.snapshot().elapsedMs).toBe(10000);

    h.engine.pause();
    expect(h.engine.session().status).toBe('paused');

    // Time passes while paused; advancing must NOT progress.
    h.clock.set(13000);
    expect(h.engine.advance()).toEqual([]);
    expect(h.engine.snapshot().elapsedMs).toBe(10000);

    // Resume after 5s of pause.
    h.clock.set(15000);
    const resumed = h.engine.resume();
    const data = resumed[0].data as WorkoutResumedData;
    expect(resumed[0].type).toBe('WORKOUT_RESUMED');
    expect(data.pausedForMs).toBe(5000);

    // Round 0 ends at elapsed 16000 → clock 21000 (16000 + 5000 paused).
    h.clock.set(21000);
    const events = h.engine.advance();
    expect(types(events)).toContain('ROUND_COMPLETED');
    expect(h.engine.snapshot().elapsedMs).toBe(16000);
  });

  it('ignores pause when already paused and resume when running', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 5000);
    h.engine.pause();
    expect(h.engine.pause()).toEqual([]); // double pause → no-op
    h.engine.resume();
    expect(h.engine.resume()).toEqual([]); // double resume → no-op
  });
});

describe('Engine — cancel', () => {
  it('emits WORKOUT_CANCELLED, returns to idle, and marks the session cancelled', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 10000);
    const events = h.engine.cancel();
    expect(events[0].type).toBe('WORKOUT_CANCELLED');
    expect(events[0].data).toMatchObject({ roundsCompleted: 0 });
    expect(h.engine.snapshot().phase).toBe('idle');
    expect(h.engine.session().status).toBe('cancelled');
  });

  it('allows a fresh workout to start after cancel (new session id)', () => {
    const h = makeEngine();
    h.engine.start();
    const firstId = h.engine.session().id;
    play(h, 8000);
    h.engine.cancel();

    h.engine.start(); // restart from terminal → reset to a new session
    expect(h.engine.session().id).not.toBe(firstId);
    expect(h.engine.session().status).toBe('running');
    expect(h.engine.snapshot().phase).toBe('warmup');
  });
});

describe('Engine — invalid / duplicate commands never corrupt state', () => {
  it('ignores commands issued while idle', () => {
    const h = makeEngine();
    expect(h.engine.advance()).toEqual([]);
    expect(h.engine.pause()).toEqual([]);
    expect(h.engine.resume()).toEqual([]);
    expect(h.engine.cancel()).toEqual([]);
    expect(h.engine.snapshot().phase).toBe('idle');
  });

  it('ignores a second start while running (does not restart)', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 6000);
    const id = h.engine.session().id;
    const elapsed = h.engine.snapshot().elapsedMs;

    expect(h.engine.start()).toEqual([]); // no-op
    expect(h.engine.session().id).toBe(id);
    expect(h.engine.snapshot().elapsedMs).toBe(elapsed);
  });

  it('ignores commands after completion (except restart)', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 46000);
    expect(h.engine.snapshot().phase).toBe('finished');
    expect(h.engine.advance()).toEqual([]);
    expect(h.engine.pause()).toEqual([]);
  });
});

describe('Engine — boundary conditions & idempotency', () => {
  it('crosses a boundary exactly at its offset', () => {
    const h = makeEngine();
    h.engine.start();
    h.clock.set(4000); // exactly the warmup boundary
    expect(types(h.engine.advance())).toEqual(['WARMUP_COMPLETED', 'ROUND_STARTED']);
  });

  it('re-ticking the same clock value emits nothing', () => {
    const h = makeEngine();
    h.engine.start();
    h.clock.set(8000);
    h.engine.advance();
    expect(h.engine.advance()).toEqual([]); // same now → no new events
  });

  it('clamps a backward clock (monotonic guard G4)', () => {
    const h = makeEngine();
    h.engine.start();
    h.clock.set(8000);
    h.engine.advance();
    h.clock.set(3000); // regression
    expect(h.engine.advance()).toEqual([]);
    expect(h.engine.snapshot().elapsedMs).toBe(8000);
  });
});

describe('Engine — sequence integrity', () => {
  it('assigns strictly increasing seq across the whole session', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 46000);
    const seqs = h.engine.events().map((e) => e.seq);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBe(seqs[i - 1] + 1);
    }
    expect(seqs[0]).toBe(0);
  });

  it('emits *_COMPLETED before the following *_STARTED at a boundary', () => {
    const h = makeEngine();
    h.engine.start();
    play(h, 46000);
    const t = types(h.engine.events());
    const rc = t.indexOf('ROUND_COMPLETED');
    const rs = t.indexOf('REST_STARTED');
    expect(rc).toBeLessThan(rs);
    const lastRoundCompleted = t.lastIndexOf('ROUND_COMPLETED');
    const completed = t.indexOf('WORKOUT_COMPLETED');
    expect(lastRoundCompleted).toBeLessThan(completed);
  });
});
