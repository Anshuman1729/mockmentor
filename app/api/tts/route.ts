import { NextRequest, NextResponse } from "next/server";

// Sarvam AI TTS proxy — bulbul:v3 via the HTTP Streaming endpoint
// (/text-to-speech/stream), which returns raw binary audio as soon as the
// first chunk is ready instead of waiting for the whole clip and wrapping it
// in a base64 JSON envelope (that's the older, non-streaming /text-to-speech
// endpoint's shape). Voice: "shubh" — the documented bulbul:v3 default;
// the previous "karun" (v2) speaker's v3 compatibility isn't confirmed, so
// this deliberately uses the value Sarvam's own v3 examples use.
export async function POST(req: NextRequest) {
  try {
    const { text, pace } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Clamp to a safe range regardless of what the client sends — UI only
    // exposes 0.75x-1.5x, this is defense in depth. Also bulbul:v3's
    // documented pace range (0.5-2.0) is tighter than v2's (0.3-3.0).
    const requestedPace = typeof pace === "number" && Number.isFinite(pace) ? pace : 1.0;
    const clampedPace = Math.min(2.0, Math.max(0.5, requestedPace));

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SARVAM_API_KEY is not set" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.sarvam.ai/text-to-speech/stream", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language_code: "en-IN",
        speaker: "shubh",
        pace: clampedPace,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v3",
        output_audio_codec: "mp3",
      }),
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => "");
      console.error("[TTS] Sarvam error:", response.status, err);
      return NextResponse.json(
        { error: `Sarvam error: ${response.status}` },
        { status: response.status || 502 }
      );
    }

    // The streaming endpoint's response body IS the audio — pass it straight
    // through rather than buffering it into a Buffer first, so the client
    // starts receiving bytes as soon as we do.
    return new NextResponse(response.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    console.error("[TTS] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed" },
      { status: 500 }
    );
  }
}
