"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTTS } from "@/hooks/useTTS";
import { useSTT } from "@/hooks/useSTT";

type RoomState =
  | "init"
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
  } = useSTT();

  const [roomState, setRoomState] = useState<RoomState>("init");
  const [current, setCurrent] = useState<QuestionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState("");
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      if (sttSupported) startSTT();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRoomState("listening");
    }
  }, [sessionId, router, speak, sttSupported, startSTT, resetSTT]);

  // Load first question on mount
  useEffect(() => {
    const t = setTimeout(() => fetchNextQuestion(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!current) return;
    const answerText = sttSupported ? transcript.trim() : fallbackText.trim();
    if (!answerText) return;
    cancelTTS();
    stopSTT();
    setRoomState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: current.questionId, answer: answerText }),
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

  // ── Retry ────────────────────────────────────────────────────────────────────
  function handleRetry() {
    cancelTTS();
    resetSTT();
    setFallbackText("");
    setRoomState("listening");
    if (sttSupported) startSTT();
  }

  // ── Re-speak ─────────────────────────────────────────────────────────────────
  async function handleRespeak() {
    if (!current) return;
    stopSTT();
    setRoomState("speaking");
    await speak(current.question);
    setRoomState("listening");
    if (sttSupported) startSTT();
  }

  const progressValue = current
    ? Math.round(((current.questionNumber - 1) / current.total) * 100)
    : 0;

  const canSubmit =
    (roomState === "listening" || roomState === "speaking") &&
    (sttSupported
      ? (transcript + interimTranscript).trim().length > 0
      : fallbackText.trim().length > 0);

  // ── Debrief loading screen ────────────────────────────────────────────────────
  if (roomState === "generating-debrief") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-5 text-white z-50">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-medium">Generating your debrief…</p>
        <p className="text-gray-400 text-sm">This may take a few seconds.</p>
      </div>
    );
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
        <div className="absolute bottom-4 right-4 w-44 h-32 rounded-2xl overflow-hidden border border-white/20 bg-gray-800 shadow-2xl">
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
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-14">
            {(transcript + interimTranscript).trim() ? (
              <p className="text-sm text-white/90 leading-relaxed">
                {transcript}
                {interimTranscript && (
                  <span className="text-white/40 italic">{interimTranscript}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-white/25 italic">
                {roomState === "listening"
                  ? "Speak your answer — it will appear here…"
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/30">

        {/* Mic indicator */}
        <div className="flex items-center gap-2 min-w-24">
          {sttSupported ? (
            isListening ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs font-medium">Listening</span>
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
