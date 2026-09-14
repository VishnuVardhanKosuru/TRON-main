import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPassphrase, createSession, SESSION_COOKIE, pruneExpiredSessions } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { passphrase, label } = await req.json();

    if (!verifyPassphrase(String(passphrase ?? ""))) {
      // Small delay keeps brute-forcing over the LAN unattractive.
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
    }

    pruneExpiredSessions();
    const { token, expiresMs } = createSession(String(label ?? "device"));

    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresMs),
      // TRON is usually reached over plain HTTP on the LAN or through a private
      // tunnel that terminates TLS for us, so we do not force the secure flag.
      secure: process.env.TRON_COOKIE_SECURE === "true",
    });

    return NextResponse.json({ ok: true, uid: "owner" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
