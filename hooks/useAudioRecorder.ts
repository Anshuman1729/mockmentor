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

  // Request mic permission and cache the stream
  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
    };
  }, []);

  return { startRecording, stopRecording, discardRecording, isRecording };
}
