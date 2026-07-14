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
import type { SessionIntroduction } from './SessionIntroduction';

export type ComposedKey =
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
  /** The authored session opening (PR-020B) — replaces the old flat workout_intro bank. */
  readonly introduction: SessionIntroduction;
}

/** Placeholders: {name} workout, {round} number, {total} rounds, {next} next round. */
export const PERSONALITIES: Readonly<Record<CoachPackId, PersonalityProfile>> = {
  technical: {
    id: 'technical',
    name: 'The Technical Coach',
    talkativeness: 0.6,
    encouragementBias: 0.4,
    banks: {
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
    introduction: {
      purpose: 'Set a precise, craft-first tone and name the technical focus. Never greets by time.',
      opening: ['{name}. Precision first today.', "{name}. Let's build it clean."],
      objective: ["Today's focus is {focus}.", 'The focus: {focus}. Keep it honest.'],
      transition: ["Round one coming up. Let's get to work.", 'Round one — start sharp.'],
      energy: 'calm',
    },
  },

  oldschool: {
    id: 'oldschool',
    name: 'The Old School Coach',
    talkativeness: 0.35,
    encouragementBias: 0.2,
    banks: {
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
    introduction: {
      purpose: 'Blunt, fundamentals-first opening; no frills, no time references.',
      greeting: { neutral: ['Right.', 'Okay.'] },
      opening: ['{name}. No shortcuts today.', '{name}. Nothing fancy — just work.'],
      objective: ['We work {focus}. Properly.', '{focus}. Do it right.'],
      transition: ['Round one. Get to it.', "Round one — let's work."],
      energy: 'steady',
    },
  },

  fightnight: {
    id: 'fightnight',
    name: 'The Fight Night Coach',
    talkativeness: 0.85,
    encouragementBias: 0.7,
    banks: {
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
    introduction: {
      purpose: 'Open with fight-night intensity; may acknowledge the evening (opt-in only).',
      greeting: { neutral: ['Alright.', "Let's go."], evening: ['Good evening, fighter.', 'Fight night.'] },
      opening: ["{name}. Let's make every punch count.", '{name}. This is the one.'],
      objective: ["It's {focus} today — make it count.", 'Focus: {focus}. Sharp and dangerous.'],
      transition: ['Round one. Let me see those hands.', "Round one — let's work."],
      energy: 'rising',
    },
  },

  calm: {
    id: 'calm',
    name: 'The Calm Coach',
    talkativeness: 0.25,
    encouragementBias: 0.5,
    banks: {
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
    introduction: {
      purpose: 'Settle the athlete; gentle, and may greet warmly by time of day.',
      greeting: {
        neutral: ["Let's settle in.", 'Take a breath.'],
        morning: ['Good morning.', 'Morning. Ease into it.'],
        afternoon: ['Good afternoon.'],
        evening: ["Good evening. Let's unwind into it."],
      },
      opening: ["{name}. Let's settle in and build.", '{name}. Relaxed and smooth today.'],
      objective: ["We'll work {focus}, easy and clean.", 'Focus: {focus}. No strain.'],
      transition: ['Round one, coming up. Nice and easy.', 'Round one — settle in.'],
      energy: 'calm',
    },
  },

  competition: {
    id: 'competition',
    name: 'The Competition Coach',
    talkativeness: 0.6,
    encouragementBias: 0.35,
    banks: {
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
    introduction: {
      purpose: 'Championship-standard framing; no coasting. Does not reference time.',
      opening: ['{name}. Championship mindset today.', '{name}. We train to a real standard.'],
      objective: ['The focus: {focus}. Hold the standard.', '{focus} — to a championship level.'],
      transition: ['Round one. Set the standard.', 'Round one — earn it.'],
      energy: 'steady',
    },
  },

  southpaw: {
    id: 'southpaw',
    name: 'The Southpaw Coach',
    talkativeness: 0.55,
    encouragementBias: 0.5,
    banks: {
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
    introduction: {
      purpose: 'Southpaw-identity opening; own the outside and the angle. No time references.',
      opening: ["{name}. Let's make your angles count.", '{name}. Own the outside today.'],
      objective: ['The focus: {focus}. From your angle.', '{focus} — southpaw style.'],
      transition: ['Round one. Find that outside foot.', 'Round one — work the angle.'],
      energy: 'steady',
    },
  },
};

export function personalityFor(id: CoachPackId): PersonalityProfile {
  return PERSONALITIES[id];
}
