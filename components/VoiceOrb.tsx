"use client";

import { useEffect, useRef } from "react";

type OrbVariant = "speaking" | "listening" | "idle";

interface VoiceOrbProps {
  // A ref, not a value — read fresh on every animation frame so the orb
  // picks up a newly-created AnalyserNode (e.g. once a TTS request resolves)
  // without needing a React re-render to hand it a new prop value.
  analyserRef: React.RefObject<AnalyserNode | null>;
  variant: OrbVariant;
  size?: number;
}

const COLORS: Record<OrbVariant, { core: string; rgb: string }> = {
  speaking: { core: "#60a5fa", rgb: "59,130,246" },
  listening: { core: "#4ade80", rgb: "34,197,94" },
  idle: { core: "#9ca3af", rgb: "107,114,128" },
};

export function VoiceOrb({ analyserRef, variant, size = 112 }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx2d.scale(dpr, dpr);

    const center = size / 2;
    const colors = COLORS[variant];

    function draw() {
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, size, size);

      let amplitude: number;
      const analyser = analyserRef.current;
      if (analyser) {
        if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
          dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        }
        analyser.getByteFrequencyData(dataRef.current);
        let sum = 0;
        for (let i = 0; i < dataRef.current.length; i++) sum += dataRef.current[i];
        amplitude = Math.max(0.1, sum / dataRef.current.length / 255);
      } else {
        // No live audio yet (idle, or graph not wired) — gentle synthetic
        // breathing so the orb never looks frozen/dead.
        phaseRef.current += 0.025;
        amplitude = 0.14 + Math.sin(phaseRef.current) * 0.04;
      }

      const baseRadius = center * 0.4;
      const pulseRadius = baseRadius + amplitude * center * 0.55;

      for (let i = 3; i >= 1; i--) {
        const r = pulseRadius + i * 7;
        ctx2d.beginPath();
        ctx2d.arc(center, center, r, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(${colors.rgb},${0.05 * i})`;
        ctx2d.fill();
      }

      const grad = ctx2d.createRadialGradient(center, center, 0, center, center, pulseRadius);
      grad.addColorStop(0, colors.core);
      grad.addColorStop(1, `rgba(${colors.rgb},0.4)`);
      ctx2d.beginPath();
      ctx2d.arc(center, center, pulseRadius, 0, Math.PI * 2);
      ctx2d.fillStyle = grad;
      ctx2d.fill();

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-full"
      aria-hidden="true"
    />
  );
}
