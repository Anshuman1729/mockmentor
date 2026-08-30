import { describe, it, expect } from 'vitest';
import { normalizeRoundType, getTotalQuestions, seedRoundType, QUESTIONS_BY_ROUND } from '../lib/round-types';

describe('round-types', () => {
  describe('canonical UI round types (SetupForm.tsx ROUND_TYPES)', () => {
    // Regression lock: these are the exact 7 strings the dropdown in
    // components/SetupForm.tsx sends as round_type.
    it.each([
      ['Technical Screen', 'technical_screen', 5],
      ['Technical Deep Dive', 'technical_deep_dive', 8],
      ['System Design', 'system_design', 6],
      ['Behavioral', 'behavioural', 7],
      ['Final Round', 'final', 8],
      ['HR Screen', 'hr_screen', 5],
      ['Case Study', 'case_study', 5],
    ])('%s -> %s (%i questions)', (raw, expectedNormalized, expectedCount) => {
      expect(normalizeRoundType(raw)).toBe(expectedNormalized);
      expect(getTotalQuestions(raw)).toBe(expectedCount);
    });
  });

  describe('legacy round types', () => {
    it('"screening" -> technical_screen / 5', () => {
      expect(normalizeRoundType('screening')).toBe('technical_screen');
      expect(getTotalQuestions('screening')).toBe(5);
    });

    // The actual bug fix: previously the question route folded "technical"
    // into technical_screen (5 questions) but the debrief route treated it
    // as its own key requiring 8 questions, so a session could generate 5
    // questions and then never satisfy the debrief completeness gate.
    it('"technical" -> technical_screen / 5 (the bug fix)', () => {
      expect(normalizeRoundType('technical')).toBe('technical_screen');
      expect(getTotalQuestions('technical')).toBe(5);
    });
  });

  it('"quick_test" -> quick_test / 1', () => {
    expect(normalizeRoundType('quick_test')).toBe('quick_test');
    expect(getTotalQuestions('quick_test')).toBe(1);
  });

  describe('unrecognized input falls back consistently', () => {
    it.each([
      ['unknown value', 'totally_unknown_round_type'],
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['mixed-case unknown', 'ToTaLlY UnKnOwN'],
      ['whitespace-padded unknown', '   totally_unknown_round_type   '],
    ])('%s -> default (technical_screen / 5)', (_label, raw) => {
      expect(normalizeRoundType(raw)).toBe('technical_screen');
      expect(getTotalQuestions(raw)).toBe(5);
    });

    it('mixed-case + whitespace-padded canonical value still resolves correctly', () => {
      expect(normalizeRoundType('  System Design  ')).toBe('system_design');
      expect(normalizeRoundType('SYSTEM DESIGN')).toBe('system_design');
    });
  });

  describe('idempotency', () => {
    it('normalizing an already-canonical key returns it unchanged', () => {
      for (const key of Object.keys(QUESTIONS_BY_ROUND)) {
        expect(normalizeRoundType(key)).toBe(key);
        expect(normalizeRoundType(normalizeRoundType(key))).toBe(normalizeRoundType(key));
      }
    });
  });

  describe('consistency invariant', () => {
    it('getTotalQuestions(k) === QUESTIONS_BY_ROUND[k] for every canonical key', () => {
      expect(
        Object.keys(QUESTIONS_BY_ROUND).every(
          (k) => getTotalQuestions(k) === QUESTIONS_BY_ROUND[k]
        )
      ).toBe(true);
    });
  });

  describe('seedRoundType', () => {
    it.each([
      ['behavioural', 'behavioural'],
      ['Behavioral', 'behavioural'],
      ['hr_screen', 'behavioural'],
      ['HR Screen', 'behavioural'],
    ])('%s -> behavioural', (raw, expected) => {
      expect(seedRoundType(raw)).toBe(expected);
    });

    it.each([
      ['technical_screen', 'technical'],
      ['Technical Screen', 'technical'],
      ['technical_deep_dive', 'technical'],
      ['system_design', 'technical'],
      ['System Design', 'technical'],
      ['final', 'technical'],
      ['Final Round', 'technical'],
      ['case_study', 'technical'],
      ['Case Study', 'technical'],
      ['quick_test', 'technical'],
      ['unknown_round_type', 'technical'],
    ])('%s -> technical', (raw, expected) => {
      expect(seedRoundType(raw)).toBe(expected);
    });
  });
});
