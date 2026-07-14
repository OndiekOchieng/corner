import { describe, it, expect } from 'vitest';
import { CoachRuntime, makeContext, classifyDimension, type CoachPackId } from '../../lib/coaching';
import { toWorkoutConfig } from '../../lib/integration';
import { Engine, FakeClock } from '../../lib/engine';
import type { WorkoutEvent } from '../../lib/engine';
import type { Workout } from '../../../types/workout';
import { SEEDED_WORKOUTS } from '../../../data/seeded-workouts';
import { SpySink, evt } from './helpers';

interface CueSpec {
  cueId: string;
  text: string;
  elapsedMs: number;
}

/** Drive a single round: start → round start → the given cues. */
function runCues(personality: CoachPackId, cues: CueSpec[]) {
  const sink = new SpySink();
  const rt = new CoachRuntime(makeContext(personality, { workoutName: 'W' }), sink);
  let seq = 1;
  rt.onEvent(evt('WORKOUT_STARTED', seq++, 0, {
    workoutId: 'w', totalRounds: 1, plannedDurationMs: 180000, hasWarmup: false,
  }));
  rt.onEvent(evt('ROUND_STARTED', seq++, 0, {
    roundIndex: 0, roundNumber: 1,
    round: { id: 'r', name: 'Round', workMs: 180000, restMs: 0, cues: [] },
    durationMs: 180000,
  }));
  for (const c of cues) {
    rt.onEvent(evt('COACH_CUE', seq++, c.elapsedMs, {
      roundIndex: 0, cueId: c.cueId, text: c.text, atMs: c.elapsedMs,
    }));
  }
  return { sink, rt };
}

const anchor = (kindId: string, text: string, elapsedMs: number): CueSpec => ({ cueId: kindId, text, elapsedMs });

// --- Layer 2: time anchors ---------------------------------------------------

describe('Time anchors — Layer 2 orientation', () => {
  it('voices an authored anchor cue as a personality line', () => {
    const { sink } = runCues('technical', [anchor('anchor-onemin', 'One minute to go.', 120000)]);
    expect(sink.spoken).toContain('One minute remaining. Stay disciplined.');
  });

  it('the same anchor is a different performance per coach', () => {
    const one = anchor('anchor-onemin', 'One minute to go.', 120000);
    const line = (p: CoachPackId) => runCues(p, [one]).sink.spoken.find((l) => /minute/i.test(l));
    expect(line('technical')).toBe('One minute remaining. Stay disciplined.');
    expect(line('oldschool')).toBe("One minute! Don't give it away!");
    expect(line('fightnight')).toBe('One minute! This round is yours!');
    expect(line('calm')).toBe('One minute left. Stay easy.');
  });
});

// --- Layer 3: reinforcement --------------------------------------------------

