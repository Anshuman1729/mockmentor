import { describe, it, expect } from 'vitest';
import { checkFatalFlag, isZeroSignal, applyFatalFlag } from '../lib/fatal-flag';

describe('fatal-flag', () => {
  it('detects zero-signal answers', () => {
    expect(isZeroSignal('I don\'t know')).toBe(true);
  });
  it('returns triggered when skip rate > 30% (2 null / 3 total)', () => {
    const qas = [
      { question_number: 1, answer: null },
      { question_number: 2, answer: null },
      // isZeroSignal() also flags anything under 10 words as zero-signal, not
      // just nulls/"I don't know" — a one-word answer like "Yes" would count
      // as zero-signal too and push this to a 3/3 skip rate, not the 2/3 this
      // test is meant to exercise. Needs a genuine, substantive answer here.
      { question_number: 3, answer: 'I approached this by first analyzing the requirements, then designing a solution that could scale.' },
    ];
    const result = checkFatalFlag(qas, 3);
    // 2 of 3 answers are zero-signal → 66.7% skip rate > 30% threshold → triggered
    expect(result.triggered).toBe(true);
    expect(result.skipRate).toBeCloseTo(2/3, 2);
    expect(typeof result.skipRate).toBe('number');
  });

  it('does not trigger when a short-but-real answer is the only weak spot (1/4 zero-signal, below the 30% threshold)', () => {
    const qas = [
      { question_number: 1, answer: 'I approached this by first analyzing the requirements, then designing a solution that could scale.' },
      { question_number: 2, answer: 'We diagnosed the issue by checking logs, isolating the failing service, then rolling back the deploy.' },
      { question_number: 3, answer: 'I would start by profiling the query and checking whether the right indexes actually exist.' },
      { question_number: 4, answer: 'Yes' }, // under 10 words — zero-signal, but only 1 of 4 (25%)
    ];
    const result = checkFatalFlag(qas, 4);
    expect(result.triggered).toBe(false);
    expect(result.skipRate).toBeCloseTo(1/4, 2);
  });
});

describe('applyFatalFlag', () => {
  it('caps a high score down to 30 and forces recommendation to "No Hire" when triggered', () => {
    const result = applyFatalFlag(78, 'Strong Hire', {
      triggered: true,
      skipCount: 3,
      totalQuestions: 5,
      skipRate: 0.6,
      zeroSignalQuestionNumbers: [1, 2, 3],
    });
    expect(result.hireProbability).toBe(30);
    expect(result.recommendation).toBe('No Hire');
  });

  it('does not raise a score already below 30 when triggered (Math.min, not an overwrite)', () => {
    const result = applyFatalFlag(12, 'No Hire', {
      triggered: true,
      skipCount: 4,
      totalQuestions: 5,
      skipRate: 0.8,
      zeroSignalQuestionNumbers: [1, 2, 3, 4],
    });
    expect(result.hireProbability).toBe(12);
    expect(result.recommendation).toBe('No Hire');
  });

  it('passes hireProbability and recommendation through unchanged when not triggered', () => {
    const result = applyFatalFlag(72, 'Hire', {
      triggered: false,
      skipCount: 1,
      totalQuestions: 5,
      skipRate: 0.2,
      zeroSignalQuestionNumbers: [2],
    });
    expect(result.hireProbability).toBe(72);
    expect(result.recommendation).toBe('Hire');
  });

  it('carries skip_rate/skip_count/zero_signal_question_numbers into internalNote, with no "FATAL FLAG" marker anywhere', () => {
    const result = applyFatalFlag(78, 'Strong Hire', {
      triggered: true,
      skipCount: 3,
      totalQuestions: 5,
      skipRate: 0.6,
      zeroSignalQuestionNumbers: [1, 2, 3],
    });
    expect(result.internalNote).toEqual({
      triggered: true,
      skip_count: 3,
      total_questions: 5,
      skip_rate: 0.6,
      zero_signal_question_numbers: [1, 2, 3],
    });
    expect(JSON.stringify(result.internalNote)).not.toContain('FATAL FLAG');
  });
});
