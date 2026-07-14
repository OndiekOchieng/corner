import { describe, it, expect } from 'vitest';
import { CoachRuntime, makeContext, renderCombo, type CoachPackId } from '../../lib/coaching';
import { SEEDED_WORKOUTS } from '../../../data/seeded-workouts';
import { SpySink, evt } from './helpers';

/** Drive a session where cue ids map to combinations via CoachContext (as the app wires it). */
function runCombo(
  personality: CoachPackId,
  combosByCue: Record<string, number[]>,
  cues: Array<{ cueId: string; at: number; text?: string }>,
) {
  const sink = new SpySink();
  const combinations = new Map<string, readonly number[]>(Object.entries(combosByCue));
  const rt = new CoachRuntime(makeContext(personality, { workoutName: 'W', combinations }), sink);
  let seq = 1;
  rt.onEvent(evt('WORKOUT_STARTED', seq++, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 600000, hasWarmup: false }));
  rt.onEvent(evt('ROUND_STARTED', seq++, 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Round', workMs: 600000, restMs: 0, cues: [] }, durationMs: 600000 }));
  for (const c of cues) {
    rt.onEvent(evt('COACH_CUE', seq++, c.at, { roundIndex: 0, cueId: c.cueId, text: c.text ?? 'AUTHORED FALLBACK TEXT', atMs: c.at }));
  }
  return sink.spoken;
}

describe('Semantic combination cues (PR-020D)', () => {
  it('recognises a combination cue by id and renders it (no string parsing)', () => {
    const spoken = runCombo('technical', { c1: [1, 2, 6] }, [{ cueId: 'c1', at: 10000 }]);
    expect(spoken).toContain('Jab. Cross. Rear uppercut.');
    // The authored fallback text is NOT spoken — the render replaces it.
    expect(spoken).not.toContain('AUTHORED FALLBACK TEXT');
  });

  it('the same semantic cue renders differently per Coach Pack', () => {
    const combos = { c1: [1, 2, 6] };
    // Name-based packs render fully on the first cue…
    const first = (p: CoachPackId) => runCombo(p, combos, [{ cueId: 'c1', at: 10000 }]).at(-1);
    expect(first('technical')).toBe('Jab. Cross. Rear uppercut.');
    expect(first('calm')).toBe("Let's finish with the rear uppercut.");
    expect(first('southpaw')).toBe('Lead hand. Rear hand. Rear uppercut.');
    // …call-sign packs teach the vocabulary first, then use their own shorthand.
    const shorthand = (p: CoachPackId) =>
      runCombo(p, combos, [10000, 30000, 50000, 70000].map((at) => ({ cueId: 'c1', at }))).at(-1);
    expect(shorthand('competition')).toBe('Six. Again.');
    expect(shorthand('fightnight')).toBe('One-two-six!');
    expect(shorthand('oldschool')).toBe('One-two-six.');
    // The combination is NOT in the (pack-agnostic) engine event — it is resolved per pack.
  });

  it('teaches through one exposure, then uses shorthand (call-sign pack, PR-027B)', () => {
    const spoken = runCombo('fightnight', { c1: [1, 2, 6] }, [
      { cueId: 'c1', at: 10000 },
      { cueId: 'c1', at: 30000 },
    ]);
    const combo = spoken.filter((l) => /jab, cross|one-two-six/i.test(l));
    // First encounter: both forms in one line…
    expect(combo[0]).toBe('One-two-six. Jab, cross, rear uppercut.');
    // …then pure shorthand, no repeated translation.
    expect(combo[1]).toBe('One-two-six!');
  });

  it('is backwards compatible — a cue with no combination is spoken verbatim', () => {
    const spoken = runCombo('technical', {}, [{ cueId: 'plain', at: 10000, text: 'Keep your hands high' }]);
    expect(spoken).toContain('Keep your hands high');
  });

  it('leaves authored non-combination text untouched while rendering the combo', () => {
    const spoken = runCombo('technical', { c1: [1, 2] }, [
      { cueId: 'plain', at: 10000, text: 'Stay on the balls of your feet' },
      { cueId: 'c1', at: 40000, text: 'AUTHORED FALLBACK TEXT' },
    ]);
    expect(spoken).toContain('Stay on the balls of your feet'); // verbatim
    expect(spoken).toContain('Jab. Cross.'); // rendered
    expect(spoken).not.toContain('AUTHORED FALLBACK TEXT');
  });

  it('is deterministic — identical events → identical output', () => {
    const combos = { c1: [3, 2, 6] };
    const cues = [{ cueId: 'c1', at: 10000 }, { cueId: 'c1', at: 30000 }];
    expect(runCombo('oldschool', combos, cues)).toEqual(runCombo('oldschool', combos, cues));
  });

  it('supports combinations beyond the base six without hard-coding', () => {
    // Unknown punch numbers degrade gracefully rather than throwing.
    expect(renderCombo([1, 7], 'technical')).toBe('Jab. Punch 7.');
    expect(renderCombo([1, 7], 'oldschool')).toBe('One-7.');
  });

  it('a seeded workout carries semantic combinations that render per pack', () => {
    const power = SEEDED_WORKOUTS.find((w) => w.id === 'workout-orthodox-power')!;
    const combo = power.rounds
      .flatMap((r) => r.coachingCues)
      .find((c) => c.id === 'cue-4');
    expect(combo?.combination).toEqual([1, 2, 3]); // authored semantically
    expect(renderCombo(combo!.combination!, 'technical')).toBe('Jab. Cross. Lead hook.');
    expect(renderCombo(combo!.combination!, 'fightnight')).toBe('One-two-three!');
  });
});

// --- Language progression: teach through exposure (PR-027B) -------------------

describe('Combination language progression (PR-027B)', () => {
  it('default coach: an ordinary workout produces an exposure, then shorthand', () => {
    // The real orthodox-power combo tags, in cue order (spaced past the silence gate).
    const spoken = runCombo(
      'fightnight',
      { 'cue-4': [1, 2, 3], 'cue-5': [1, 2], 'cue-8': [1, 2, 3, 6] },
      [
        { cueId: 'cue-4', at: 10000 },
        { cueId: 'cue-5', at: 40000 },
        { cueId: 'cue-8', at: 70000 },
      ],
    );
    // First combo: both forms in one line (3 = the lead hook, distinct from rear)…
    expect(spoken).toContain('One-two-three. Jab, cross, lead hook.');
    // …then the overlapping jab-cross is pure shorthand — no repeated translation.
    expect(spoken).toContain('One-two!');
    // No classroom "Every time I say …" lines survive the new model.
    expect(spoken.some((l) => /every time i say/i.test(l))).toBe(false);
  });

  it('the same combo: exposure first, then pure shorthand (default coach)', () => {
    const spoken = runCombo('fightnight', { c1: [1, 2, 3] }, [
      { cueId: 'c1', at: 10000 },
      { cueId: 'c1', at: 40000 },
    ]);
    const lines = spoken.filter((l) => /jab, cross|one-two-three/i.test(l));
    expect(lines[0]).toBe('One-two-three. Jab, cross, lead hook.'); // exposure (both forms)
    expect(lines[1]).toBe('One-two-three!'); // shorthand — authentic boxing language
  });

  it('one exposure is enough — a single occurrence never blocks the shorthand', () => {
    // Even Competition (minimal style) exposes once, then speaks its own shorthand.
    const spoken = runCombo('competition', { c1: [1, 6] }, [
      { cueId: 'c1', at: 10000 },
      { cueId: 'c1', at: 40000 },
    ]);
    expect(spoken).toContain('One-six. Jab, rear uppercut.'); // exposure
    expect(spoken).toContain('Six. Again.'); // its own shorthand afterwards
  });
});
