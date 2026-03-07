"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTTS } from "@/hooks/useTTS";
import { useSTT } from "@/hooks/useSTT";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

type RoomState =
  | "init"
  | "tmay"
  | "loading-question"
  | "speaking"
  | "listening"
  | "submitting"
  | "generating-debrief";

interface QuestionState {
  questionId: string;
  question: string;
  questionNumber: number;
  total: number;
}

interface SessionInfo {
  role: string;
  company: string;
  round_type: string;
  background: string | null;
}

const DEBRIEF_MESSAGES = [
  { label: "Reading your transcript", sub: "Pulling everything you said into context…"          },
  { label: "Extracting signal",       sub: "Finding what landed and what fell flat…"             },
  { label: "Checking the evidence",   sub: "Pinning scores to verbatim quotes from your answers…"},
  { label: "Writing your feedback",   sub: "Turning scores into specific, actionable notes…"    },
  { label: "Compiling your report",   sub: "Almost there — putting it all together…"            },
];

function DebriefLoadingScreen() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      // Fade out, advance, fade in
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % DEBRIEF_MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(cycle);
  }, []);

  const msg = DEBRIEF_MESSAGES[idx];

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-8 text-white z-50 px-6">
      {/* Spinner */}
      <div className="w-12 h-12 border-4 border-gray-700 border-t-white rounded-full animate-spin" />

      {/* Cycling message */}
      <div
        className="text-center space-y-2 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-lg font-semibold tracking-tight">{msg.label}</p>
        <p className="text-sm text-gray-400 max-w-xs">{msg.sub}</p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {DEBRIEF_MESSAGES.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
            style={{ background: i === idx ? "#ffffff" : "#374151" }}
          />
        ))}
      </div>
    </div>
  );
}

