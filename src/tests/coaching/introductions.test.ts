import { describe, it, expect } from 'vitest';
import { CoachRuntime, makeContext, type CoachPackId, type SessionFacts } from '../../lib/coaching';
import { SpySink, evt } from './helpers';

const ALL_PACKS: CoachPackId[] = [
  'technical',
  'oldschool',
  'fightnight',
  'calm',
  'competition',
  'southpaw',
];

/** Drive WORKOUT_STARTED and return the coach's spoken opening line. */
function openingLine(
  personality: CoachPackId,
  facts: SessionFacts = {},
  workoutName = 'Foundations',
): string {
  const sink = new SpySink();
  const rt = new CoachRuntime(makeContext(personality, { workoutName, facts }), sink);
  rt.onEvent(
    evt('WORKOUT_STARTED', 1, 0, {
      workoutId: 'w',
      totalRounds: 3,
      plannedDurationMs: 180000,
      hasWarmup: false,
    }),
  );
  return sink.spoken[0] ?? '';
}

describe('Session introductions (PR-020B)', () => {
  it('different packs, same workout → different introductions', () => {
    const facts = { focus: 'distance control' };
    const t = openingLine('technical', facts);
    const f = openingLine('fightnight', facts);
    const o = openingLine('oldschool', facts);

    expect(new Set([t, f, o]).size).toBe(3); // all distinct
  });

  it('carries the workout identity and hands off, framed its own way per pack', () => {
    const facts = { focus: 'distance control' };
    const t = openingLine('technical', facts);
    const c = openingLine('competition', facts);

    // Both carry the workout identity…
    expect(t).toContain('Foundations');
    expect(c).toContain('Foundations');
    // …and hand off to work, each in its own words…
    expect(t.toLowerCase()).toMatch(/build|work/);
    expect(c.toLowerCase()).toMatch(/work|go|standard/);
    expect(t).not.toBe(c);
  });

  it('never briefs the focus — teach the concept once, in the round, not the intro (PR-028)', () => {
    // A great coach says "Foundations. Let's work." — not "Today's focus is distance
    // control." Naming the concept in the intro AND again in the round is teaching it
    // twice (LAW FOUR). The intro coaches; it does not brief.
    const withFocus = openingLine('technical', { focus: 'distance control' });
    const without = openingLine('technical', {});

    expect(withFocus.toLowerCase()).not.toContain('distance control');
    expect(without.toLowerCase()).not.toContain('distance control');
    // Focus present or absent, the intro is the same terse opening — the concept
    // is not repeated here.
    expect(withFocus).toBe(without);
    // Still a complete opening: identity + hand-off, and short (LESS WORDS).
    expect(without).toContain('Foundations');
    expect(without.toLowerCase()).toMatch(/build|work/);
    expect(without.split(/\s+/).length).toBeLessThanOrEqual(6);
  });

  it('hands off to the round WITHOUT announcing it (Round Intro owns that — PR-021)', () => {
    for (const p of ALL_PACKS) {
      const line = openingLine(p, { focus: 'footwork' }).toLowerCase();
      // The Session Introduction must never announce "Round one" or duplicate the
      // Round Introduction — that responsibility belongs to ROUND_STARTED.
      expect(line).not.toMatch(/round one|round 1\b/);
    }
  });

  it('greeting is opt-in per pack and references time only when authored', () => {
    // Calm opts into time-of-day greetings.
    expect(openingLine('calm', { focus: 'rhythm', timeOfDay: 'morning' }).toLowerCase()).toContain('morning');
    expect(openingLine('calm', { focus: 'rhythm', timeOfDay: 'neutral' }).toLowerCase()).not.toContain('morning');

    // Fight Night only authored an evening greeting → other times fall back to neutral.
    expect(openingLine('fightnight', { focus: 'pressure', timeOfDay: 'evening' }).toLowerCase()).toMatch(
      /good evening|fight night/,
    );
    expect(openingLine('fightnight', { focus: 'pressure', timeOfDay: 'morning' }).toLowerCase()).not.toContain(
      'good morning',
    );

    // Technical never references time, even in the evening.
    const techEvening = openingLine('technical', { focus: 'x', timeOfDay: 'evening' }).toLowerCase();
    expect(techEvening).not.toContain('evening');
  });

  it('never hard-codes time (the old "Tonight we train" is gone)', () => {
    for (const p of ALL_PACKS) {
      const line = openingLine(p, { focus: 'x', timeOfDay: 'neutral' }).toLowerCase();
      expect(line).not.toContain('tonight');
    }
  });

  it('is deterministic: same pack + same facts + same events → identical output', () => {
    const facts = { focus: 'pressure', timeOfDay: 'evening' as const };
    expect(openingLine('fightnight', facts)).toBe(openingLine('fightnight', facts));
    expect(openingLine('technical', { focus: 'distance control' })).toBe(
      openingLine('technical', { focus: 'distance control' }),
    );
  });
});
