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
  buildSynthesisTranscript,
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

// ─── buildSynthesisTranscript ────────────────────────────────────────────────
function makeQa(n: number): QAPair {
  return { question_number: n, question: `Question text ${n}`, answer: `Answer text ${n}` };
}

function makeScoring(
  weakParamIds: string[],
  walkthrough: Array<{ question_number: number; signal_ids: string[] }>
): CoreScoring {
  return {
    metrics: {
      talk_to_listen_ratio: '70/30',
      avg_response_latency_sec: 2.0,
      signal_to_noise_ratio: 0.4,
      interruption_count: 0,
    },
    skill_analysis: weakParamIds.map((id) => ({
      parameter_id: id,
      rating: 2,
      reasoning: 'weak',
      evidence_quotes: ['quote'],
    })),
    question_walkthrough: walkthrough.map((w) => ({
      question_number: w.question_number,
      key_takeaway: `takeaway ${w.question_number}`,
      signal_ids: w.signal_ids,
    })),
  };
}

const includesQ = (transcript: string, n: number) => transcript.includes(`Q${n}: Question text ${n}`);

describe('buildSynthesisTranscript', () => {
  it('ranks an entry touching 2 weak signals above ones touching only 1, even when it comes later', () => {
    const qas = [1, 2, 3, 4, 5, 6].map(makeQa);
    // Q1-Q5 each touch 1 weak signal; Q6 (the last question) touches both.
    const scoring = makeScoring(
      ['SIGNAL_A', 'SIGNAL_B'],
      [
        { question_number: 1, signal_ids: ['SIGNAL_A'] },
        { question_number: 2, signal_ids: ['SIGNAL_A'] },
        { question_number: 3, signal_ids: ['SIGNAL_A'] },
        { question_number: 4, signal_ids: ['SIGNAL_A'] },
        { question_number: 5, signal_ids: ['SIGNAL_A'] },
        { question_number: 6, signal_ids: ['SIGNAL_A', 'SIGNAL_B'] },
      ]
    );

    const transcript = buildSynthesisTranscript(qas, scoring, 4000);

    // Naive ascending-index-then-slice(5) would keep Q1-Q5 and drop Q6 —
    // the single most relevant entry. The fix must keep Q6 and drop the
    // lowest-ranked tail entry (Q5) instead.
    expect(includesQ(transcript, 6)).toBe(true);
    expect(includesQ(transcript, 5)).toBe(false);
    expect(includesQ(transcript, 1)).toBe(true);
    expect(includesQ(transcript, 2)).toBe(true);
    expect(includesQ(transcript, 3)).toBe(true);
    expect(includesQ(transcript, 4)).toBe(true);
  });

  it('breaks ties by ascending question index, deterministically', () => {
    const qas = [1, 2, 3, 4, 5, 6].map(makeQa);
    // All 6 touch exactly 1 weak signal each — pure tie on relevance.
    const scoring = makeScoring(
      ['SIGNAL_A'],
      [1, 2, 3, 4, 5, 6].map((n) => ({ question_number: n, signal_ids: ['SIGNAL_A'] }))
    );

    const transcript = buildSynthesisTranscript(qas, scoring, 4000);

    // Cap at 5, tie-broken ascending -> keep Q1-Q5, drop Q6.
    for (const n of [1, 2, 3, 4, 5]) expect(includesQ(transcript, n)).toBe(true);
    expect(includesQ(transcript, 6)).toBe(false);

    // Deterministic across repeated calls.
    expect(buildSynthesisTranscript(qas, scoring, 4000)).toBe(transcript);
  });

  it('floors at 3 by padding with non-matching entries when fewer than 3 qualify', () => {
    const qas = [1, 2, 3, 4].map(makeQa);
    const scoring = makeScoring(
      ['SIGNAL_A'],
      [
        { question_number: 1, signal_ids: ['SIGNAL_A'] },
        { question_number: 2, signal_ids: ['SIGNAL_B'] },
        { question_number: 3, signal_ids: ['SIGNAL_B'] },
        { question_number: 4, signal_ids: ['SIGNAL_B'] },
      ]
    );

    const transcript = buildSynthesisTranscript(qas, scoring, 4000);
    const includedCount = [1, 2, 3, 4].filter((n) => includesQ(transcript, n)).length;
    expect(includedCount).toBe(3);
    expect(includesQ(transcript, 1)).toBe(true); // the one genuine match must survive
  });

  it('caps at 5 even when more than 5 entries qualify', () => {
    const qas = [1, 2, 3, 4, 5, 6, 7].map(makeQa);
    const scoring = makeScoring(
      ['SIGNAL_A'],
      [1, 2, 3, 4, 5, 6, 7].map((n) => ({ question_number: n, signal_ids: ['SIGNAL_A'] }))
    );

    const transcript = buildSynthesisTranscript(qas, scoring, 4000);
    const includedCount = [1, 2, 3, 4, 5, 6, 7].filter((n) => includesQ(transcript, n)).length;
    expect(includedCount).toBe(5);
  });

  it('falls back to the full transcript when question_walkthrough is empty', () => {
    const qas = [1, 2, 3].map(makeQa);
    const scoring = makeScoring(['SIGNAL_A'], []);

    const transcript = buildSynthesisTranscript(qas, scoring, 4000);
    for (const n of [1, 2, 3]) expect(includesQ(transcript, n)).toBe(true);
  });

  it('falls back to the full transcript when there are no weak signals (all ratings > 3)', () => {
    const qas = [1, 2, 3].map(makeQa);
    const scoring: CoreScoring = {
      metrics: {
        talk_to_listen_ratio: '70/30',
        avg_response_latency_sec: 2.0,
        signal_to_noise_ratio: 0.4,
        interruption_count: 0,
      },
      skill_analysis: [
        { parameter_id: 'SIGNAL_A', rating: 5, reasoning: 'strong', evidence_quotes: ['quote'] },
      ],
      question_walkthrough: [1, 2, 3].map((n) => ({
        question_number: n,
        key_takeaway: `takeaway ${n}`,
        signal_ids: ['SIGNAL_A'],
      })),
    };

    const transcript = buildSynthesisTranscript(qas, scoring, 4000);
    for (const n of [1, 2, 3]) expect(includesQ(transcript, n)).toBe(true);
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
