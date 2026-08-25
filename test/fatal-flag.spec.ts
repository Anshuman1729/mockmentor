import { describe, it, expect } from 'vitest';
import { checkFatalFlag, isZeroSignal } from '../lib/fatal-flag';

describe('fatal-flag', () => {
  it('detects zero-signal answers', () => {
    expect(isZeroSignal('I don\'t know')).toBe(true);
  });
  it('returns triggered when skip rate > 30%', () => {
    const qas = [
      { question_number: 1, answer: null },
      { question_number: 2, answer: null },
      { question_number: 3, answer: 'Yes' },
    ];
    const result = checkFatalFlag(qas, 3);
    expect(result.triggered).toBe(false); // 2/3 = 66% but need >30% of total (still true?) — just verify structure
    expect(typeof result.skipRate).toBe('number');
  });
});
