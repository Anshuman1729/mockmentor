import { describe, it, expect } from 'vitest';
import { calculateNormalizedScore } from '../lib/rubric-researched';

describe('rubric-researched', () => {
  it('calculates Senior score correctly', () => {
    const scores = {
      TECHNICAL_DEPTH: 4,
      PROBLEM_SOLVING: 3,
      STAR_ALIGNMENT: 5,
      COMMUNICATION_SNR: 4,
      RESULT_ORIENTATION: 3,
      OWNERSHIP_ETHICS: 4,
      ADAPTABILITY_GROWTH: 3,
      EDGE_CASE_MASTERY: 2,
    };
    const result = calculateNormalizedScore(scores, 'Senior');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
