/**
 * TRON — document store.
 *
 * A tiny schemaless document layer on top of SQLite. It keeps the same shape the
 * app already used (collection path + document id + JSON body), so every screen
 * in the UI keeps working without being rewritten.
 *
 * Timestamps are stored inside the JSON body as { "__ts": <millis> }.
 */

import { randomUUID } from "node:crypto";
import { getDriver, bumpRevision } from "./sqlite";

export type Json = Record<string, unknown>;

export interface StoredDoc {
  id: string;
  path: string;
  data: Json;
  createdMs: number;
  updatedMs: number;
}

export interface Filter {
  field: string;
  op: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in" | "array-contains";
  value: unknown;
}

export interface QuerySpec {
  path: string;
  filters?: Filter[];
  orderBy?: { field: string; dir: "asc" | "desc" };
  limit?: number;
}

// ── Sentinel resolution ───────────────────────────────────────────────────────
// The client sends sentinels rather than computed values so behaviour matches
// what the UI used to get from the server.

function resolveSentinels(value: unknown, existing: unknown): unknown {
  if (value === null || typeof value !== "object") return value;

  const v = value as Json;

  if (v.__sentinel === "serverTimestamp") return { __ts: Date.now() };

  if (v.__sentinel === "increment") {
    const by = Number(v.by ?? 0);
    const base = typeof existing === "number" ? existing : 0;
    return base + by;
  }

  if (v.__sentinel === "arrayUnion") {
    const add = Array.isArray(v.elements) ? v.elements : [];
    const base = Array.isArray(existing) ? [...existing] : [];
    for (const el of add) {
      if (!base.some((b) => JSON.stringify(b) === JSON.stringify(el))) base.push(el);
    }
    return base;
  }

  if (v.__sentinel === "arrayRemove") {
    const drop = Array.isArray(v.elements) ? v.elements : [];
    const base = Array.isArray(existing) ? [...existing] : [];
    return base.filter((b) => !drop.some((d) => JSON.stringify(d) === JSON.stringify(b)));
  }

  if (v.__sentinel === "deleteField") return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => resolveSentinels(item, undefined));
  }

  const out: Json = {};
  for (const [k, val] of Object.entries(v)) {
    const resolved = resolveSentinels(val, (existing as Json | undefined)?.[k]);
    if (resolved !== undefined) out[k] = resolved;
  }
  return out;
}

/** Apply a flat patch that may contain dotted field paths ("completionLog.2026-09-14"). */
function applyPatch(base: Json, patch: Json): Json {
  const next: Json = JSON.parse(JSON.stringify(base));

  for (const [rawKey, rawVal] of Object.entries(patch)) {
    const segments = rawKey.split(".");
    let cursor: Json = next;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (typeof cursor[seg] !== "object" || cursor[seg] === null || Array.isArray(cursor[seg])) {
        cursor[seg] = {};
      }
      cursor = cursor[seg] as Json;
    }
    const leaf = segments[segments.length - 1];
    const resolved = resolveSentinels(rawVal, cursor[leaf]);
    if (resolved === undefined) delete cursor[leaf];
    else cursor[leaf] = resolved;
  }

  return next;
}

// ── Value comparison for filters/order ────────────────────────────────────────

function comparable(v: unknown): number | string | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const ts = (v as Json).__ts;
    if (typeof ts === "number") return ts;
    return JSON.stringify(v);
  }
  if (typeof v === "boolean") return v;
  return v as number | string;
}

function matches(doc: Json, f: Filter): boolean {
  const raw = f.field.split(".").reduce<unknown>(
    (acc, seg) => (acc && typeof acc === "object" ? (acc as Json)[seg] : undefined),
    doc
  );
  const left = comparable(raw);
  const right = comparable(f.value);

  switch (f.op) {
    case "==":  return JSON.stringify(left) === JSON.stringify(right);
    case "!=":  return JSON.stringify(left) !== JSON.stringify(right);
    case "<":   return left !== null && right !== null && left < right;
    case "<=":  return left !== null && right !== null && left <= right;
    case ">":   return left !== null && right !== null && left > right;
    case ">=":  return left !== null && right !== null && left >= right;
    case "in":
      return Array.isArray(f.value) && f.value.some((x) => JSON.stringify(comparable(x)) === JSON.stringify(left));
    case "not-in":
      return Array.isArray(f.value) && !f.value.some((x) => JSON.stringify(comparable(x)) === JSON.stringify(left));
    case "array-contains":
      return Array.isArray(raw) && raw.some((x) => JSON.stringify(comparable(x)) === JSON.stringify(right));
    default:
      return true;
  }
}

