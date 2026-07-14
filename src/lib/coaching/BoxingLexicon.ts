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
  /**
   * Set on a FIRST exposure (both forms spoken): every call sign in the combo,
   * which the runtime records as known so later occurrences use pure shorthand.
   */
  readonly exposedSigns?: readonly string[];
}

/** Canonical call-sign shorthand for an exposure, e.g. [1,2,3] → "One-two-three". */
function callSignShorthand(numbers: readonly number[]): string {
  return cap(numbers.map((n) => callSign(n)).join('-'));
}

/** Plain-name translation for an exposure, e.g. [1,2,3] → "Jab, cross, hook". */
function namesList(numbers: readonly number[], vocab: PackVocabulary): string {
  return numbers
    .map((n, i) => (i === 0 ? cap(nameFor(n, vocab)) : nameFor(n, vocab).toLowerCase()))
    .join(', ');
}

/**
 * True when saying this combo to this pack would be a FIRST exposure — a call-sign
 * pack that still has an unseen sign in the combo. Read-only; the runtime uses it
 * to mark the whole combo's vocabulary known at commit time.
 */
export function comboExposesVocabulary(
  numbers: readonly number[],
  packId: CoachPackId,
  memory: Pick<CallSignMemory, 'hasIntroducedCallSign'>,
): boolean {
  return usesCallSigns(packId) && numbers.some((n) => !memory.hasIntroducedCallSign(callSign(n)));
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
 * Decide what to say WITHOUT mutating memory (PR-027B — teach through exposure).
 *
 *  - Name-based packs: always the plain names ("Jab. Cross. Rear uppercut.").
 *  - Call-sign packs, FIRST exposure (any unseen sign): BOTH forms in one line —
 *    the call-sign shorthand then the translation ("One-two-three. Jab, cross,
 *    hook.") — and every sign in the combo becomes known.
 *  - Call-sign packs, once known: the pack's own shorthand ("One-two-three!").
 *
 * One exposure is enough — this is coaching, not a lesson. The runtime marks the
 * combo's vocabulary at COMMIT time so a silenced combo isn't wrongly recorded.
 */
export function planCombo(
  numbers: readonly number[],
  packId: CoachPackId,
  memory: Pick<CallSignMemory, 'hasIntroducedCallSign'>,
): ComboRender {
  if (!usesCallSigns(packId)) {
    return { text: renderCombo(numbers, packId) };
  }
  if (comboExposesVocabulary(numbers, packId, memory)) {
    const vocab = PACK_VOCABULARY[packId];
    return {
      text: `${callSignShorthand(numbers)}. ${namesList(numbers, vocab)}.`,
      exposedSigns: numbers.map((n) => callSign(n)),
    };
  }
  return { text: renderCombo(numbers, packId) };
}

/**
 * Plan a combo AND record its vocabulary as known on a first exposure. Used
 * standalone (and in tests); the live runtime uses planCombo + a commit-time mark.
 */
export function renderComboTaught(
  numbers: readonly number[],
  packId: CoachPackId,
  memory: CallSignMemory,
): ComboRender {
  const r = planCombo(numbers, packId, memory);
  r.exposedSigns?.forEach((s) => memory.noteCallSignIntroduced(s));
  return r;
}
