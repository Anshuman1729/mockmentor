import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

const MAX_CHARS = 6000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — resumes are a few hundred KB at most

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const cleaned = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);

    if (!cleaned) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    return NextResponse.json({ text: cleaned });
  } catch (err) {
    console.error("[POST /api/parse-resume]", err);
    return NextResponse.json({ error: "Failed to parse resume" }, { status: 500 });
  }
}
