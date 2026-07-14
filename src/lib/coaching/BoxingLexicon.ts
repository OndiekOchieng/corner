/**
 * BoxingLexicon — authentic boxing terminology, expressed at the right level for
 * each Coach Pack (PR-020C, BOXING_LEXICON.md).
 *
 * A combination is a sequence of punch numbers (the universal gym shorthand). The
 * lexicon renders that sequence into the words a given coach would actually use —
 * plain English, coach shorthand, or numeric call signs — and can TEACH a call
 * sign before using it, so the athlete learns boxing language just by training.
 *
 * Pure and deterministic: no randomness, no wall clock. The same combo + pack +
 * memory always renders the same words.
 */

import type { CoachPackId } from './CoachAction';

export type PunchNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface Punch {
  readonly number: PunchNumber;
  /** Orthodox plain name. */
  readonly name: string;
  /** Lead/rear naming (Southpaw & very technical coaches prefer this). */
  readonly handName: string;
}

/** The universal numeric system: 1 jab · 2 cross · 3 lead hook · 4 rear hook · 5 lead uppercut · 6 rear uppercut. */
export const PUNCHES: Readonly<Record<PunchNumber, Punch>> = {
  1: { number: 1, name: 'Jab', handName: 'Lead hand' },
  2: { number: 2, name: 'Cross', handName: 'Rear hand' },
  3: { number: 3, name: 'Lead hook', handName: 'Lead hook' },
  4: { number: 4, name: 'Rear hook', handName: 'Rear hook' },
  5: { number: 5, name: 'Lead uppercut', handName: 'Lead uppercut' },
  6: { number: 6, name: 'Rear uppercut', handName: 'Rear uppercut' },
};

const CALL_SIGN_WORDS: Readonly<Record<PunchNumber, string>> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
};

// Widened to `number` so the lexicon can grow past six punches without changing
// call sites (unknown numbers degrade gracefully rather than throwing).
export function callSign(n: number): string {
  return CALL_SIGN_WORDS[n as PunchNumber] ?? String(n);
}
export function punchName(n: number): string {
  return PUNCHES[n as PunchNumber]?.name ?? `punch ${n}`;
}

/**
 * Boxing language progression:
 *   1 plain    — "Jab. Cross. Rear uppercut."
 *   2 mixed    — "Jab, cross, rear uppercut."
 *   3 coach    — "One. Two. Six."
 *   4 callsign — "One-two-six."
 */
export type VocabularyLevel = 1 | 2 | 3 | 4;

export interface PackVocabulary {
  readonly level: VocabularyLevel;
  /** Southpaw / lead-rear framing instead of plain names. */
  readonly usesHandNames: boolean;
  /** Append energy to the call ("One-two-six!"). */
  readonly energetic: boolean;
  /** Terse: call only the key (final) punch ("Six. Again."). */
  readonly minimal: boolean;
  /** A soft framing prefix for a single emphasis ("Let's finish with the …"). */
  readonly softFinish: boolean;
}

/** Each pack adopts terminology differently (PERSONALITY_SYSTEM.md §terminology). */
export const PACK_VOCABULARY: Readonly<Record<CoachPackId, PackVocabulary>> = {
  technical:   { level: 1, usesHandNames: false, energetic: false, minimal: false, softFinish: false },
  calm:        { level: 1, usesHandNames: false, energetic: false, minimal: false, softFinish: true },
  southpaw:    { level: 1, usesHandNames: true,  energetic: false, minimal: false, softFinish: false },
  oldschool:   { level: 4, usesHandNames: false, energetic: false, minimal: false, softFinish: false },
  fightnight:  { level: 4, usesHandNames: false, energetic: true,  minimal: false, softFinish: false },
  competition: { level: 4, usesHandNames: false, energetic: false, minimal: true,  softFinish: false },
};

