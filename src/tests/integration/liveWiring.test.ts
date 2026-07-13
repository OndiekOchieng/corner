/**
 * Live-wiring integration test (PR-010).
 *
 * Exercises the exact path the app uses — the app `Workout` mapped to engine
 * config, run through the engine, published to the Event Runtime, and coached by
 * the Coach Runtime plugin + Audio Bell subscriber — but headless and
 * deterministic (FakeClock, spy sink, no browser). This is what a real athlete
 * would hear, proven without a browser.
 */

import { describe, it, expect } from 'vitest';
import type { WorkoutEvent } from '../../lib/engine';
import { Engine, FakeClock } from '../../lib/engine';
import { EventBus } from '../../lib/runtime';
import { createCoachRuntimePlugin } from '../../lib/coaching';
import { toWorkoutConfig } from '../../lib/integration';
import { SEEDED_WORKOUTS } from '../../../data/seeded-workouts';
import { SpySink } from '../coaching/helpers';

function runWorkout(personality: Parameters<typeof createCoachRuntimePlugin>[0]['personality']) {
  const workout = SEEDED_WORKOUTS[0];
  const config = toWorkoutConfig(workout);
  const clock = new FakeClock(0);
  let n = 0;
  const engine = new Engine(config, { clock, idFactory: () => `s${++n}` });

  const sink = new SpySink();
  const bus = new EventBus();
  bus.register(createCoachRuntimePlugin({ personality, sink, workoutName: workout.name }));

  // Mirror the Host Runtime: publish only each dispatch's new events.
  const publish = (events: readonly WorkoutEvent[]) => { if (events.length) bus.publishAll(events); };
  publish(engine.start());
  const total = config.rounds.reduce((a, r) => a + r.workMs + r.restMs, 0);
  for (let t = 250; t <= total + 2000; t += 250) {
    clock.set(t);
    publish(engine.advance());
  }

  return { workout, sink };
}

describe('live wiring — the app path, coached', () => {
  it('maps a real workout to a valid engine config with in-range cues', () => {
    const config = toWorkoutConfig(SEEDED_WORKOUTS[0]);
    expect(config.rounds.length).toBeGreaterThan(0);
    for (const round of config.rounds) {
      expect(round.workMs).toBeGreaterThan(0);
      let prev = 0;
      for (const cue of round.cues) {
        expect(cue.atMs).toBeGreaterThan(prev); // strictly increasing
        expect(cue.atMs).toBeLessThan(round.workMs); // inside the round
        prev = cue.atMs;
      }
    }
  });

  it('a real athlete would hear a coached session end-to-end', () => {
    const { workout, sink } = runWorkout('fightnight');
    expect(sink.spoken[0]).toContain(workout.name); // workout intro
    expect(sink.spoken.join(' \n ')).toContain('Ten seconds.'); // countdown
    expect(sink.spoken.at(-1)).toMatch(/round|respect|dug/i); // honest close
  });

  it('the same workout is a different session under a different coach', () => {
    const fight = runWorkout('fightnight').sink.spoken;
    const calm = runWorkout('calm').sink.spoken;
    expect(fight).not.toEqual(calm);
    expect(fight[0]).not.toEqual(calm[0]);
  });

  it('is deterministic through the whole wired path', () => {
    expect(runWorkout('technical').sink.spoken).toEqual(runWorkout('technical').sink.spoken);
  });
});
