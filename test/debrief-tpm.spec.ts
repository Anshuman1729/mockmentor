import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocked groq-sdk ─────────────────────────────────────────────────────────
// vi.mock is hoisted above imports, so any variable it references must come
// from vi.hoisted(). mockCreate stands in for chat.completions.create across
// every test below — configured per-test via mockImplementationOnce.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('groq-sdk', () => {
  class APIError extends Error {
    status?: number;
    error?: unknown;
    headers?: Record<string, string | null | undefined>;
  }
  class RateLimitError extends APIError {}
  class BadRequestError extends APIError {}
  class MockGroq {
    chat = { completions: { create: mockCreate } };
  }
  return {
    default: Object.assign(MockGroq, { APIError, RateLimitError, BadRequestError }),
  };
});

import {
  parseGroqResetDuration,
  estimateTokens,
  decideSynthesisGate,
  generateDebrief,
  DebriefSynthesisDeferredError,
  type SessionContext,
  type QAPair,
  type CoreScoring,
} from '../lib/groq';
import { getCachedScoring, clearCachedScoring } from '../lib/debrief-cache';

// ─── parseGroqResetDuration ──────────────────────────────────────────────────
describe('parseGroqResetDuration', () => {
  const cases: Array<[string | null | undefined, number | null]> = [
    ['7.66s', 7660],
    ['120ms', 120],
    ['2m59.56s', 179560],
    ['1m', 60000],
    ['', null],
    [null, null],
    [undefined, null],
    ['garbage', null],
  ];
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} -> ${expected}`, () => {
      expect(parseGroqResetDuration(input)).toBe(expected);
    });
  }
});

// ─── estimateTokens ──────────────────────────────────────────────────────────
describe('estimateTokens', () => {
  it('is non-zero for non-empty text', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0);
  });
  it('is zero for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
  it('is monotonic — more characters never yields fewer estimated tokens', () => {
    const short = estimateTokens('a'.repeat(100));
    const long = estimateTokens('a'.repeat(1000));
    expect(long).toBeGreaterThan(short);
  });
});

// ─── decideSynthesisGate ─────────────────────────────────────────────────────
describe('decideSynthesisGate', () => {
  it('proceeds when remainingTokens exactly equals needTokens', () => {
    const result = decideSynthesisGate({
      remainingTokens: 5000,
      resetMs: 10000,
      needTokens: 5000,
      maxInlineWaitMs: 20000,
    });
    expect(result).toEqual({ action: 'proceed' });
  });

  it('waits when resetMs exactly equals maxInlineWaitMs', () => {
    const result = decideSynthesisGate({
      remainingTokens: 100,
      resetMs: 20000,
      needTokens: 5000,
      maxInlineWaitMs: 20000,
    });
    expect(result).toEqual({ action: 'wait', ms: 20000 + 250 });
  });

  it('fails open to proceed when remainingTokens is null, regardless of resetMs', () => {
    const result = decideSynthesisGate({
      remainingTokens: null,
      resetMs: 500,
      needTokens: 5000,
      maxInlineWaitMs: 20000,
    });
    expect(result).toEqual({ action: 'proceed' });
  });

  it('defers when remaining is insufficient and resetMs is null (unknown wait, not a silent proceed)', () => {
    const result = decideSynthesisGate({
      remainingTokens: 100,
      resetMs: null,
      needTokens: 5000,
      maxInlineWaitMs: 20000,
    });
    expect(result.action).toBe('defer');
    expect(typeof (result as { retryAfterMs: number }).retryAfterMs).toBe('number');
  });

  it('defers when remaining is insufficient and resetMs exceeds the inline wait window', () => {
    const result = decideSynthesisGate({
      remainingTokens: 100,
      resetMs: 30000,
      needTokens: 5000,
      maxInlineWaitMs: 20000,
    });
    expect(result).toEqual({ action: 'defer', retryAfterMs: 30000 });
  });
});

// ─── generateDebrief — mocked-SDK integration ────────────────────────────────
function makeCompletion(content: unknown, promptTokens = 500, completionTokens = 300) {
  return {
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}

function makeApiPromise(data: unknown, headers: Record<string, string> = {}) {
  const response = {
    headers: { get: (key: string) => (key in headers ? headers[key] : null) },
  };
  const promise = Promise.resolve(data) as Promise<unknown> & {
    withResponse: () => Promise<{ data: unknown; response: typeof response }>;
  };
  promise.withResponse = () => Promise.resolve({ data, response });
  return promise;
}

const scoringPayload: CoreScoring = {
  metrics: {
    talk_to_listen_ratio: '70/30',
    avg_response_latency_sec: 2.0,
    signal_to_noise_ratio: 0.4,
    interruption_count: 0,
  },
  skill_analysis: [
    {
      parameter_id: 'TECHNICAL_DEPTH',
      rating: 2,
      reasoning: 'Vague on internals; interviewer would not trust depth claims.',
      evidence_quotes: ['We used the standard approach', 'It just worked'],
    },
    {
      parameter_id: 'COMMUNICATION_SNR',
      rating: 5,
      reasoning: 'Answer-first, no filler; builds confidence fast.',
      evidence_quotes: ['The root cause was a stale cache key', 'Fixed in one line'],
    },
  ],
  question_walkthrough: [
    { question_number: 1, key_takeaway: 'Vague technical claim, low trust.', signal_ids: ['TECHNICAL_DEPTH'] },
    { question_number: 2, key_takeaway: 'Sharp, concise diagnosis.', signal_ids: ['COMMUNICATION_SNR'] },
  ],
};

const synthesisPayload = {
  summary: { overall_impression: "I'd want a second opinion — strong on communication, thin on depth." },
  priority_risks: [
    {
      title: 'Evidence gap',
      description: 'Claims lack the specifics an interviewer needs to verify real understanding.',
      related_signal_ids: ['TECHNICAL_DEPTH'],
    },
  ],
  model_answers: [
    {
      question_number: 1,
      parameter_id: 'TECHNICAL_DEPTH',
      your_quote: 'We used the standard approach',
      why_it_hurt: 'Reads as pattern-matching rather than a reasoned decision.',
      framework: 'Answer → Reasoning → Trade-off',
      model_excerpt: 'We chose X because Y constraint; the trade-off was Z.',
    },
  ],
  path_to_next_tier: 'One technically detailed answer with a real trade-off would move this up a tier.',
  behavioral_insights: {
    star_adherence_score: 60,
    confidence_level: 'Medium',
    confidence_rationale: 'Based on 2 answers, limited technical coverage.',
    red_flags: [],
  },
  actionable_feedback: {
    strengths: ['Clear, concise communicator'],
    growth_areas: ['Needs to explain technical decisions with reasoning'],
    top_priority_fix: 'Practice naming the actual constraint behind a decision.',
  },
};

const session: SessionContext = {
  role: 'Backend Engineer',
  company: 'Acme',
  yoe: 3,
  round_type: 'technical_screen',
  jd_content: 'Build and operate backend services.',
  background: 'Worked on distributed systems for 3 years.',
  company_stage: 'Series A',
};

const qas: QAPair[] = [
  { question_number: 1, question: 'Tell me about a system you built.', answer: 'We used the standard approach and it just worked, honestly not much to say.' },
  { question_number: 2, question: 'How did you debug a production issue?', answer: 'The root cause was a stale cache key, fixed in one line, verified with a canary rollout.' },
];

const PROCEED_HEADERS = { 'x-ratelimit-remaining-tokens': '100000', 'x-ratelimit-reset-tokens': '1s' };
const DEFER_HEADERS = { 'x-ratelimit-remaining-tokens': '10', 'x-ratelimit-reset-tokens': '30s' };

describe('generateDebrief — TPM gating (mocked groq-sdk)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.GROQ_API_KEY = 'test-key';
  });

  it('(a) headers say proceed — exactly 2 API calls, merged report matches the expected shape', async () => {
    mockCreate
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(scoringPayload), PROCEED_HEADERS))
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(synthesisPayload), PROCEED_HEADERS));

    const result = await generateDebrief('session-proceed', session, qas);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.report.summary.overall_impression).toBe(synthesisPayload.summary.overall_impression);
    expect(result.report.skill_analysis).toEqual(scoringPayload.skill_analysis);
    expect(result.report.priority_risks).toEqual(synthesisPayload.priority_risks);
  });

  it('(b) headers say defer — exactly 1 API call, DebriefSynthesisDeferredError thrown, scoring cached', async () => {
    mockCreate.mockImplementationOnce(() => makeApiPromise(makeCompletion(scoringPayload), DEFER_HEADERS));

    await expect(generateDebrief('session-defer', session, qas)).rejects.toBeInstanceOf(
      DebriefSynthesisDeferredError
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(getCachedScoring('session-defer')).toEqual(scoringPayload);

    clearCachedScoring('session-defer');
  });

  it('(c) retry with a warm cache — exactly 1 API call (synthesis only), report matches a fresh (a)-style run', async () => {
    // Warm the cache the same way a real defer would.
    mockCreate.mockImplementationOnce(() => makeApiPromise(makeCompletion(scoringPayload), DEFER_HEADERS));
    await expect(generateDebrief('session-warm-cache', session, qas)).rejects.toBeInstanceOf(
      DebriefSynthesisDeferredError
    );
    expect(getCachedScoring('session-warm-cache')).toBeDefined();

    // A clean "proceed" run for comparison — same fixtures, no cache involved.
    mockCreate.mockReset();
    mockCreate
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(scoringPayload), PROCEED_HEADERS))
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(synthesisPayload), PROCEED_HEADERS));
    const freshResult = await generateDebrief('session-proceed-for-comparison', session, qas);

    // Now the actual warm-cache retry: only 1 call expected (synthesis only).
    mockCreate.mockReset();
    mockCreate.mockImplementationOnce(() => makeApiPromise(makeCompletion(synthesisPayload), PROCEED_HEADERS));
    const retryResult = await generateDebrief('session-warm-cache', session, qas);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(retryResult.report).toEqual(freshResult.report);

    clearCachedScoring('session-warm-cache');
  });

  it('(d) retry with a cold cache (never cached / expired) — 2 API calls, no crash', async () => {
    mockCreate
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(scoringPayload), PROCEED_HEADERS))
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(synthesisPayload), PROCEED_HEADERS));

    await expect(generateDebrief('session-cold-cache', session, qas)).resolves.toBeDefined();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('(e) headers entirely absent on call 1 — fails open, 2 API calls', async () => {
    mockCreate
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(scoringPayload))) // no headers arg
      .mockImplementationOnce(() => makeApiPromise(makeCompletion(synthesisPayload)));

    await expect(generateDebrief('session-headers-absent', session, qas)).resolves.toBeDefined();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
