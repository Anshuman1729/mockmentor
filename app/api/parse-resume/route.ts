import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const MAX_CHARS = 6000;

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);

    if (!text) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[POST /api/parse-resume]", err);
    return NextResponse.json({ error: "Failed to parse resume" }, { status: 500 });
  }
}