/** True when the pack speaks in numeric call signs (levels 3–4) — vocabulary that must be taught. */
export function usesCallSigns(packId: CoachPackId): boolean {
  return PACK_VOCABULARY[packId].level >= 3;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function nameFor(n: number, vocab: PackVocabulary): string {
  const p = PUNCHES[n as PunchNumber];
  if (!p) return `punch ${n}`;
  return vocab.usesHandNames ? p.handName : p.name;
}

/** Render a combination as a given pack would say it. Pure + deterministic. */
export function renderCombo(numbers: readonly number[], packId: CoachPackId): string {
  const vocab = PACK_VOCABULARY[packId];
  if (numbers.length === 0) return '';

  if (vocab.minimal) {
    // Competition: call the finisher only.
    const last = numbers[numbers.length - 1];
    return `${cap(callSign(last))}. Again.`;
  }

  if (vocab.softFinish && numbers.length > 0) {
    // Calm: soft framing around the finishing punch.
    const last = numbers[numbers.length - 1];
    return `Let's finish with the ${nameFor(last, vocab).toLowerCase()}.`;
  }

  switch (vocab.level) {
    case 1: // plain names, separate beats
      return numbers.map((n) => `${cap(nameFor(n, vocab))}.`).join(' ');
    case 2: // mixed — one flowing line of names
      return `${cap(nameFor(numbers[0], vocab))}, ` + numbers.slice(1).map((n) => nameFor(n, vocab).toLowerCase()).join(', ') + '.';
    case 3: // coach — call signs, separate beats
      return numbers.map((n) => `${cap(callSign(n))}.`).join(' ');
    case 4: { // call signs, combined
      const joined = numbers.map((n) => callSign(n)).join('-');
      return `${cap(joined)}${vocab.energetic ? '!' : '.'}`;
    }
  }
}

/** The natural teaching line for a call sign — "Every time I say one, I mean the jab." */
export function teachCallSign(n: number): string {
  return `Every time I say ${callSign(n)}, I mean the ${punchName(n).toLowerCase()}.`;
}

/** The minimal memory a lexicon render needs — matches CoachingMemory structurally. */
export interface CallSignMemory {
  hasIntroducedCallSign(sign: string): boolean;
  noteCallSignIntroduced(sign: string): void;
}

export interface ComboRender {
  readonly text: string;
  /** Set when this render taught a call sign instead of firing the combo. */
  readonly taughtSign?: string;
}

/**
 * Render a combo, teaching vocabulary before assuming it. For a call-sign pack,
 * the FIRST time an unseen sign appears the coach teaches it ("Every time I say
 * one, I mean the jab.") and remembers it; once every sign in the combo is known,
 * it uses the shorthand. Name-based packs never need to teach. The athlete learns
 * boxing language simply by training (VOCABULARY teaching, §6).
 */
/**
 * The next punch whose call sign this pack still needs to teach (or null — a
 * name-based pack, or every sign already introduced). Read-only.
 */
export function nextUntaughtSign(
  numbers: readonly number[],
  packId: CoachPackId,
  memory: Pick<CallSignMemory, 'hasIntroducedCallSign'>,
): number | null {
  if (!usesCallSigns(packId)) return null;
  return numbers.find((n) => !memory.hasIntroducedCallSign(callSign(n))) ?? null;
}

/**
 * Decide what to say WITHOUT mutating memory — teach the next unseen sign, else
 * render the shorthand. The runtime marks the sign introduced at COMMIT time (when
 * the line is actually spoken), so a combo silenced by the density gate is not
 * wrongly recorded as taught.
 */
export function planCombo(
  numbers: readonly number[],
  packId: CoachPackId,
  memory: Pick<CallSignMemory, 'hasIntroducedCallSign'>,
): ComboRender {
  const sign = nextUntaughtSign(numbers, packId, memory);
  if (sign != null) return { text: teachCallSign(sign), taughtSign: callSign(sign) };
  return { text: renderCombo(numbers, packId) };
}

/**
 * Plan a combo AND mark the taught sign in memory (teach-then-shorthand). Used
 * standalone (and in tests); the live runtime uses planCombo + a commit-time mark.
 */
export function renderComboTaught(
  numbers: readonly number[],
  packId: CoachPackId,
  memory: CallSignMemory,
): ComboRender {
  const r = planCombo(numbers, packId, memory);
  if (r.taughtSign != null) {
    const sign = nextUntaughtSign(numbers, packId, memory);
    if (sign != null) memory.noteCallSignIntroduced(callSign(sign));
  }
  return r;
}
