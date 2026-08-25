import { describe, it, expect } from 'vitest';
import { checkFatalFlag, isZeroSignal } from '../lib/fatal-flag';

describe('fatal-flag', () => {
  it('detects zero-signal answers', () => {
    expect(isZeroSignal('I don\'t know')).toBe(true);
  });
  it('returns triggered when skip rate > 30% (2 null / 3 total)', () => {
    const qas = [
      { question_number: 1, answer: null },
      { question_number: 2, answer: null },
      { question_number: 3, answer: 'Yes' },
    ];
    const result = checkFatalFlag(qas, 3);
    // 2 of 3 answers are zero-signal → 66.7% skip rate > 30% threshold → triggered
    expect(result.triggered).toBe(true);
    expect(result.skipRate).toBeCloseTo(2/3, 2);
    expect(typeof result.skipRate).toBe('number');
  });
});
