import { NextRequest, NextResponse } from "next/server";

// Sarvam AI TTS proxy — bulbul:v2, English-India
// Voice: "arvind" — clear professional male voice
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SARVAM_API_KEY is not set" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        target_language_code: "en-IN",
        speaker: "karun",
        pace: 1.0,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v2",
        output_audio_codec: "mp3",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[TTS] Sarvam error:", err);
      return NextResponse.json(
        { error: `Sarvam error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Sarvam returns audios as array of base64-encoded audio strings
    const audioBase64 = data.audios?.[0];
    if (!audioBase64) {
      return NextResponse.json({ error: "No audio returned" }, { status: 500 });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    return new NextResponse(audioBuffer, {
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
