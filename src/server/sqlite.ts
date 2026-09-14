/**
 * TRON — SQLite driver adapter.
 *
 * Zero cloud. Everything lives in a single SQLite file on the Redmi.
 *
 * We support two drivers so TRON runs on whatever Node/Termux gives us:
 *   1. node:sqlite       — built into Node 22+ (no native build needed). Preferred.
 *   2. better-sqlite3    — fallback if node:sqlite is unavailable.
 *
 * Both expose the tiny surface we need: prepare().all/get/run, exec(), pragma.
 */

import path from "node:path";
import fs from "node:fs";

export interface Stmt {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): unknown;
}

export interface Driver {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  name: string;
}

function resolveDbPath(): string {
  const configured = process.env.TRON_DB_PATH;
  const file = configured && configured.trim()
    ? configured.trim()
    : path.join(process.cwd(), "data", "tron.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

/**
 * Grab a Node builtin without going through the bundler's `require`.
 * Next.js compiles server code with webpack, so a literal require("node:sqlite")
 * gets rewritten and fails at runtime. process.getBuiltinModule bypasses that.
 */
function builtin<T>(name: string): T | null {
  const get = (process as NodeJS.Process & {
    getBuiltinModule?: (id: string) => unknown;
  }).getBuiltinModule;
  if (typeof get !== "function") return null;
  try {
    return (get.call(process, name) as T) ?? null;
  } catch {
    return null;
  }
}

function openNodeSqlite(file: string): Driver | null {
  try {
    const mod = builtin<{ DatabaseSync: new (p: string) => NodeSqliteDb }>("node:sqlite");
    if (!mod?.DatabaseSync) return null;
    const db = new mod.DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    return {
      name: "node:sqlite",
      exec: (sql: string) => db.exec(sql),
      prepare: (sql: string) => {
        const st = db.prepare(sql);
        return {
          all: (...p: unknown[]) => st.all(...p) as Record<string, unknown>[],
          get: (...p: unknown[]) => st.get(...p) as Record<string, unknown> | undefined,
          run: (...p: unknown[]) => st.run(...p),
        };
      },
    };
  } catch {
    return null;
  }
}

interface NodeSqliteDb {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...p: unknown[]): unknown[];
    get(...p: unknown[]): unknown;
    run(...p: unknown[]): unknown;
  };
}

function openBetterSqlite(file: string): Driver | null {
  try {
    const mod = builtin<{ createRequire: (p: string) => NodeRequire }>("node:module");
    if (!mod?.createRequire) return null;
    const nodeRequire = mod.createRequire(`${process.cwd()}/`);
    const Database = nodeRequire("better-sqlite3");
    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    return {
      name: "better-sqlite3",
      exec: (sql: string) => db.exec(sql),
      prepare: (sql: string) => {
        const st = db.prepare(sql);
        return {
          all: (...p: unknown[]) => st.all(...p) as Record<string, unknown>[],
          get: (...p: unknown[]) => st.get(...p) as Record<string, unknown> | undefined,
          run: (...p: unknown[]) => st.run(...p),
        };
      },
    };
  } catch {
    return null;
  }
}

let cached: Driver | null = null;

export function getDriver(): Driver {
  if (cached) return cached;
  const file = resolveDbPath();
  const driver = openNodeSqlite(file) ?? openBetterSqlite(file);
  if (!driver) {
    throw new Error(
      "TRON: no SQLite driver available. Run on Node 22.14+ (which ships node:sqlite), " +
      "or `npm install better-sqlite3`."
    );
  }
  console.log(`[TRON] SQLite ready via ${driver.name} → ${file}`);
  cached = driver;
  migrate(driver);
  return cached;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS docs (
  id          TEXT PRIMARY KEY,
  path        TEXT NOT NULL,          -- collection path, e.g. users/owner/todos
  data        TEXT NOT NULL,          -- JSON document body
  created_ms  INTEGER NOT NULL,
  updated_ms  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_path       ON docs(path);
CREATE INDEX IF NOT EXISTS idx_docs_path_created ON docs(path, created_ms);

CREATE TABLE IF NOT EXISTS revisions (
  path  TEXT PRIMARY KEY,
  rev   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id          TEXT PRIMARY KEY,
  subject     TEXT NOT NULL,          -- normalised lookup key
  content     TEXT NOT NULL,          -- exactly what the owner asked TRON to remember
  created_ms  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_subject ON memories(subject);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  label       TEXT,
  created_ms  INTEGER NOT NULL,
  expires_ms  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function migrate(driver: Driver) {
  driver.exec(SCHEMA);
}

/** Global monotonic revision — the client polls this to know when to refetch. */
export function bumpRevision(pathKey: string) {
  const d = getDriver();
  d.prepare(
    `INSERT INTO revisions (path, rev) VALUES (?, 1)
     ON CONFLICT(path) DO UPDATE SET rev = rev + 1`
  ).run(pathKey);
  d.prepare(
    `INSERT INTO revisions (path, rev) VALUES ('__global__', 1)
     ON CONFLICT(path) DO UPDATE SET rev = rev + 1`
  ).run();
}

export function getRevisions(): Record<string, number> {
  const rows = getDriver().prepare(`SELECT path, rev FROM revisions`).all();
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.path)] = Number(r.rev);
  return out;
}
