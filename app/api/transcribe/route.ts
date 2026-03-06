import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // Convert Web API File to a format Groq SDK accepts
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = audio.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([buffer], `recording.${ext}`, { type: audio.type || "audio/webm" });

    const transcription = await getClient().audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "en",
      response_format: "json",
    });

    const text = transcription.text?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[POST /api/transcribe]", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