describe('Reinforcement — same lesson, different words', () => {
  it('speaks the first cue verbatim, then reinforces the dimension', () => {
    const { sink } = runCues('technical', [
      { cueId: 'g1', text: 'Keep your hands high', elapsedMs: 10000 },
      { cueId: 'g2', text: 'Hands up', elapsedMs: 40000 },
      { cueId: 'g3', text: 'Guard tight', elapsedMs: 70000 },
    ]);
    // First guard cue: as authored.
    expect(sink.spoken).toContain('Keep your hands high');
    // Later guard cues: reinforced with fresh, behavioural micro-coaching (PR-028) —
    // never the identical line, never the raw authored repeat.
    const reinforced = sink.spoken.filter((l) => /hands home|hands up!|guard!|protect!/i.test(l));
    expect(reinforced.length).toBeGreaterThanOrEqual(2);
    expect(new Set(reinforced).size).toBe(reinforced.length); // all distinct wording
    expect(sink.spoken).not.toContain('Hands up'); // the raw authored cue isn't echoed
    // No identical line twice in a row.
    for (let i = 1; i < sink.spoken.length; i++) {
      expect(sink.spoken[i]).not.toEqual(sink.spoken[i - 1]);
    }
  });

  it('a different dimension is taught on its own, not reinforced away', () => {
    const { sink } = runCues('technical', [
      { cueId: 'g1', text: 'Hands high', elapsedMs: 10000 }, // guard
      { cueId: 'd1', text: 'Stay behind the jab', elapsedMs: 40000 }, // distance — fresh
    ]);
    expect(classifyDimension('Stay behind the jab')).toBe('distance');
    expect(sink.spoken).toContain('Stay behind the jab'); // fresh dimension → verbatim
  });

  it('teaches a dimension verbatim again in a new round (memory resets per round)', () => {
    const sink = new SpySink();
    const rt = new CoachRuntime(makeContext('technical', { workoutName: 'W' }), sink);
    let seq = 1;
    rt.onEvent(evt('WORKOUT_STARTED', seq++, 0, { workoutId: 'w', totalRounds: 2, plannedDurationMs: 1, hasWarmup: false }));
    rt.onEvent(evt('ROUND_STARTED', seq++, 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r0', name: 'One', workMs: 100000, restMs: 0, cues: [] }, durationMs: 100000 }));
    rt.onEvent(evt('COACH_CUE', seq++, 10000, { roundIndex: 0, cueId: 'g', text: 'Hands high', atMs: 10000 }));
    rt.onEvent(evt('ROUND_STARTED', seq++, 20000, { roundIndex: 1, roundNumber: 2, round: { id: 'r1', name: 'Two', workMs: 100000, restMs: 0, cues: [] }, durationMs: 100000 }));
    // A DIFFERENT guard cue in round 2: because the round reset dimension memory,
    // it is taught as authored (verbatim) — not turned into a reinforcement.
    rt.onEvent(evt('COACH_CUE', seq++, 30000, { roundIndex: 1, cueId: 'g2', text: 'Chin down', atMs: 10000 }));
    expect(classifyDimension('Chin down')).toBe('guard');
    expect(sink.spoken).toContain('Chin down');
  });
});

// --- Determinism, presence, silence budget -----------------------------------

function runEngine(personality: CoachPackId, config = toWorkoutConfig(SEEDED_WORKOUTS[0])) {
  const clock = new FakeClock(0);
  let n = 0;
  const engine = new Engine(config, { clock, idFactory: () => `s${++n}` });
  const sink = new SpySink();
  const rt = new CoachRuntime(makeContext(personality, { workoutName: SEEDED_WORKOUTS[0].name }), sink);
  const feed = (events: readonly WorkoutEvent[]) => events.forEach((e) => rt.onEvent(e));
  feed(engine.start());
  const total = config.rounds.reduce((a, r) => a + r.workMs + r.restMs, 0);
  for (let t = 250; t <= total + 2000; t += 250) {
    clock.set(t);
    feed(engine.advance());
  }
  return { sink, rt };
}

describe('Cadence — presence without chatter, deterministic', () => {
  it('keeps the athlete oriented with anchors through a real workout', () => {
    const { sink, rt } = runEngine('technical');
    // Anchors land (Layer 2) — the athlete is never left wondering how long is left.
    expect(sink.spoken).toContain('One minute remaining. Stay disciplined.');
    const byIntent = rt.diagnosticsSnapshot().spokenByIntent;
    expect((byIntent.time_anchor ?? 0)).toBeGreaterThanOrEqual(3);
  });

  it('respects the silence budget (mostly quiet across the session)', () => {
    const { rt } = runEngine('calm');
    const d = rt.diagnosticsSnapshot();
    // ~9 min session; a handful of spoken lines per minute is far below "talked at".
    const perMinute = d.actionsSpoken / (d.lastElapsedMs / 60000);
    expect(perMinute).toBeLessThan(12);
    expect(d.silenceDecisions).toBeGreaterThan(0);
  });

  it('is fully deterministic through the whole path', () => {
    expect(runEngine('competition').sink.spoken).toEqual(runEngine('competition').sink.spoken);
  });
});

// --- Resume ------------------------------------------------------------------

describe('Cadence — resume after pause', () => {
  it('keeps dimension memory across a pause (still reinforces, no replay)', () => {
    const sink = new SpySink();
    const rt = new CoachRuntime(makeContext('technical', { workoutName: 'W' }), sink);
    let seq = 1;
    rt.onEvent(evt('WORKOUT_STARTED', seq++, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 180000, hasWarmup: false }));
    rt.onEvent(evt('ROUND_STARTED', seq++, 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'R', workMs: 180000, restMs: 0, cues: [] }, durationMs: 180000 }));
    rt.onEvent(evt('COACH_CUE', seq++, 10000, { roundIndex: 0, cueId: 'g1', text: 'Hands high', atMs: 10000 }));
    rt.onEvent(evt('WORKOUT_PAUSED', seq++, 15000, { phase: 'round', elapsedMs: 15000 } as never));
    const afterPause = [...sink.spoken];
    rt.onEvent(evt('WORKOUT_RESUMED', seq++, 15000, { phase: 'round', elapsedMs: 15000, pausedForMs: 1000 } as never));
    rt.onEvent(evt('COACH_CUE', seq++, 40000, { roundIndex: 0, cueId: 'g2', text: 'Hands up', atMs: 40000 }));

    expect(afterPause).toContain('Hands high'); // taught before the pause
    expect(sink.spoken.some((l) => /hands home|hands up!|guard!|protect!/i.test(l))).toBe(true); // reinforced after resume
    expect(sink.spoken).not.toContain('Hands up'); // never the identical repeat
  });
});

// --- Mapper: authored-content anchors ---------------------------------------

describe('Time anchors are authored content (mapper injection)', () => {
  it('injects sensible anchors for long rounds', () => {
    const round0 = toWorkoutConfig(SEEDED_WORKOUTS[0]).rounds[0]; // 180s rounds
    const ids = round0.cues.map((c) => c.id);
    expect(ids).toContain('anchor-twomin');
    expect(ids).toContain('anchor-onemin');
    expect(ids).toContain('anchor-thirty');
    // still strictly increasing and in-range (engine will accept it)
    let prev = 0;
    for (const cue of round0.cues) {
      expect(cue.atMs).toBeGreaterThan(prev);
      expect(cue.atMs).toBeLessThan(round0.workMs);
      prev = cue.atMs;
    }
  });

  it('injects no anchors into a short round', () => {
    const short: Workout = {
      ...SEEDED_WORKOUTS[0],
      rounds: [{ ...SEEDED_WORKOUTS[0].rounds[0], drillDuration: 30, restDuration: 0 }],
    };
    const cues = toWorkoutConfig(short).rounds[0].cues;
    expect(cues.every((c) => !c.id.startsWith('anchor-'))).toBe(true);
  });
});
