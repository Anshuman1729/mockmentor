import { NextRequest, NextResponse } from "next/server";
import { fetchJD } from "@/lib/jd-fetcher";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const content = await fetchJD(url);
    return NextResponse.json({ content });
  } catch (err) {
    console.error("[POST /api/fetch-jd]", err);
    return NextResponse.json(
      { error: "Failed to fetch JD from URL" },
      { status: 422 }
    );
  }
}
