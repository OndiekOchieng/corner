/**
 * Phrase helpers for the CoachEngine.
 *
 * Kept separate and pure so spoken text is deterministic and unit-testable
 * independent of the browser Speech API.
 */

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

/**
 * Convert a whole number (0–99) into its spoken English words.
 * Numbers outside that range fall back to their digit string, which the TTS
 * engine still reads correctly. Round counts are capped at 50 by validation,
 * so 0–99 comfortably covers every real case.
 */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  const value = Math.floor(n);
  if (value < 20) return ONES[value];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const ones = value % 10;
    return ones ? `${tens}-${ONES[ones]}` : tens;
  }
  return String(value);
}

/** Capitalize the first letter of a string. */
export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Make a round/workout name pleasant for text-to-speech.
 * Seed data uses ALL-CAPS names (e.g. "POWER FOUNDATION") which some engines
 * spell out letter-by-letter; convert those to Title Case. Mixed-case names
 * are left untouched.
 */
export function humanizeName(name: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return '';
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  if (!isAllCaps) return trimmed;
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => capitalize(word))
    .join(' ');
}
