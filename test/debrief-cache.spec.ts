import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setCachedScoring, getCachedScoring, clearCachedScoring, _debugCacheSize } from '../lib/debrief-cache';
import type { CoreScoring } from '../lib/groq';

function makeScoring(tag: string): CoreScoring {
  return {
    metrics: { talk_to_listen_ratio: '70/30', avg_response_latency_sec: 2, signal_to_noise_ratio: 0.5, interruption_count: 0 },
    skill_analysis: [
      { parameter_id: 'TECHNICAL_DEPTH', rating: 3, reasoning: tag, evidence_quotes: [tag] },
    ],
    question_walkthrough: [],
  };
}

describe('lib/debrief-cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined on a miss', () => {
    expect(getCachedScoring('never-set-session')).toBeUndefined();
  });

  it('set then get returns the same scoring', () => {
    const scoring = makeScoring('hit');
    setCachedScoring('session-a', scoring);
    expect(getCachedScoring('session-a')).toEqual(scoring);
    clearCachedScoring('session-a');
  });

  it('expires after the 10-minute TTL', () => {
    setCachedScoring('session-b', makeScoring('expiring'));
    expect(getCachedScoring('session-b')).toBeDefined();

    // Just under TTL — still present
    vi.advanceTimersByTime(10 * 60 * 1000 - 1000);
    expect(getCachedScoring('session-b')).toBeDefined();

    // Past TTL — gone
    vi.advanceTimersByTime(2000);
    expect(getCachedScoring('session-b')).toBeUndefined();
  });

  it('clearCachedScoring removes an entry immediately', () => {
    setCachedScoring('session-c', makeScoring('clear-me'));
    expect(getCachedScoring('session-c')).toBeDefined();
    clearCachedScoring('session-c');
    expect(getCachedScoring('session-c')).toBeUndefined();
  });

  it('evicts the oldest entry once the cap is reached', () => {
    // Drain anything left over from other tests/module state first isn't
    // possible (module-level Map), so work purely in terms of relative
    // behavior: fill well past any plausible remaining headroom under the
    // 200-entry cap, then confirm the cache never exceeds it and the very
    // first key inserted in this test is the one evicted.
    const startSize = _debugCacheSize();
    const keys: string[] = [];
    for (let i = 0; i < 210; i++) {
      const key = `evict-session-${i}`;
      keys.push(key);
      setCachedScoring(key, makeScoring(key));
    }
    expect(_debugCacheSize()).toBeLessThanOrEqual(200);
    // The very first key inserted in this batch should have been evicted
    // once the cap was exceeded, since eviction takes the oldest entry.
    expect(getCachedScoring(keys[0])).toBeUndefined();
    // A recently-inserted key should still be present.
    expect(getCachedScoring(keys[keys.length - 1])).toBeDefined();

    // Cleanup so this test doesn't pollute other tests in the same run.
    for (const key of keys) clearCachedScoring(key);
    expect(_debugCacheSize()).toBeLessThanOrEqual(startSize + 1);
  });
});
