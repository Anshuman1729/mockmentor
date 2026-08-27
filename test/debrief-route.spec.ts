import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// This file needs a fully-mocked "@/lib/groq" (generateDebrief forced to
// throw DebriefSynthesisDeferredError) — a different mocking strategy from
// test/debrief-tpm.spec.ts, which needs the REAL generateDebrief with only
// the groq-sdk transport mocked underneath it. The two can't share a module
// graph (vi.mock('@/lib/groq') would clobber the other file's real
// implementation), so this is deliberately its own file even though the
// plan's file list only names two — see the Coder report for this callout.

const { sqlMock, mockSendEmail, mockGenerateDebrief, mockTrack } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  mockSendEmail: vi.fn(async () => undefined),
  mockGenerateDebrief: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ sql: sqlMock }));
vi.mock('@/lib/session-auth', () => ({
  assertSessionOwner: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));
vi.mock('@/lib/email', () => ({ sendDebriefEmail: mockSendEmail }));
vi.mock('@/lib/analytics', () => ({
  track: mockTrack,
  stableInsertId: vi.fn(() => 'test-insert-id'),
}));
vi.mock('@/lib/groq', () => {
  class DebriefSynthesisDeferredError extends Error {
    retryAfterMs: number;
    constructor(retryAfterMs: number) {
      super('Debrief synthesis deferred');
      this.name = 'DebriefSynthesisDeferredError';
      this.retryAfterMs = retryAfterMs;
    }
  }
  return { generateDebrief: mockGenerateDebrief, DebriefSynthesisDeferredError };
});

import { POST } from '../app/api/interview/debrief/route';
import { DebriefSynthesisDeferredError } from '../lib/groq';

const SESSION_ID = 'session-route-test';

const fakeSessionRow = {
  id: SESSION_ID,
  role: 'Backend Engineer',
  company: 'Acme',
  yoe: 3,
  round_type: 'technical_screen',
  jd_content: 'Build and operate backend services.',
  background: null,
  company_stage: null,
  user_email: 'test@prepsignals.dev',
  created_at: new Date().toISOString(),
  status: 'in_progress',
  candidate_questions_asked: 0,
};

const fakeQaRows = Array.from({ length: 5 }, (_, i) => ({
  question_number: i + 1,
  question: `Question ${i + 1}?`,
  answer: `A sufficiently long substantive answer for question ${i + 1}.`,
  answer_duration_sec: 30,
  seed_question_id: null,
}));

function queryText(strings: TemplateStringsArray): string {
  return strings.join(' ');
}

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe('POST /api/interview/debrief — deferred synthesis path (route-level)', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    mockSendEmail.mockClear();
    mockTrack.mockClear();
    mockGenerateDebrief.mockReset();

    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const text = queryText(strings);
      if (text.includes('FROM sessions WHERE id')) return Promise.resolve([fakeSessionRow]);
      if (text.includes('FROM debriefs WHERE session_id')) return Promise.resolve([]);
      if (text.includes('FROM qa_pairs')) return Promise.resolve(fakeQaRows);
      if (text.includes('FROM question_bank')) return Promise.resolve([]);
      // debriefs INSERT / sessions UPDATE / calibration_loops INSERT should
      // never be reached on the deferred path — but if the code has a bug
      // and does reach them, return something harmless rather than crashing
      // the test with an unhandled shape, so the call-count assertions below
      // are the ones that catch the regression.
      return Promise.resolve([{ id: 'unexpected', session_id: SESSION_ID, created_at: new Date().toISOString() }]);
    });

    mockGenerateDebrief.mockRejectedValue(new DebriefSynthesisDeferredError(4242));
  });

  it('returns 503 with code SYNTHESIS_DEFERRED and a numeric retryAfterMs', async () => {
    const res = await POST(fakeRequest({ sessionId: SESSION_ID }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe('SYNTHESIS_DEFERRED');
    expect(typeof body.retryAfterMs).toBe('number');
    expect(body.retryAfterMs).toBe(4242);
    // No LLM/rate-limit internals in the user-facing message.
    expect(body.error.toLowerCase()).not.toMatch(/rate limit|tpm|groq|token/);
  });

  it('makes zero calls to the debriefs INSERT, sessions UPDATE, or calibration_loops INSERT, and never sends the email', async () => {
    await POST(fakeRequest({ sessionId: SESSION_ID }));

    const insertDebriefCalls = sqlMock.mock.calls.filter(([strings]) =>
      queryText(strings as TemplateStringsArray).includes('INSERT INTO debriefs')
    );
    const updateSessionCalls = sqlMock.mock.calls.filter(([strings]) =>
      queryText(strings as TemplateStringsArray).includes('UPDATE sessions SET status')
    );
    const calibrationInsertCalls = sqlMock.mock.calls.filter(([strings]) =>
      queryText(strings as TemplateStringsArray).includes('INSERT INTO calibration_loops')
    );

    expect(insertDebriefCalls.length).toBe(0);
    expect(updateSessionCalls.length).toBe(0);
    expect(calibrationInsertCalls.length).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('tracks debrief_generation_deferred, not debrief_generation_failed', async () => {
    await POST(fakeRequest({ sessionId: SESSION_ID }));

    const eventNames = mockTrack.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('debrief_generation_deferred');
    expect(eventNames).not.toContain('debrief_generation_failed');
  });
});
