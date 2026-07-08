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

  // Stop any in-progress audio and settle its pending promise so callers
  // awaiting speak() never hang (e.g. when muted mid-utterance).
  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
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

            audio.onended = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              setIsSpeaking(false);
              resolveRef.current = null;
              resolve();
            };

            audio.onerror = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              setIsSpeaking(false);
              resolveRef.current = null;
              reject(new Error("Audio playback failed"));
            };

            audio.play().catch((err) => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
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

  return { speak, cancel, isSpeaking, rate, cycleRate, muted, toggleMute };
}
