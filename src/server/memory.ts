/**
 * TRON — explicit personal memory.
 *
 * V1 rule: TRON never decides on its own what to remember. Something is stored
 * only when you say "TRON, remember ..." and removed only when you say
 * "TRON, forget ...". Automatic memory is a V2 problem.
 */

import { randomUUID } from "node:crypto";
import { getDriver } from "./sqlite";

export interface MemoryRow {
  id: string;
  subject: string;
  content: string;
  createdMs: number;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "my", "me", "is", "are", "that", "to", "of", "in",
  "on", "for", "and", "i", "it", "about", "with",
]);

/** Normalised keywords used to look a memory back up later. */
export function subjectKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .join(" ")
    .trim();
}

function toRow(r: Record<string, unknown>): MemoryRow {
  return {
    id: String(r.id),
    subject: String(r.subject),
    content: String(r.content),
    createdMs: Number(r.created_ms),
  };
}

export function rememberFact(content: string): MemoryRow {
  const clean = content.trim();
  const row: MemoryRow = {
    id: randomUUID(),
    subject: subjectKey(clean),
    content: clean,
    createdMs: Date.now(),
  };
  getDriver()
    .prepare(`INSERT INTO memories (id, subject, content, created_ms) VALUES (?, ?, ?, ?)`)
    .run(row.id, row.subject, row.content, row.createdMs);
  return row;
}

export function listMemories(limit = 200): MemoryRow[] {
  return getDriver()
    .prepare(`SELECT * FROM memories ORDER BY created_ms DESC LIMIT ?`)
    .all(limit)
    .map(toRow);
}

/** Word-overlap search. Small data, no embeddings needed — and none wanted in V1. */
export function searchMemories(queryText: string, limit = 10): MemoryRow[] {
  const terms = subjectKey(queryText).split(/\s+/).filter(Boolean);
  const all = listMemories(500);
  if (terms.length === 0) return all.slice(0, limit);

  const scored = all
    .map((m) => {
      const haystack = `${m.subject} ${m.content.toLowerCase()}`;
      const score = terms.reduce((acc, t) => (haystack.includes(t) ? acc + 1 : acc), 0);
      return { m, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.m.createdMs - a.m.createdMs);

  return scored.slice(0, limit).map((s) => s.m);
}

export function forgetMatching(queryText: string): MemoryRow[] {
  const hits = searchMemories(queryText, 50);
  if (hits.length === 0) return [];
  const d = getDriver();
  for (const h of hits) d.prepare(`DELETE FROM memories WHERE id = ?`).run(h.id);
  return hits;
}

export function forgetById(id: string): boolean {
  const existing = getDriver().prepare(`SELECT id FROM memories WHERE id = ?`).get(id);
  if (!existing) return false;
  getDriver().prepare(`DELETE FROM memories WHERE id = ?`).run(id);
  return true;
}

export function clearAllMemories(): number {
  const row = getDriver().prepare(`SELECT COUNT(*) AS n FROM memories`).get();
  const n = Number(row?.n ?? 0);
  getDriver().prepare(`DELETE FROM memories`).run();
  return n;
}
