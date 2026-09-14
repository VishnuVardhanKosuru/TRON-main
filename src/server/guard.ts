import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE, OWNER_UID } from "./auth";

/**
 * Every data route goes through this. Returns the owner uid, or null when the
 * caller has no valid session cookie.
 */
export async function requireOwner(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return isValidSession(token) ? OWNER_UID : null;
}

/**
 * TRON is single-user: every document path must live under this owner's tree.
 * This stops a stray client path from reaching anything it shouldn't.
 */
export function assertOwnedPath(path: string, uid: string): string {
  const clean = String(path || "").replace(/^\/+|\/+$/g, "");
  if (!clean.startsWith(`users/${uid}/`) && clean !== `users/${uid}`) {
    throw new Error(`Path outside owner scope: ${clean}`);
  }
  if (clean.includes("..")) throw new Error("Invalid path");
  return clean;
}
