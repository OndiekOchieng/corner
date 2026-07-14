import { describe, it, expect } from 'vitest';
import {
  CoachRuntime,
  CoachingMemory,
  SpeechPlanner,
  makeContext,
  personalityFor,
  renderCombo,
  renderComboTaught,
  type PunchNumber,
} from '../../lib/coaching';
import { SpySink, evt } from './helpers';

const COMBO: PunchNumber[] = [1, 2, 6]; // jab · cross · rear uppercut

// --- Coaching memory ---------------------------------------------------------

describe('CoachingMemory (PR-020C)', () => {
  it('remembers taught dimensions across the whole session and the last one', () => {
    const m = new CoachingMemory(5);
    m.noteSpoken('instruction', 'Keep your hands high', 1000, 'guard');
    m.noteSpoken('instruction', 'Stay on your feet', 2000, 'footwork');
    const s = m.snapshot();
    expect(s.taughtDimensions).toContain('guard');
    expect(s.taughtDimensions).toContain('footwork');
    expect(s.lastTaughtDimension).toBe('footwork');
    expect(m.lastTaughtDimension()).toBe('footwork');
  });

  it('counts reinforcements per dimension (concept progression)', () => {
    const m = new CoachingMemory(5);
    m.noteSpoken('reinforcement', "Don't let them drop.", 1000, 'guard');
    m.noteSpoken('reinforcement', 'Protect yourself.', 2000, 'guard');
    m.noteSpoken('reinforcement', "Stay on your feet.", 3000, 'footwork');
    expect(m.reinforcementCount('guard')).toBe(2);
    expect(m.reinforcementCount('footwork')).toBe(1);
    expect(m.reinforcementCount('breathing')).toBe(0);
  });

  it('introduces a call sign once (teach-before-shorthand memory)', () => {
    const m = new CoachingMemory(5);
    expect(m.hasIntroducedCallSign('one')).toBe(false);
    m.noteCallSignIntroduced('one');
    expect(m.hasIntroducedCallSign('one')).toBe(true);
  });

  it('resets fully between workouts (not persisted)', () => {
    const m = new CoachingMemory(5);
    m.noteSpoken('reinforcement', 'x', 1000, 'guard');
    m.noteCallSignIntroduced('one');
    m.reset();
    const s = m.snapshot();
    expect(s.taughtDimensions).toEqual([]);
    expect(s.lastTaughtDimension).toBeNull();
    expect(m.reinforcementCount('guard')).toBe(0);
    expect(m.hasIntroducedCallSign('one')).toBe(false);
  });
});

// --- Boxing lexicon ----------------------------------------------------------

describe('BoxingLexicon (PR-020C)', () => {
  it('renders the same combo differently per coach pack (personality)', () => {
    expect(renderCombo(COMBO, 'fightnight')).toBe('One-two-six!');
    expect(renderCombo(COMBO, 'oldschool')).toBe('One-two-six.');
    expect(renderCombo(COMBO, 'technical')).toBe('Jab. Cross. Rear uppercut.');
    expect(renderCombo(COMBO, 'competition')).toBe('Six. Again.');
    expect(renderCombo(COMBO, 'calm')).toBe("Let's finish with the rear uppercut.");
    expect(renderCombo(COMBO, 'southpaw')).toBe('Lead hand. Rear hand. Rear uppercut.');
  });

  it('teaches a call sign before assuming it, then uses the shorthand', () => {
    const m = new CoachingMemory(5);
    // First two calls teach the two unseen signs, one at a time…
    const r1 = renderComboTaught([1, 2], 'fightnight', m);
    expect(r1.taughtSign).toBe('one');
    expect(r1.text).toBe('Every time I say one, I mean the jab.');

    const r2 = renderComboTaught([1, 2], 'fightnight', m);
    expect(r2.taughtSign).toBe('two');
    expect(r2.text).toBe('Every time I say two, I mean the cross.');

    // …then the coach uses the shorthand.
    const r3 = renderComboTaught([1, 2], 'fightnight', m);
    expect(r3.taughtSign).toBeUndefined();
    expect(r3.text).toBe('One-two!');
  });

  it('name-based packs never need to teach vocabulary', () => {
    const m = new CoachingMemory(5);
    const r = renderComboTaught([1, 2], 'technical', m);
    expect(r.taughtSign).toBeUndefined();
    expect(r.text).toBe('Jab. Cross.');
  });

  it('is deterministic — same combo + pack → same words', () => {
    expect(renderCombo(COMBO, 'fightnight')).toBe(renderCombo(COMBO, 'fightnight'));
  });
});

