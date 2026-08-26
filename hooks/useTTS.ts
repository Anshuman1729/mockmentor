"use client";

import { useCallback, useRef, useState } from "react";

const RATE_STORAGE_KEY = "prepsignals_tts_rate";
const MUTED_STORAGE_KEY = "prepsignals_tts_muted";
const RATE_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

function readStoredRate(): number {
  if (typeof window === "undefined") return 1;
  const raw = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
  return (RATE_OPTIONS as readonly number[]).includes(raw) ? raw : 1;
}

function readStoredMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTED_STORAGE_KEY) === "1";
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rate, setRateState] = useState<number>(readStoredRate);
  const [muted, setMutedState] = useState<boolean>(readStoredMuted);

  const rateRef = useRef(rate);
  const mutedRef = useRef(muted);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  // Web Audio graph for the voice-orb visualization — one AudioContext reused
  // across every speak() call, since browsers cap how many can be open at once.
  // A fresh AnalyserNode is wired up per utterance (createMediaElementSource
  // can only be called once per <audio> element, and speak() creates a new
  // element every call anyway).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    return audioCtxRef.current;
  }

  // Stop any in-progress audio and settle its pending promise so callers
  // awaiting speak() never hang (e.g. when muted mid-utterance).
  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    analyserRef.current = null;
    setIsSpeaking(false);
    if (resolveRef.current) {
      const resolve = resolveRef.current;
      resolveRef.current = null;
      resolve();
    }
  }, []);

  const cancel = useCallback(() => {
    stopPlayback();
  }, [stopPlayback]);

  const cycleRate = useCallback(() => {
    const i = RATE_OPTIONS.indexOf(rateRef.current as (typeof RATE_OPTIONS)[number]);
    const next = RATE_OPTIONS[(i + 1) % RATE_OPTIONS.length];
    rateRef.current = next;
    setRateState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(next));
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMutedState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTED_STORAGE_KEY, next ? "1" : "0");
    }
    if (next) stopPlayback(); // muting mid-utterance ends it immediately
  }, [stopPlayback]);

  const speak = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve, reject) => {
        stopPlayback(); // stop any prior in-progress audio first

        if (mutedRef.current) {
          setIsSpeaking(false);
          resolve();
          return;
        }

        setIsSpeaking(true);
        resolveRef.current = resolve;

        fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, pace: rateRef.current }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`TTS request failed (${res.status})`);
            return res.blob();
          })
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;

            // Wire this utterance into the analyser graph for the voice orb.
            // Best-effort — if Web Audio isn't available, orb just falls back
            // to its idle animation. Must route through to destination or the
            // element's own playback goes silent once tapped into the graph.
            try {
              const ctx = getAudioContext();
              if (ctx) {
                const source = ctx.createMediaElementSource(audio);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.7;
                source.connect(analyser);
                analyser.connect(ctx.destination);
                analyserRef.current = analyser;
              }
            } catch {
              analyserRef.current = null;
            }

            audio.onended = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              analyserRef.current = null;
              setIsSpeaking(false);
              resolveRef.current = null;
              resolve();
            };

            audio.onerror = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              analyserRef.current = null;
              setIsSpeaking(false);
              resolveRef.current = null;
              reject(new Error("Audio playback failed"));
            };

            audio.play().catch((err) => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              analyserRef.current = null;
              setIsSpeaking(false);
              resolveRef.current = null;
              reject(err);
            });
          })
          .catch((err) => {
            setIsSpeaking(false);
            resolveRef.current = null;
            reject(err);
          });
      }),
    [stopPlayback]
  );

  return { speak, cancel, isSpeaking, rate, cycleRate, muted, toggleMute, analyserRef };
}
