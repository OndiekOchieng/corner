import { describe, it, expect } from 'vitest';
import { numberToWords, capitalize, humanizeName } from '@/lib/speech/phrases';

describe('numberToWords', () => {
  it('handles 0-19', () => {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(1)).toBe('one');
    expect(numberToWords(11)).toBe('eleven');
    expect(numberToWords(19)).toBe('nineteen');
  });

  it('handles tens and compound numbers', () => {
    expect(numberToWords(20)).toBe('twenty');
    expect(numberToWords(21)).toBe('twenty-one');
    expect(numberToWords(50)).toBe('fifty');
    expect(numberToWords(99)).toBe('ninety-nine');
  });

  it('falls back to digits outside 0-99', () => {
    expect(numberToWords(100)).toBe('100');
    expect(numberToWords(-1)).toBe('-1');
  });
});

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('one')).toBe('One');
    expect(capitalize('')).toBe('');
  });
});

describe('humanizeName', () => {
  it('title-cases ALL-CAPS names for cleaner TTS', () => {
    expect(humanizeName('POWER FOUNDATION')).toBe('Power Foundation');
    expect(humanizeName('THE JAB')).toBe('The Jab');
  });

  it('leaves mixed-case names untouched', () => {
    expect(humanizeName('Orthodox Power')).toBe('Orthodox Power');
  });

  it('handles empty input', () => {
    expect(humanizeName('')).toBe('');
  });
});
