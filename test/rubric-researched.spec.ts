import { describe, it, expect } from 'vitest';
import { calculateNormalizedScore, INTERVIEW_RUBRIC, SIGNAL_FRAMEWORKS } from '../lib/rubric-researched';

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

  it('SIGNAL_FRAMEWORKS covers exactly the 8 rubric signals, each with steps and a how-to', () => {
    const rubricIds = Object.keys(INTERVIEW_RUBRIC).sort();
    const frameworkIds = Object.keys(SIGNAL_FRAMEWORKS).sort();
    expect(frameworkIds).toEqual(rubricIds);
    for (const id of frameworkIds) {
      const f = SIGNAL_FRAMEWORKS[id];
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.steps.length).toBeGreaterThan(1);
      expect(f.howToApply.length).toBeGreaterThan(0);
    }
  });
});
