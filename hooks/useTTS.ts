"use client";

import { useCallback, useRef, useState } from "react";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve, reject) => {
        // Stop any in-progress audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
        setIsSpeaking(true);

        fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
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
              resolve();
            };

            audio.onerror = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              setIsSpeaking(false);
              reject(new Error("Audio playback failed"));
            };

            audio.play().catch((err) => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              setIsSpeaking(false);
              reject(err);
            });
          })
          .catch((err) => {
            setIsSpeaking(false);
            reject(err);
          });
      }),
    []
  );

  return { speak, cancel, isSpeaking };
}
