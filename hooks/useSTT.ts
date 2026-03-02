"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function useSTT() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);

  // Current active instance
  const recogRef = useRef<SpeechRecognition | null>(null);
  // Sync ref — never stale in callbacks
  const isListeningRef = useRef(false);
  // The SR class itself, set once on mount
  const SRClassRef = useRef<typeof SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setIsSupported(false); return; }
    setIsSupported(true);
    SRClassRef.current = SR;
    return () => {
      recogRef.current?.abort();
      recogRef.current = null;
    };
  }, []);

  // Creates a fresh instance and wires up event handlers.
  // A new instance is required on every start() because Chrome throws
  // InvalidStateError if you call start() on an instance that was stopped
  // but whose onend hasn't fired yet.
  const makeInstance = useCallback(() => {
    if (!SRClassRef.current) return null;
    const r = new SRClassRef.current();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 1;

    r.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else interimChunk += res[0].transcript;
      }
      if (finalChunk) {
        setTranscript((prev) => prev + finalChunk);
        setInterimTranscript("");
      } else {
        setInterimTranscript(interimChunk);
      }
    };
    r.onstart = () => { isListeningRef.current = true; setIsListening(true); };
    r.onend   = () => { isListeningRef.current = false; setIsListening(false); setInterimTranscript(""); };
    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("STT error:", event.error);
      }
      isListeningRef.current = false;
      setIsListening(false);
    };
    return r;
  }, []);

  const start = useCallback(() => {
    if (!SRClassRef.current || isListeningRef.current) return;
    // Abort the old instance (safe even if already ended)
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch { /* ignore */ }
      recogRef.current = null;
    }
    setTranscript("");
    setInterimTranscript("");
    const r = makeInstance();
    if (!r) return;
    recogRef.current = r;
    try { r.start(); } catch { isListeningRef.current = false; }
  }, [makeInstance]);

  const stop = useCallback(() => {
    if (!recogRef.current || !isListeningRef.current) return;
    try { recogRef.current.stop(); } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch { /* ignore */ }
      recogRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return { start, stop, reset, transcript, interimTranscript, isListening, isSupported };
}
