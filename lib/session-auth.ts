import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "./db";

export async function assertSessionOwner(sessionId: string): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await currentUser();
  const user_email = user?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.dev`;
  const rows = await sql`SELECT user_email FROM sessions WHERE id = ${sessionId}`;
  if (rows.length === 0 || rows[0].user_email !== user_email) {
    return { ok: false, response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }
  return { ok: true };
}
