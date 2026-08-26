"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIME_PRIORITY = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function getSupportedMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_PRIORITY.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);

  // Web Audio graph for the voice-orb "listening" visualization — reads real
  // mic amplitude. Never connected to ctx.destination (would echo the mic
  // back through the speakers), only used for analysis.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Request mic permission and cache the stream
  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = audioCtxRef.current ?? new Ctx();
          audioCtxRef.current = ctx;
          if (ctx.state === "suspended") ctx.resume().catch(() => {});
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.6;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch {
        analyserRef.current = null;
      }

      return stream;
    } catch {
      console.warn("[AudioRecorder] mic permission denied");
      return null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    const stream = await ensureStream();
    if (!stream) return;

    chunksRef.current = [];
    const mime = getSupportedMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorderRef.current = recorder;
    recorder.start(250); // collect data every 250ms
    isRecordingRef.current = true;
    setIsRecording(true);
  }, [ensureStream]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        isRecordingRef.current = false;
        setIsRecording(false);
        resolve(new Blob(chunksRef.current));
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        isRecordingRef.current = false;
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  // Discard without resolving — use when retrying or re-speaking
  const discardRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* ignore */ }
    }
    chunksRef.current = [];
    recorderRef.current = null;
    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* ignore */ }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  return { startRecording, stopRecording, discardRecording, isRecording, analyserRef };
}
