/**
 * Personalities — the six Coach Packs as data (PERSONALITY_SYSTEM.md).
 *
 * Each profile carries two things:
 *   1. Behavioural knobs — `talkativeness` scales the silence gaps (Calm leaves
 *      more air; Fight Night fills more), `encouragementBias` gates how readily
 *      earned praise fires. These make personalities *behave* differently, not
 *      just sound different.
 *   2. Phrase banks — several variants per composed line, rotated deterministically
 *      so the coach never loops (CUE_LIBRARY.md §7).
 *
 * The same workout under two profiles produces a different session with an
 * identical event stream — the PR's core success criterion.
 */

import type { CoachPackId } from './CoachAction';

export type ComposedKey =
  | 'workout_intro'
  | 'warmup'
  | 'round_intro'
  | 'round_intro_final'
  | 'rest_intro'
  | 'recovery'
  | 'teaching'
  | 'encouragement'
  | 'urgency'
  | 'finish';

export interface PersonalityProfile {
  readonly id: CoachPackId;
  readonly name: string;
  /** 0..1 — higher talks more (smaller silence gaps). */
  readonly talkativeness: number;
  /** 0..1 — higher gives earned encouragement more readily. */
  readonly encouragementBias: number;
  readonly banks: Readonly<Record<ComposedKey, readonly string[]>>;
}

