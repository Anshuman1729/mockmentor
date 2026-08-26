"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTTS } from "@/hooks/useTTS";
import { useSTT } from "@/hooks/useSTT";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { VoiceOrb } from "@/components/VoiceOrb";
import DebriefLoadingScreen from "@/components/DebriefLoadingScreen";
import { Mic } from "lucide-react";

type RoomState =
  | "init"
  | "tmay"
  | "loading-question"
  | "speaking"
  | "listening"
  | "submitting"
  | "generating-debrief"
  | "debrief-failed";

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

export default function InterviewRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { speak, cancel: cancelTTS, isSpeaking, rate, cycleRate, muted, toggleMute, analyserRef: ttsAnalyserRef } = useTTS();
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

  const { startRecording, stopRecording, discardRecording, isRecording, analyserRef: micAnalyserRef } = useAudioRecorder();
  const idleAnalyserRef = useRef<AnalyserNode | null>(null);

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

  // ── Debrief generation — isolated from question-fetch so a failure here
  // never gets treated as "submit another answer to retry" (that was the
  // bug: both used to share one catch block, silently landing back in
  // "listening" with no way to retry debrief generation except answering
  // an already-finished interview again). Exposed as its own callback so
  // the debrief-failed screen can call it directly to retry.
  const generateDebrief = useCallback(async () => {
    setRoomState("generating-debrief");
    setError(null);
    try {
      // Flush candidate_questions_asked before generating debrief (#11)
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_questions_asked: candidateQuestions }),
      }).catch(() => {/* non-fatal */});

      const dr = await fetch("/api/interview/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const dd = await dr.json();
      if (!dr.ok) throw new Error(dd.error ?? "Failed to generate debrief");
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      router.push(`/debrief/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate your debrief");
      setRoomState("debrief-failed");
    }
  }, [sessionId, router, candidateQuestions]);

  // ── Fetch question → speak → listen ─────────────────────────────────────────
  const fetchNextQuestion = useCallback(async () => {
    setRoomState("loading-question");
    setError(null);
    resetSTT();
    setFallbackText("");

    let q: QuestionState | null = null;

    try {
      const res = await fetch("/api/interview/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load question");

      if (data.done) {
        await generateDebrief();
        return;
      }

      q = {
        questionId: data.questionId,
        question: data.question,
        questionNumber: data.questionNumber,
        total: data.total,
      };
      setCurrent(q);
    } catch (err) {
      // A real fetch failure — the question genuinely wasn't generated.
      // This is the only path that should treat things as "try again".
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRoomState("listening");
      startSTT();
      await startRecording();
      return;
    }

    // The question is loaded and already visible on screen at this point.
    // Speaking it is a separate concern — if TTS fails (bad audio, network,
    // provider hiccup) that must NOT look like "no question was generated":
    // don't refetch, just surface a message and let the user read it or hit
    // 🔊 Replay to retry the audio.
    setRoomState("speaking");
    try {
      await speak(q.question);
    } catch (speakErr) {
      console.error("[TTS] speak failed:", speakErr);
      setError("Voice playback failed — read the question below, or tap 🔊 Replay to try again.");
    }
    setRoomState("listening");
    answerStartTimeRef.current = Date.now();
    startSTT();
    await startRecording();
  }, [sessionId, speak, resetSTT, startSTT, startRecording, generateDebrief]);

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
          // A TTS failure here must stay a TMAY-step problem, not escape to
          // the outer catch below — that catch is for session-load failures
          // and calls fetchNextQuestion(), which would silently skip the
          // TMAY step (and lose the background-collection step) instead of
          // just failing to voice the intro prompt.
          try {
            await speak("Before we begin, tell me a bit about yourself — your current role, key experience, and what you're looking to achieve.");
          } catch (speakErr) {
            console.error("[TTS] speak failed on TMAY intro:", speakErr);
            if (!cancelled) setError("Voice playback failed — read the prompt below, then answer when ready.");
          }
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

    if (!answerText || answerText.trim().length < 50) {
      setError("Try giving a bit more detail — even a couple of sentences helps us score this fairly.");
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
    // Same reasoning as fetchNextQuestion: a TTS failure here must not leave
    // the room stuck on "speaking" forever — always fall through to
    // listening so the user isn't stranded with a frozen UI and no recovery.
    try {
      await speak(current.question);
    } catch (speakErr) {
      console.error("[TTS] speak failed on replay:", speakErr);
      setError("Voice playback failed — read the question below, or tap 🔊 Replay to try again.");
    }
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
        <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4 sm:px-6">
          <div className="flex flex-col items-center gap-6 text-center max-w-xl w-full">
            <div className="relative flex items-center justify-center w-28 h-28">
              <VoiceOrb
                analyserRef={isSpeaking ? ttsAnalyserRef : micAnalyserRef}
                variant={isSpeaking ? "speaking" : "listening"}
                size={112}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">AI Interviewer</p>
              <div role="status" aria-live="polite">
                {isSpeaking ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
                    Speaking
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 text-green-300 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                    Your turn
                  </span>
                )}
              </div>
            </div>
            <p className="text-xl leading-relaxed text-white/90 font-light">
              &ldquo;Before we begin, tell me about yourself — your current role, key experience, and what you&apos;re looking to achieve.&rdquo;
            </p>
            <p className="text-xs text-white/30 max-w-sm">
              Quick heads up: this is just practice — nothing here affects a real job. Your camera is only for you to see yourself; it&apos;s never recorded or sent anywhere. Only your spoken answers are used to generate your feedback.
            </p>
          </div>

          <div
            className="absolute bottom-4 right-4 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden border border-white/20 bg-gray-800 shadow-2xl"
            aria-hidden="true"
          >
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

        <div className="px-4 sm:px-6 pb-3">
          {sttSupported ? (
            <div className="relative rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-14 flex items-center">
              {!isSpeaking ? (
                <div className="flex items-center gap-3 py-0.5">
                  <span className="flex items-end gap-[3px] h-4 shrink-0" aria-hidden="true">
                    {[40, 80, 55, 90, 45].map((h, i) => (
                      <span key={i} className="w-[3px] rounded-full bg-green-400/60 animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 130}ms` }} />
                    ))}
                  </span>
                  <span className="text-sm text-white/50">Listening — your answer is being captured<span className="text-xs text-white/25"> (transcribed accurately on submit)</span></span>
                </div>
              ) : (
                <p className="text-sm text-white/25 italic">Introduce yourself — your role, experience, and goals…</p>
              )}
            </div>
          ) : (
            <Textarea
              rows={3}
              placeholder="Tell me about yourself — your role, experience, and what brings you here..."
              value={fallbackText}
              onChange={(e) => setFallbackText(e.target.value)}
              aria-label="Tell me about yourself"
              className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-blue-500"
            />
          )}
        </div>

        {error && <p role="alert" className="text-xs text-red-400 text-center px-4 sm:px-6 pb-2">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 sm:px-6 py-4 border-t border-white/10 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-24" role="status" aria-live="polite">
              {sttSupported ? (
                isListening ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                    <span className="text-green-300 text-xs font-medium">Listening</span>
                  </>
                ) : isRecording ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
                    <span className="text-blue-300 text-xs font-medium">Recording answer</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-600" aria-hidden="true" />
                    <span className="text-gray-500 text-xs">Mic off</span>
                  </>
                )
              ) : (
                <span className="text-xs text-amber-400">Text mode</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleRate}
              title="Interviewer voice speed"
              aria-label={`Interviewer voice speed: ${rate}x. Click to change.`}
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8 px-2"
            >
              {rate}x
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              title={muted ? "Unmute interviewer voice" : "Mute interviewer voice"}
              aria-label={muted ? "Unmute interviewer voice" : "Mute interviewer voice"}
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8 px-2"
            >
              {muted ? "🔇" : "🔈"}
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleTmaySubmit}
            disabled={tmaySubmitting || isSpeaking}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 h-[44px] min-w-[100px]"
          >
            {tmaySubmitting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
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

  // ── Debrief failed — dedicated retry, not "answer another question" ──────────
  if (roomState === "debrief-failed") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-6 text-white z-50 px-4 sm:px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center" aria-hidden="true">
          <span className="text-2xl">⚠️</span>
        </div>
        <div className="space-y-2 max-w-sm" role="alert">
          <p className="text-lg font-semibold tracking-tight">Couldn&apos;t generate your debrief</p>
          <p className="text-sm text-gray-400">
            {error ?? "Something went wrong while putting your report together."}
          </p>
        </div>
        <Button
          onClick={generateDebrief}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-[44px] min-w-[140px]"
        >
          Try again
        </Button>
      </div>
    );
  }

  // ── Room ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex flex-col text-white z-50 select-none">
      {/* Responsive top header — visible on all viewports */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{sessionInfo?.role ?? "Mock Interview"}</p>
            <p className="text-[11px] text-gray-400 truncate">{sessionInfo?.company ?? ""} · {sessionInfo?.round_type ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-white/10">{current?.questionNumber ?? 0}/{current?.total ?? 0}</span>
        </div>
      </header>

      {/* Thin progress bar — visual only */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-10"
        role="progressbar"
        aria-label="Interview progress"
        aria-valuenow={progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4 sm:px-6">

        {/* AI interviewer */}
        <div className="flex flex-col items-center gap-6 text-center max-w-xl w-full">

          {/* Voice orb — audio-reactive: TTS output while speaking, mic input while listening */}
          <div className="relative flex items-center justify-center w-28 h-28">
            <VoiceOrb
              analyserRef={
                roomState === "speaking" || isSpeaking
                  ? ttsAnalyserRef
                  : roomState === "listening"
                  ? micAnalyserRef
                  : idleAnalyserRef
              }
              variant={
                roomState === "speaking" || isSpeaking
                  ? "speaking"
                  : roomState === "listening"
                  ? "listening"
                  : "idle"
              }
              size={112}
            />
          </div>

          {/* Label + status pill */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
              AI Interviewer
            </p>
            <div role="status" aria-live="polite">
              {roomState === "loading-question" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
                  Thinking…
                </span>
              ) : roomState === "speaking" || isSpeaking ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
                  Speaking
                </span>
              ) : roomState === "listening" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 text-green-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                  Your turn
                </span>
              ) : roomState === "submitting" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 text-orange-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" aria-hidden="true" />
                  Processing
                </span>
              ) : null}
            </div>
          </div>

          {/* Question text */}
          <div aria-live="polite">
            {roomState === "loading-question" ? (
              <p className="text-gray-500 text-sm animate-pulse">Preparing next question…</p>
            ) : current ? (
              <p className="text-xl leading-relaxed text-white/90 font-light">
                &ldquo;{current.question}&rdquo;
              </p>
            ) : null}
          </div>
        </div>

        {/* User camera — PiP corner tile (self-view only, no unique info for screen readers) */}
        <div
          className="absolute bottom-4 right-4 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden border border-white/20 bg-gray-800 shadow-2xl"
          aria-hidden="true"
        >
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
      <div className="px-4 sm:px-6 pb-3">
        {sttSupported ? (
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-14 flex items-center">
            {roomState === "listening" ? (
              <div className="flex items-center gap-3 py-0.5">
                <span className="flex items-end gap-[3px] h-4 shrink-0" aria-hidden="true">
                  {[40, 80, 55, 90, 45].map((h, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-green-400/60 animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 130}ms` }} />
                  ))}
                </span>
                <span className="text-sm text-white/50">Listening — your answer is being captured<span className="text-xs text-white/25"> (transcribed accurately on submit)</span></span>
              </div>
            ) : (
              <p className="text-sm text-white/25 italic">Your answer will appear here.</p>
            )}
          </div>
        ) : (
          <Textarea
            rows={3}
            placeholder="Type your answer here..."
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            disabled={roomState === "submitting"}
            aria-label="Your answer"
            className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-blue-500"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400 text-center px-4 sm:px-6 pb-2">{error}</p>
      )}

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 sm:px-6 py-4 border-t border-white/10 bg-black/30">

        {/* Mic indicator + interviewer voice controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-24" role="status" aria-live="polite">
            {sttSupported ? (
              isListening ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                  <span className="text-green-300 text-xs font-medium">Listening</span>
                </>
              ) : isRecording ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
                  <span className="text-blue-300 text-xs font-medium">Recording answer</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-600" aria-hidden="true" />
                  <span className="text-gray-500 text-xs">Mic off</span>
                </>
              )
            ) : (
              <span className="text-xs text-amber-400">Text mode</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleRate}
            title="Interviewer voice speed"
            aria-label={`Interviewer voice speed: ${rate}x. Click to change.`}
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8 px-2"
          >
            {rate}x
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            title={muted ? "Unmute interviewer voice" : "Mute interviewer voice"}
            aria-label={muted ? "Unmute interviewer voice" : "Mute interviewer voice"}
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8 px-2"
          >
            {muted ? "🔇" : "🔈"}
          </Button>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {current && (roomState === "listening" || roomState === "speaking") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRespeak}
              disabled={isSpeaking}
              aria-label="Replay the question audio"
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8"
            >
              <span aria-hidden="true">🔊</span> Replay
            </Button>
          )}

          {roomState === "listening" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              aria-label="Retry — re-record your answer"
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs h-8"
            >
              <span aria-hidden="true">↩</span> Retry
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={roomState === "submitting" || !canSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 h-[44px] min-w-[100px]"
          >
            {roomState === "submitting" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
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