// --- Reinforcement, encouragement, continuity, determinism -------------------

/** Drive a session and return everything the coach spoke. */
function run(personality: 'technical' | 'fightnight', cues: Array<{ text: string; at: number }>, opts?: { pauseAt?: number }) {
  const sink = new SpySink();
  const rt = new CoachRuntime(makeContext(personality, { workoutName: 'W' }), sink);
  let seq = 1;
  rt.onEvent(evt('WORKOUT_STARTED', seq++, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 600000, hasWarmup: false }));
  rt.onEvent(evt('ROUND_STARTED', seq++, 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Round', workMs: 600000, restMs: 0, cues: [] }, durationMs: 600000 }));
  for (const c of cues) {
    if (opts?.pauseAt != null && c.at > opts.pauseAt) {
      const at = opts.pauseAt;
      rt.onEvent(evt('WORKOUT_PAUSED', seq++, at, { phase: 'round', elapsedMs: at }));
      rt.onEvent(evt('WORKOUT_RESUMED', seq++, at, { phase: 'round', elapsedMs: at, pausedForMs: 0 }));
      opts.pauseAt = null as unknown as number; // once
    }
    rt.onEvent(evt('COACH_CUE', seq++, c.at, { roundIndex: 0, cueId: `c${c.at}`, text: c.text, atMs: c.at }));
  }
  return sink.spoken;
}

describe('Reinforcement & continuity (PR-020C)', () => {
  const guardCues = [
    { text: 'Keep your hands high', at: 10000 },
    { text: 'Hands up', at: 40000 },
    { text: 'Mind your guard', at: 80000 },
  ];

  it('reinforces the same lesson with different wording — never identical repetition', () => {
    const spoken = run('technical', guardCues);
    const coaching = spoken.filter((l) => /hands high|drop|protect|guard|home/i.test(l));
    // The authored line spoke once; the rest reinforced (all distinct wording).
    expect(coaching[0]).toBe('Keep your hands high');
    const unique = new Set(coaching);
    expect(unique.size).toBe(coaching.length); // no repeated wording
    expect(coaching.length).toBeGreaterThanOrEqual(3);
  });

  it('memory survives pause/resume — a later same-dimension cue still reinforces', () => {
    const spoken = run('technical', guardCues, { pauseAt: 20000 });
    // The authored line is still spoken only once; later guard cues reinforce.
    expect(spoken.filter((l) => l === 'Keep your hands high')).toHaveLength(1);
    expect(spoken.some((l) => /don't let them drop|protect yourself|hands home|guard up/i.test(l))).toBe(true);
  });

  it('encouragement references the lesson taught, without claiming to see', () => {
    const planner = new SpeechPlanner(personalityFor('technical'));
    const m = new CoachingMemory(5);
    const line = planner.plan('encouragement', { dimension: 'guard' }, m);
    expect(line).toBe('Good work. Keep that guard disciplined.');
    // Generic encouragement (no taught dimension) falls back to the pack bank.
    const generic = planner.plan('encouragement', {}, m);
    expect(personalityFor('technical').banks.encouragement).toContain(generic);
  });

  it('is deterministic: identical events → identical spoken output', () => {
    expect(run('fightnight', guardCues)).toEqual(run('fightnight', guardCues));
  });

  it('does not increase coaching density (reinforcement replaces repetition)', () => {
    // Three guard cues over ~80s yield at most three coaching lines — reinforcement
    // is a substitution, not an extra line.
    const spoken = run('technical', guardCues);
    const coaching = spoken.filter((l) => /hands high|drop|protect|guard|home/i.test(l));
    expect(coaching.length).toBeLessThanOrEqual(guardCues.length);
  });
});
