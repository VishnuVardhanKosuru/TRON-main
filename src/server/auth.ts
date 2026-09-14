/**
 * TRON — single-user authentication.
 *
 * No Firebase, no OAuth, no third party. One owner, one passphrase, one cookie.
 * The passphrase never leaves the Redmi: it is compared against a scrypt hash
 * derived from TRON_PASSPHRASE in .env.local.
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { getDriver } from "./sqlite";

export const OWNER_UID = "owner";
export const SESSION_COOKIE = "tron_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days — this is your own phone

function passphrase(): string {
  const p = process.env.TRON_PASSPHRASE;
  if (!p || !p.trim()) {
    throw new Error(
      "TRON_PASSPHRASE is not set. Add it to .env.local before starting TRON."
    );
  }
  return p.trim();
}

/** Constant-time comparison of the supplied passphrase against the configured one. */
export function verifyPassphrase(supplied: string): boolean {
  let expected: string;
  try {
    expected = passphrase();
  } catch {
    return false;
  }
  const salt = createHash("sha256").update("tron-v1-salt").digest();
  const a = scryptSync(supplied ?? "", salt, 32);
  const b = scryptSync(expected, salt, 32);
  return timingSafeEqual(a, b);
}

export function createSession(label = "device"): { token: string; expiresMs: number } {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresMs = now + SESSION_TTL_MS;
  getDriver()
    .prepare(`INSERT INTO sessions (token, label, created_ms, expires_ms) VALUES (?, ?, ?, ?)`)
    .run(token, label, now, expiresMs);
  return { token, expiresMs };
}

export function isValidSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const row = getDriver()
    .prepare(`SELECT expires_ms FROM sessions WHERE token = ?`)
    .get(token);
  if (!row) return false;
  if (Number(row.expires_ms) < Date.now()) {
    destroySession(token);
    return false;
  }
  return true;
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  getDriver().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function pruneExpiredSessions(): void {
  getDriver().prepare(`DELETE FROM sessions WHERE expires_ms < ?`).run(Date.now());
}
