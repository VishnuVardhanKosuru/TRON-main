import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE, OWNER_UID } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (!isValidSession(token)) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      uid: OWNER_UID,
      displayName: process.env.TRON_OWNER_NAME || "Owner",
    },
  });
}
