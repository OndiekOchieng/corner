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

  it('same facts across packs: every pack voices the same objective, framed its own way', () => {
    const facts = { focus: 'distance control' };
    const t = openingLine('technical', facts);
    const c = openingLine('competition', facts);

    // Same objective fact is spoken by both…
    expect(t.toLowerCase()).toContain('distance control');
    expect(c.toLowerCase()).toContain('distance control');
    // …and both carry the workout name…
    expect(t).toContain('Foundations');
    expect(c).toContain('Foundations');
    // …but the signature framing differs.
    expect(t.toLowerCase()).toContain('precision');
    expect(c.toLowerCase()).toContain('championship');
    expect(t).not.toBe(c);
  });

  it('omits the objective segment when the workout has no focus', () => {
    const withFocus = openingLine('technical', { focus: 'distance control' });
    const without = openingLine('technical', {});

    expect(withFocus.toLowerCase()).toContain('distance control');
    expect(without.toLowerCase()).not.toContain('distance control');
    // Still a complete opening: framing + hand-off.
    expect(without.toLowerCase()).toContain('precision');
    expect(without.toLowerCase()).toMatch(/work|here we go/);
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