/** Placeholders: {name} workout, {round} number, {total} rounds, {next} next round. */
export const PERSONALITIES: Readonly<Record<CoachPackId, PersonalityProfile>> = {
  technical: {
    id: 'technical',
    name: 'The Technical Coach',
    talkativeness: 0.6,
    encouragementBias: 0.4,
    banks: {
      workout_intro: [
        '{name}. Precision first — we build it clean today.',
        "Today it's {name}. Craft over force. Let's sharpen it.",
      ],
      warmup: ['Warm up. Find your range, loosen the hips.', 'Ease in. Light and precise.'],
      round_intro: [
        'Round {round}. {name} — build it from the ground up.',
        'Round {round}. {name}. One clean detail at a time.',
      ],
      round_intro_final: [
        'Round {round}. {name} — the last one. Keep the form honest.',
        'Final round. {name}. Precise, all the way through.',
      ],
      rest_intro: ['Rest. Breathe. Next: {next}.', 'Good. Recover. {next} coming up.'],
      recovery: ['Slow the breath, drop the shoulders.', 'Reset. Loosen the hands.'],
      teaching: [
        'Feel how the balance sets the punch. Carry that.',
        'The detail is in the retraction — hand straight back.',
      ],
      encouragement: ['That got sharp.', "Cleaner that round — that's the work."],
      urgency: ['Hold the form — finish precise.', 'Sharp to the end.'],
      finish: [
        'That found its line today. {total} rounds, well trained.',
        '{total} rounds of clean work. Real progress. Well done.',
      ],
    },
  },

  oldschool: {
    id: 'oldschool',
    name: 'The Old School Coach',
    talkativeness: 0.35,
    encouragementBias: 0.2,
    banks: {
      workout_intro: ['{name}. Nothing fancy. Fundamentals, done right.', "{name}. Let's work."],
      warmup: ['Warm up. Loosen up.', 'Ease in. Get moving.'],
      round_intro: ['Round {round}. {name}. Get to it.', 'Round {round}. {name}.'],
      round_intro_final: ['Round {round}. Last one. {name} — dig in.', 'Final round. {name}. Earn it.'],
      rest_intro: ['Rest. Next: {next}.', 'Breathe. {next} next.'],
      recovery: ['Shake it out.', 'Breathe.'],
      teaching: ['Basics win. Keep it tight.', 'Do the simple thing well.'],
      encouragement: ['Good.', "That's honest work."],
      urgency: ['Work. Finish it.', 'Dig. Now.'],
      finish: ['{total} rounds. That was honest work. Good.', 'Done. {total} rounds. Good work.'],
    },
  },

  fightnight: {
    id: 'fightnight',
    name: 'The Fight Night Coach',
    talkativeness: 0.85,
    encouragementBias: 0.7,
    banks: {
      workout_intro: [
        "{name}. Tonight we train like it's the real thing. Composed early, dangerous late.",
        '{name}. This is the one. Let me see it.',
      ],
      warmup: ['Warm up. Get loose, get sharp.', 'Ease in — then we go to work.'],
      round_intro: [
        'Round {round}. {name} — let me see those hands.',
        'Round {round}. {name}. Composed, sharp, dangerous.',
      ],
      round_intro_final: [
        'Round {round}. This is where fights are won. {name} — leave nothing.',
        'Last round. {name}. Everything you got. Let’s go.',
      ],
      rest_intro: ['Good round. Breathe. Next: {next}.', "Nice work. Recover. {next} — we press."],
      recovery: ['Breathe deep. Reset.', 'Shake it out — stay ready.'],
      teaching: ['He can’t hit what isn’t there. Move and fire.', 'Make him miss, make him pay.'],
      encouragement: ["That's a fighter's round.", 'Beautiful — that’s it!'],
      urgency: ['This is the round — dig!', 'Empty the tank — now!'],
      finish: [
        "That's a fighter's session. {total} rounds, you dug deep. Respect.",
        '{total} rounds — you left it all in there. Respect.',
      ],
    },
  },

  calm: {
    id: 'calm',
    name: 'The Calm Coach',
    talkativeness: 0.25,
    encouragementBias: 0.5,
    banks: {
      workout_intro: [
        '{name}. Relaxed, clean, no strain. Just move well.',
        "{name}. Let's flow today. Easy and smooth.",
      ],
      warmup: ['Warm up. Long, easy breaths.', 'Ease in. Nice and loose.'],
      round_intro: ['Round {round}. {name}. Smooth — find your rhythm.', 'Round {round}. {name}. Easy and clean.'],
      round_intro_final: [
        'Round {round}. Last one. {name} — stay relaxed, finish smooth.',
        'Final round. {name}. Easy to the end.',
      ],
      rest_intro: ['Rest. Slow the breath down. Next: {next}.', 'Breathe. Recover fully. {next} soon.'],
      recovery: ['Long, easy breaths. Drop the shoulders.', 'Loosen up. Let it settle.'],
      teaching: ['Relaxed is faster. Stay loose.', 'Let the shots flow — no strain.'],
      encouragement: ['That was smooth.', 'Nice and clean — good.'],
      urgency: ['Stay smooth. Strong to the finish.', 'Easy — bring it home.'],
      finish: [
        'Smooth work. {total} rounds, stayed loose the whole way. Well done.',
        '{total} rounds, sustainable and clean. Nicely done.',
      ],
    },
  },

  competition: {
    id: 'competition',
    name: 'The Competition Coach',
    talkativeness: 0.6,
    encouragementBias: 0.35,
    banks: {
      workout_intro: [
        '{name}. We train to a real standard today. No coasting.',
        '{name}. Championship habits. Earn every round.',
      ],
      warmup: ['Warm up. Build it deliberately.', 'Ease in. Prepare properly.'],
      round_intro: [
        'Round {round}. {name}. Hold the standard.',
        'Round {round}. {name}. Compose, then fire.',
      ],
      round_intro_final: [
        'Round {round}. The championship round. {name} — this is what we train for.',
        'Final round. {name}. Give me everything, form intact.',
      ],
      rest_intro: ['Recover. The next round is the one that counts. Next: {next}.', 'Good. Breathe. {next} — earn it.'],
      recovery: ['Recover with purpose. Breathe.', 'Reset. Compose.'],
      teaching: ['Details win fights. Hold the standard when tired.', 'The last thirty is where you’re made.'],
      encouragement: ["That's championship level.", 'That met the standard.'],
      urgency: ['Don’t cheat the round — dig!', 'Championship rounds — finish!'],
      finish: [
        'You met the standard today. {total} rounds. That’s what fighters do. Excellent.',
        '{total} rounds to a real standard. Excellent work.',
      ],
    },
  },

  southpaw: {
    id: 'southpaw',
    name: 'The Southpaw Coach',
    talkativeness: 0.55,
    encouragementBias: 0.5,
    banks: {
      workout_intro: [
        '{name}. We build the southpaw game — the real one. Your stance is a problem for them.',
        '{name}. Own the outside, own the angle. Let’s sharpen it.',
      ],
      warmup: ['Warm up. Feel the lead foot, find your range.', 'Ease in. Get to your angle.'],
      round_intro: [
        'Round {round}. {name}. Own the outside foot.',
        'Round {round}. {name}. Straight left on the line.',
      ],
      round_intro_final: [
        'Round {round}. Last one. {name} — take that angle every time.',
        'Final round. {name}. Make him turn, then the left.',
      ],
      rest_intro: ['Rest. Breathe. Next: {next}.', 'Good. Recover. {next} coming.'],
      recovery: ['Breathe. Reset your feet.', 'Loosen up. Find the lead foot again.'],
      teaching: ['Win the outside foot and the left opens up.', 'Step outside first — then the straight left.'],
      encouragement: ['That angle was yours.', 'That’s the southpaw edge — good.'],
      urgency: ['Take the angle — finish!', 'Straight left — dig!'],
      finish: [
        'That’s the southpaw edge — use it. {total} rounds, great work.',
        '{total} rounds of real southpaw work. Most never learn to deal with it. Great.',
      ],
    },
  },
};

export function personalityFor(id: CoachPackId): PersonalityProfile {
  return PERSONALITIES[id];
}