export default function InterviewRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { speak, cancel: cancelTTS, isSpeaking } = useTTS();
  const {
    start: startSTT,
    stop: stopSTT,
    reset: resetSTT,
    transcript,
    interimTranscript,
    isListening,
    isSupported: sttSupported,
    hasNetworkError: sttNetworkError,
  } = useSTT();

  const { startRecording, stopRecording, discardRecording, isRecording } = useAudioRecorder();

  const [roomState, setRoomState] = useState<RoomState>("init");
  const [current, setCurrent] = useState<QuestionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState("");
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null);
  // Allow submit after 2.5s in listening state even if STT shows nothing (STT can be inaccurate)
  const [hasListenedLong, setHasListenedLong] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [tmaySubmitting, setTmaySubmitting] = useState(false);
  // Instrumentation: answer duration (#10) and candidate question rate (#11)
  const answerStartTimeRef = useRef<number | null>(null);
  const [candidateQuestions, setCandidateQuestions] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Listening timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (roomState !== "listening") {
      setHasListenedLong(false);
      return;
    }
    const t = setTimeout(() => setHasListenedLong(true), 2500);
    return () => clearTimeout(t);
  }, [roomState]);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {/* not critical */});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  // ── Camera ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraAllowed(true);
      })
      .catch(() => { if (mounted) setCameraAllowed(false); });
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── STT safety net ───────────────────────────────────────────────────────────
  // Primary STT start happens via explicit startSTT() calls in fetchNextQuestion,
  // handleRetry, handleRespeak, and TMAY init. This effect is a secondary safety
  // net that restarts STT if it drops mid-listening (e.g. Android no-speech timeout).
  useEffect(() => {
    if ((roomState === "listening" || roomState === "tmay") && sttSupported && !isListening && !isSpeaking && !sttNetworkError) {
      startSTT();
    }
  }, [roomState, sttSupported, isListening, isSpeaking, sttNetworkError, startSTT]);

  // ── Fetch question → speak → listen ─────────────────────────────────────────
  const fetchNextQuestion = useCallback(async () => {
    setRoomState("loading-question");
    setError(null);
    resetSTT();
    setFallbackText("");

    try {
      const res = await fetch("/api/interview/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load question");

      if (data.done) {
        // Flush candidate_questions_asked before generating debrief (#11)
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidate_questions_asked: candidateQuestions }),
        }).catch(() => {/* non-fatal */});

        setRoomState("generating-debrief");
        const dr = await fetch("/api/interview/debrief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const dd = await dr.json();
        if (!dr.ok) throw new Error(dd.error ?? "Failed to generate debrief");
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        router.push(`/debrief/${sessionId}`);
        return;
      }

      const q: QuestionState = {
        questionId: data.questionId,
        question: data.question,
        questionNumber: data.questionNumber,
        total: data.total,
      };
      setCurrent(q);
      setRoomState("speaking");
      await speak(q.question);
      setRoomState("listening");
      answerStartTimeRef.current = Date.now();
      startSTT();
      await startRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRoomState("listening");
      startSTT();
      await startRecording();
    }
  }, [sessionId, router, speak, resetSTT, startSTT, startRecording]);

  // Load session on mount — show TMAY step if no background, else load first question
  useEffect(() => {
    let cancelled = false;
    async function initRoom() {
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();
        if (cancelled) return;
        const s: SessionInfo = data.session;
        setSessionInfo(s);
        if (!s.background) {
          setRoomState("tmay");
          await speak("Before we begin, tell me a bit about yourself — your current role, key experience, and what you're looking to achieve.");
          if (cancelled) return;
          startSTT();
          await startRecording();
        } else {
          fetchNextQuestion();
        }
      } catch {
        if (!cancelled) fetchNextQuestion();
      }
    }
    initRoom();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!current) return;

    cancelTTS();
    stopSTT();

    // Compute answer duration (#10)
    const answerDurationSec =
      answerStartTimeRef.current !== null
        ? Math.round((Date.now() - answerStartTimeRef.current) / 100) / 10
        : null;
    answerStartTimeRef.current = null;

    // Capture STT values before async operations clear them
    const sttFallback = (transcript + interimTranscript).trim();

    // Stop recording and collect audio
    const audioBlob = await stopRecording();

    setRoomState("submitting");
    setError(null);

    let answerText = "";

    if (sttSupported) {
      // Try Whisper for accurate transcription, fall back to STT transcript
      if (audioBlob.size > 0) {
        try {
          const fd = new FormData();
          const ext = audioBlob.type.includes("ogg") ? "ogg" : "webm";
          fd.append("audio", audioBlob, `recording.${ext}`);
          if (sessionInfo) {
            fd.append("prompt", `Interview: ${sessionInfo.role} at ${sessionInfo.company}, ${sessionInfo.round_type} round.`);
          }
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (res.ok) {
            const data = await res.json();
            if (data.text?.trim()) answerText = data.text.trim();
          }
        } catch {
          // Whisper failed — fall through to STT transcript
        }
      }
      if (!answerText) answerText = sttFallback;
    } else {
      answerText = fallbackText.trim();
    }

    if (!answerText) {
      setError("No answer captured. Please speak and try again.");
      setRoomState("listening");
      startSTT();
      await startRecording();
      return;
    }

    // Track candidate questions (#11) — detect if answer ends with "?"
    if (answerText.trimEnd().endsWith("?")) {
      setCandidateQuestions((n) => n + 1);
    }

    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: current.questionId,
          answer: answerText,
          answer_duration_sec: answerDurationSec,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save answer");
      }
      await fetchNextQuestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRoomState("listening");
    }
  }

  // ── TMAY submit ──────────────────────────────────────────────────────────────
  async function handleTmaySubmit() {
    const sttText = (transcript + interimTranscript).trim();
    cancelTTS();
    stopSTT();
    setTmaySubmitting(true);
    setError(null);

    let background = sttText;

    if (sttSupported) {
      const audioBlob = await stopRecording();
      if (audioBlob.size > 0) {
        try {
          const fd = new FormData();
          const ext = audioBlob.type.includes("ogg") ? "ogg" : "webm";
          fd.append("audio", audioBlob, `recording.${ext}`);
          if (sessionInfo) {
            fd.append("prompt", `Interview context: ${sessionInfo.role} at ${sessionInfo.company}. Candidate self-introduction.`);
          }
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (res.ok) {
            const data = await res.json();
            if (data.text?.trim()) background = data.text.trim();
          }
        } catch { /* use STT fallback */ }
      }
      if (!background) background = sttText;
    } else {
      discardRecording();
      background = fallbackText.trim();
    }

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background }),
      });
      setSessionInfo((prev) => prev ? { ...prev, background } : prev);
      resetSTT();
      setFallbackText("");
      fetchNextQuestion();
    } catch {
      setError("Failed to save your intro. Please try again.");
      setTmaySubmitting(false);
      startSTT();
      await startRecording();
    }
  }

  // ── Retry ────────────────────────────────────────────────────────────────────
  async function handleRetry() {
    cancelTTS();
    discardRecording();
    resetSTT();
    setFallbackText("");
    setRoomState("listening");
    startSTT();
    await startRecording();
  }

  // ── Re-speak ─────────────────────────────────────────────────────────────────
  async function handleRespeak() {
    if (!current) return;
    stopSTT();
    discardRecording();
    setRoomState("speaking");
    await speak(current.question);
    setRoomState("listening");
    startSTT();
    await startRecording();
  }

  const progressValue = current
    ? Math.round(((current.questionNumber - 1) / current.total) * 100)
    : 0;

  const canSubmit =
    (roomState === "listening" || roomState === "speaking") &&
    (sttSupported
      ? hasListenedLong || (transcript + interimTranscript).trim().length > 0
      : fallbackText.trim().length > 0);

  // ── TMAY step ─────────────────────────────────────────────────────────────────
  if (roomState === "tmay") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col text-white z-50 select-none">
        <div className="flex-1 flex items-center justify-center relative overflow-hidden px-6">
          <div className="flex flex-col items-center gap-6 text-center max-w-xl w-full">
            <div className="relative flex items-center justify-center w-28 h-28">
              {isSpeaking && (
                <>
                  <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                  <span className="absolute inset-2 rounded-full border border-blue-400/50 animate-ping opacity-20" />
                </>
              )}
              <span className={`text-6xl transition-transform duration-300 ${isSpeaking ? "scale-110" : "scale-100"}`}>
                🤖
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">AI Interviewer</p>
              {isSpeaking ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Speaking
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 text-green-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Your turn
                </span>
              )}
            </div>
            <p className="text-xl leading-relaxed text-white/90 font-light">
              &ldquo;Before we begin, tell me about yourself — your current role, key experience, and what you&apos;re looking to achieve.&rdquo;
            </p>
          </div>

          <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden border border-white/20 bg-gray-800 shadow-2xl">
            {cameraAllowed === false ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xs text-gray-400 text-center px-2">Camera off</span>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            )}
            <span className="absolute bottom-1.5 left-2 text-xs text-white/50 font-medium">You</span>
          </div>
        </div>

        <div className="px-6 pb-3">
          {sttSupported ? (
            <div className="relative rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-14">
              {!isSpeaking && (
                <span className="absolute top-2 right-3 text-xs text-yellow-400/60 uppercase tracking-wider font-mono">
                  Rough Draft
                </span>
              )}
              {(transcript + interimTranscript).trim() ? (
                <p className="text-sm text-white/90 leading-relaxed pr-24">
                  {transcript}
                  {interimTranscript && <span className="text-white/40 italic">{interimTranscript}</span>}
                </p>
              ) : sttNetworkError && !isSpeaking ? (
                <div className="flex items-center gap-3 py-0.5">
                  <span className="flex items-end gap-[3px] h-4 shrink-0">
                    {[40, 80, 55, 90, 45].map((h, i) => (
                      <span key={i} className="w-[3px] rounded-full bg-blue-400/60 animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 130}ms` }} />
                    ))}
                  </span>
                  <span className="text-sm text-white/50">Recording your answer <span className="text-xs text-white/25">— Whisper transcribes on submit</span></span>
                </div>
              ) : (
                <p className="text-sm text-white/25 italic">
                  {!isSpeaking ? "Introduce yourself — your role, experience, and goals…" : ""}
                </p>
              )}
            </div>
          ) : (
            <Textarea
              rows={3}
              placeholder="Tell me about yourself — your role, experience, and what brings you here..."
              value={fallbackText}
              onChange={(e) => setFallbackText(e.target.value)}
              className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-blue-500"
            />
          )}
        </div>

        {error && <p className="text-xs text-red-400 text-center px-6 pb-2">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-y-2 px-6 py-4 border-t border-white/10 bg-black/30">
          <div className="flex items-center gap-2 min-w-24">
            {sttSupported ? (
              isListening ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-300 text-xs font-medium">Listening</span>
                </>
              ) : isRecording ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-300 text-xs font-medium">Recording answer</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                  <span className="text-gray-500 text-xs">Mic off</span>
                </>
              )
            ) : (
              <span className="text-xs text-amber-400">Text mode</span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleTmaySubmit}
            disabled={tmaySubmitting || isSpeaking}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 h-8"
          >
            {tmaySubmitting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : "Continue →"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Debrief loading screen ────────────────────────────────────────────────────
  if (roomState === "generating-debrief") {
    return <DebriefLoadingScreen />;
  }

  // ── Room ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col text-white z-50 select-none">

      {/* Thin progress bar — no numbers, just visual progress */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-10">
        <div
          className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-6">

        {/* AI interviewer */}
        <div className="flex flex-col items-center gap-6 text-center max-w-xl w-full">

          {/* Avatar with pulse when speaking */}
          <div className="relative flex items-center justify-center w-28 h-28">
            {(roomState === "speaking" || isSpeaking) && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                <span className="absolute inset-2 rounded-full border border-blue-400/50 animate-ping opacity-20 animation-delay-150" />
              </>
            )}
            <span
              className={`text-6xl transition-transform duration-300 ${
                isSpeaking ? "scale-110" : "scale-100"
              }`}
            >
              🤖
            </span>
          </div>

          {/* Label + status pill */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
              AI Interviewer
            </p>
            {roomState === "loading-question" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Thinking…
              </span>
            ) : roomState === "speaking" || isSpeaking ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Speaking
              </span>
            ) : roomState === "listening" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 text-green-300 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Your turn
              </span>
            ) : roomState === "submitting" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 text-orange-300 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                Processing
              </span>
            ) : null}
          </div>

          {/* Question text */}
          {roomState === "loading-question" ? (
            <p className="text-gray-500 text-sm animate-pulse">Preparing next question…</p>
          ) : current ? (
            <p className="text-xl leading-relaxed text-white/90 font-light">
              &ldquo;{current.question}&rdquo;
            </p>
          ) : null}
        </div>

        {/* User camera — PiP corner tile */}
        <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden border border-white/20 bg-gray-800 shadow-2xl">
          {cameraAllowed === false ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-gray-400 text-center px-2">Camera off</span>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
          <span className="absolute bottom-1.5 left-2 text-xs text-white/50 font-medium">You</span>
        </div>
      </div>

      {/* ── Transcript / answer ── */}
      <div className="px-6 pb-3">
        {sttSupported ? (
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-14">
            {roomState === "listening" && (
              <span className="absolute top-2 right-3 text-xs text-yellow-400/60 uppercase tracking-wider font-mono">
                Rough Draft
              </span>
            )}
            {(transcript + interimTranscript).trim() ? (
              <p className="text-sm text-white/90 leading-relaxed pr-24">
                {transcript}
                {interimTranscript && (
                  <span className="text-white/40 italic">{interimTranscript}</span>
                )}
              </p>
            ) : sttNetworkError && roomState === "listening" ? (
              <div className="flex items-center gap-3 py-0.5">
                <span className="flex items-end gap-[3px] h-4 shrink-0">
                  {[40, 80, 55, 90, 45].map((h, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-blue-400/60 animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 130}ms` }} />
                  ))}
                </span>
                <span className="text-sm text-white/50">Recording your answer <span className="text-xs text-white/25">— Whisper transcribes on submit</span></span>
              </div>
            ) : (
              <p className="text-sm text-white/25 italic">
                {roomState === "listening"
                  ? "Speak your answer — AI will transcribe accurately on submit…"
                  : "Your answer will appear here."}
              </p>
            )}
          </div>
        ) : (
          <Textarea
            rows={3}
            placeholder="Type your answer here..."
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            disabled={roomState === "submitting"}
            className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-blue-500"
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 text-center px-6 pb-2">{error}</p>
      )}

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-6 py-4 border-t border-white/10 bg-black/30">

        {/* Mic indicator */}
        <div className="flex items-center gap-2 min-w-24">
          {sttSupported ? (
            isListening ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs font-medium">Listening</span>
              </>
            ) : isRecording ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-xs font-medium">Recording answer</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                <span className="text-gray-500 text-xs">Mic off</span>
              </>
            )
          ) : (
            <span className="text-xs text-amber-400">Text mode</span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {current && (roomState === "listening" || roomState === "speaking") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRespeak}
              disabled={isSpeaking}
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8"
            >
              🔊 Replay
            </Button>
          )}

          {roomState === "listening" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8"
            >
              ↩ Retry
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={roomState === "submitting" || !canSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 h-8"
          >
            {roomState === "submitting" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </span>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </div>

      {!sttSupported && (
        <p className="text-xs text-amber-500 text-center pb-3">
          Speech recognition isn&apos;t supported here. Use Chrome or Edge for the full experience.
        </p>
      )}
    </div>
  );
}
