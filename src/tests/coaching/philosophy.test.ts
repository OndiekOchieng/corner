/**
 * Coaching philosophy (PR-028) — "Would a boxing coach actually say this?"
 *
 * Corner coaches behaviour; it does not lecture. These tests are the behavioural
 * guardrails for the five coaching laws: behaviour beats information, shorter wins,
 * silence wins, teach a concept once, immersion beats completeness. They assert the
 * SHAPE of the coaching (terse, behavioural, non-duplicating) rather than exact
 * wording, so authors can revise phrasing without breaking the doctrine.
 */

import { describe, it, expect } from 'vitest';
import {
  CoachRuntime,
  makeContext,
  REINFORCEMENTS,
  PERSONALITIES,
  type CoachPackId,
} from '../../lib/coaching';
import { SpySink, evt } from './helpers';

const ALL_PACKS = Object.keys(PERSONALITIES) as CoachPackId[];

/** Lines a great coach would never say mid-round — textbook, not corner. */
const TEXTBOOK = /remember to|maintain your|make sure to|focus is|it's .* today|be sure to|proper form/i;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

/** Drive a default-coach session: intro + a round + repeated guard cues. */
function session(pack: CoachPackId): string[] {
  const sink = new SpySink();
  const rt = new CoachRuntime(makeContext(pack, { workoutName: 'Foundations' }), sink);
  let seq = 1;
  rt.onEvent(evt('WORKOUT_STARTED', seq++, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 600000, hasWarmup: false }));
  rt.onEvent(evt('ROUND_STARTED', seq++, 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Round', workMs: 600000, restMs: 0, cues: [] }, durationMs: 600000 }));
  for (const [i, text] of ['Keep your hands high', 'Hands up', 'Guard tight'].entries()) {
    rt.onEvent(evt('COACH_CUE', seq++, 10000 + i * 30000, { roundIndex: 0, cueId: `g${i}`, text, atMs: 10000 + i * 30000 }));
  }
  return sink.spoken;
}

describe('Coaching philosophy (PR-028)', () => {
  it('LAW FOUR — the intro teaches the concept zero times: identity + hand-off, no focus briefing', () => {
    // The default coach opens short and never briefs a "focus" — the athlete would
    // otherwise hear the concept in the intro AND again in the round.
    const intro = session('fightnight')[0];
    expect(intro).toContain('Foundations'); // identity, once
    expect(intro.toLowerCase()).not.toMatch(TEXTBOOK);
    expect(wordCount(intro)).toBeLessThanOrEqual(6); // LESS WORDS
  });

  it('every pack opens with a short line (LESS WORDS), never a paragraph', () => {
    for (const p of ALL_PACKS) {
      const intro = session(p)[0];
      expect(wordCount(intro)).toBeLessThanOrEqual(7);
    }
  });

  it('LAWS ONE & TWO — reinforcement doctrine is behavioural micro-coaching, not a textbook', () => {
    for (const [dim, bank] of Object.entries(REINFORCEMENTS)) {
      for (const line of bank) {
        // Short: a reinforcement is a shout across the gym, ≤ 4 words.
        expect(wordCount(line), `${dim}: "${line}"`).toBeLessThanOrEqual(4);
        // Behavioural: never phrased as an explanation.
        expect(line.toLowerCase(), `${dim}: "${line}"`).not.toMatch(TEXTBOOK);
      }
    }
  });

  it('Micro-coaching is a first-class citizen — one-to-three-word lines exist across the doctrine', () => {
    const micro = Object.values(REINFORCEMENTS)
      .flat()
      .filter((l) => wordCount(l) <= 3);
    expect(micro.length).toBeGreaterThan(10);
  });

  it('Competition heavily favours micro coaching (LAW FIVE — immersion, not information)', () => {
    const comp = PERSONALITIES.competition.banks;
    for (const line of [...comp.urgency, ...comp.encouragement]) {
      expect(wordCount(line), `"${line}"`).toBeLessThanOrEqual(2);
    }
  });

  it('no coaching line lectures — the whole transcript passes "would a coach say this live?"', () => {
    for (const p of ALL_PACKS) {
      for (const line of session(p)) {
        expect(line.toLowerCase(), `${p}: "${line}"`).not.toMatch(TEXTBOOK);
      }
    }
  });

  it('LAW FOUR — no concept is duplicated: the intro line is never repeated verbatim in-round', () => {
    for (const p of ALL_PACKS) {
      const spoken = session(p);
      const intro = spoken[0];
      expect(spoken.slice(1)).not.toContain(intro);
    }
  });
});