// ── Row helpers ───────────────────────────────────────────────────────────────

function toDoc(row: Record<string, unknown>): StoredDoc {
  return {
    id: String(row.id),
    path: String(row.path),
    data: JSON.parse(String(row.data)) as Json,
    createdMs: Number(row.created_ms),
    updatedMs: Number(row.updated_ms),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listCollection(spec: QuerySpec): StoredDoc[] {
  const rows = getDriver()
    .prepare(`SELECT * FROM docs WHERE path = ? ORDER BY created_ms ASC`)
    .all(spec.path);

  let docs = rows.map(toDoc);

  if (spec.filters?.length) {
    docs = docs.filter((d) => spec.filters!.every((f) => matches(d.data, f)));
  }

  if (spec.orderBy) {
    const { field, dir } = spec.orderBy;
    docs.sort((a, b) => {
      const av = comparable(a.data[field]);
      const bv = comparable(b.data[field]);
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const res = av < bv ? -1 : 1;
      return dir === "desc" ? -res : res;
    });
  }

  if (typeof spec.limit === "number" && spec.limit >= 0) {
    docs = docs.slice(0, spec.limit);
  }

  return docs;
}

export function getDocument(path: string, id: string): StoredDoc | null {
  const row = getDriver()
    .prepare(`SELECT * FROM docs WHERE path = ? AND id = ?`)
    .get(path, id);
  return row ? toDoc(row) : null;
}

export function addDocument(path: string, data: Json): StoredDoc {
  const id = randomUUID();
  return setDocument(path, id, data, false);
}

export function setDocument(path: string, id: string, data: Json, merge = false): StoredDoc {
  const now = Date.now();
  const existing = getDocument(path, id);

  const body = merge && existing
    ? applyPatch(existing.data, data)
    : (resolveSentinels(data, existing?.data) as Json);

  const createdMs = existing?.createdMs ?? now;

  getDriver()
    .prepare(
      `INSERT INTO docs (id, path, data, created_ms, updated_ms)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_ms = excluded.updated_ms`
    )
    .run(id, path, JSON.stringify(body), createdMs, now);

  bumpRevision(path);
  return { id, path, data: body, createdMs, updatedMs: now };
}

export function updateDocument(path: string, id: string, patch: Json): StoredDoc {
  const existing = getDocument(path, id);
  if (!existing) throw new Error(`No document at ${path}/${id}`);
  const body = applyPatch(existing.data, patch);
  const now = Date.now();

  getDriver()
    .prepare(`UPDATE docs SET data = ?, updated_ms = ? WHERE id = ? AND path = ?`)
    .run(JSON.stringify(body), now, id, path);

  bumpRevision(path);
  return { ...existing, data: body, updatedMs: now };
}

export function deleteDocument(path: string, id: string): void {
  getDriver().prepare(`DELETE FROM docs WHERE path = ? AND id = ?`).run(path, id);
  bumpRevision(path);
}

export function purgeCollections(paths: string[]): number {
  const d = getDriver();
  let count = 0;
  for (const p of paths) {
    const row = d.prepare(`SELECT COUNT(*) AS n FROM docs WHERE path = ?`).get(p);
    count += Number(row?.n ?? 0);
    d.prepare(`DELETE FROM docs WHERE path = ?`).run(p);
    bumpRevision(p);
  }
  return count;
}

export function countAll(): number {
  const row = getDriver().prepare(`SELECT COUNT(*) AS n FROM docs`).get();
  return Number(row?.n ?? 0);
}
