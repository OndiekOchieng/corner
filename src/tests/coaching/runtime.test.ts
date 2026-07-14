import { describe, it, expect } from 'vitest';
import { CoachRuntime, makeContext, type CoachPackId } from '../../lib/coaching';
import type { WorkoutEvent } from '../../lib/engine';
import { SpySink, fullWorkoutEvents, evt } from './helpers';

function run(personality: CoachPackId, workoutName = 'Test Bout') {
  const sink = new SpySink();
  const runtime = new CoachRuntime(makeContext(personality, { workoutName }), sink);
  for (const event of fullWorkoutEvents()) runtime.onEvent(event);
  return { sink, runtime };
}

describe('CoachRuntime — a full workout feels coached', () => {
  it('opens with a workout introduction naming the session', () => {
    const { sink } = run('technical', 'Orthodox Power');
    expect(sink.spoken[0]).toContain('Orthodox Power');
  });

  it('coaches the whole arc: intro, rounds, countdown, rest, finish', () => {
    const { sink } = run('technical');
    const all = sink.spoken.join(' \n ');
    expect(all).toContain('Ten seconds.'); // countdown lands
    expect(all).toMatch(/Round 1/); // round intro
    expect(all).toMatch(/Rest\b|Recover/); // rest coaching
    expect(sink.spoken.at(-1)).toMatch(/round|well|trained|respect/i); // honest close
  });

  it('speaks the authored cues verbatim; skips the final push that would be cut by the count', () => {
    const { sink } = run('technical');
    // Every authored cue fits between countdown beats, so all render as authored…
    expect(sink.spoken).toContain('Jab');
    expect(sink.spoken).toContain('Cross');
    expect(sink.spoken).toContain('Hook');
    // …but the final-round urgency lands on the countdown beat, so it is SKIPPED
    // rather than started and then cut by "Ten… Nine…" (PR-021 preemption).
    expect(sink.spoken).not.toContain('Sharp! Finish!');
    expect(sink.spoken).not.toContain('Precise to the end!');
  });

  it('never says the same line twice in a row (no duplicated coaching)', () => {
    const { sink } = run('fightnight');
    for (let i = 1; i < sink.spoken.length; i++) {
      expect(sink.spoken[i]).not.toEqual(sink.spoken[i - 1]);
    }
  });

  it('interrupts lingering chatter when the countdown starts', () => {
    const { runtime } = run('technical');
    expect(runtime.diagnosticsSnapshot().interruptions).toBeGreaterThan(0);
  });

  it('makes intentional silence decisions (does not narrate everything)', () => {
    const { runtime } = run('technical');
    const d = runtime.diagnosticsSnapshot();
    expect(d.silenceDecisions).toBeGreaterThan(0);
    expect(d.actionsSpoken).toBeGreaterThan(0);
    expect(d.averageCoachingDensity).toBeGreaterThan(0);
  });

  it('is fully deterministic — identical output for identical input', () => {
    const a = run('competition');
    const b = run('competition');
    expect(a.sink.spoken).toEqual(b.sink.spoken);
  });

  it('the same workout feels different under different coaches', () => {
    const tech = run('technical');
    const fight = run('fightnight');
    const calm = run('calm');
    // Intros are unmistakably different voices…
    expect(tech.sink.spoken[0]).not.toEqual(fight.sink.spoken[0]);
    expect(fight.sink.spoken[0]).not.toEqual(calm.sink.spoken[0]);
    // …and the whole session differs.
    expect(tech.sink.spoken).not.toEqual(fight.sink.spoken);
    // A fighter's voice shows up somewhere.
    expect(fight.sink.spoken.join(' ')).toMatch(/fighter|dig|respect|let['’]s go|go work/i);
  });
});

describe('CoachRuntime — resume & replay safety', () => {
  const started = (): WorkoutEvent =>
    evt('WORKOUT_STARTED', 1, 0, {
      workoutId: 'w',
      totalRounds: 3,
      plannedDurationMs: 46000,
      hasWarmup: true,
    });
  const round1 = (): WorkoutEvent =>
    evt('ROUND_STARTED', 2, 4000, {
      roundIndex: 0,
      roundNumber: 1,
      round: { id: 'r0', name: 'Jab', workMs: 12000, restMs: 3000, cues: [] },
      durationMs: 12000,
    });

  it('pauses and resumes the sink without replaying coaching', () => {
    const sink = new SpySink();
    const rt = new CoachRuntime(makeContext('technical', { workoutName: 'W' }), sink);

    rt.onEvent(started());
    rt.onEvent(round1());
    const spokenAfterStart = [...sink.spoken];
    expect(spokenAfterStart.length).toBeGreaterThan(0);

    rt.onEvent(evt('WORKOUT_PAUSED', 3, 6000, { phase: 'round', elapsedMs: 6000 } as never));
    expect(sink.calls).toContain('pause');
    expect(sink.spoken).toEqual(spokenAfterStart); // nothing new said

    rt.onEvent(evt('WORKOUT_RESUMED', 4, 6000, { phase: 'round', elapsedMs: 6000, pausedForMs: 1000 } as never));
    expect(sink.calls).toContain('resume');

    // A replayed (stale) event — seq already seen — is ignored.
    rt.onEvent(round1());
    expect(sink.spoken).toEqual(spokenAfterStart);
  });

  it('a fresh WORKOUT_STARTED resets and re-introduces (new session)', () => {
    const sink = new SpySink();
    const rt = new CoachRuntime(makeContext('oldschool', { workoutName: 'Again' }), sink);
    for (const e of fullWorkoutEvents()) rt.onEvent(e);
    const firstCount = sink.spoken.length;

    rt.onEvent(started()); // seq 1 again — new session
    expect(sink.spoken.length).toBeGreaterThan(firstCount);
    expect(sink.spoken.at(-1)).toContain('Again');
  });
});
