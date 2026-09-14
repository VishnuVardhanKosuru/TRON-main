/**
 * TRON — local data client with a Firestore-shaped surface.
 *
 * Firebase is gone. This module keeps the exact call signatures the existing
 * screens already use (collection / doc / query / where / onSnapshot / addDoc …)
 * but every read and write goes to SQLite on the Redmi through /api/data.
 *
 * Keeping the surface identical is deliberate: the UI is the part we want to
 * preserve, so the storage swap happens entirely underneath it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { api, watchPath, type WireDoc } from "./transport";
import { Timestamp, reviveValue, serializeValue } from "./timestamp";

export { Timestamp };

/** Same intentionally-loose shape Firestore used, so field access stays ergonomic. */
export type DocumentData = Record<string, any>;

// ── Handles ───────────────────────────────────────────────────────────────────

/** Placeholder so `collection(db, ...)` reads the same as it always did. */
export const localDb = { __tron: true as const };

export class CollectionReference {
  readonly type = "collection" as const;
  constructor(readonly path: string) {}
  get id() {
    return this.path.split("/").pop() ?? this.path;
  }
}

export class DocumentReference {
  readonly type = "document" as const;
  constructor(readonly parentPath: string, readonly id: string) {}
  get path() {
    return `${this.parentPath}/${this.id}`;
  }
}

export interface Constraint {
  kind: "where" | "orderBy" | "limit";
  field?: string;
  op?: string;
  value?: unknown;
  dir?: "asc" | "desc";
  n?: number;
}

export class Query {
  readonly type = "query" as const;
  constructor(readonly path: string, readonly constraints: Constraint[]) {}
}

// ── Path building ─────────────────────────────────────────────────────────────

function joinSegments(segments: unknown[]): string {
  return segments
    .map((s) => String(s))
    .join("/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

export function collection(
  _db: unknown,
  ...segments: (string | number)[]
): CollectionReference {
  const first: unknown = segments[0];
  if (first instanceof CollectionReference) return first;
  return new CollectionReference(joinSegments(segments));
}

export function doc(
  ref: unknown,
  ...segments: (string | number)[]
): DocumentReference {
  if (ref instanceof CollectionReference) {
    const id = segments.length ? joinSegments(segments) : cryptoId();
    return new DocumentReference(ref.path, id);
  }
  // doc(db, "users", uid, "todos", id)  |  doc(db, "users/uid/todos/id")
  const full = joinSegments(segments);
  const parts = full.split("/");
  const id = parts.pop()!;
  return new DocumentReference(parts.join("/"), id);
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Query constraints ─────────────────────────────────────────────────────────

export function where(field: string, op: string, value: unknown): Constraint {
  return { kind: "where", field, op, value };
}

export function orderBy(field: string, dir: "asc" | "desc" = "asc"): Constraint {
  return { kind: "orderBy", field, dir };
}

export function limit(n: number): Constraint {
  return { kind: "limit", n };
}

export function query(
  source: CollectionReference | Query,
  ...constraints: Constraint[]
): Query {
  if (source instanceof Query) {
    return new Query(source.path, [...source.constraints, ...constraints]);
  }
  return new Query(source.path, constraints);
}

function toRequest(q: Query | CollectionReference) {
  const path = q instanceof Query ? q.path : q.path;
  const constraints = q instanceof Query ? q.constraints : [];

  const filters = constraints
    .filter((c) => c.kind === "where")
    .map((c) => ({ field: c.field!, op: c.op!, value: serializeValue(c.value) }));

  const order = constraints.find((c) => c.kind === "orderBy");
  const lim = constraints.find((c) => c.kind === "limit");

  return {
    path,
    filters,
    orderBy: order ? { field: order.field!, dir: order.dir ?? "asc" } : undefined,
    limit: lim?.n,
  };
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export class QueryDocumentSnapshot {
  constructor(private readonly wire: WireDoc) {}
  get id() {
    return this.wire.id;
  }
  get ref() {
    return new DocumentReference(this.wire.path, this.wire.id);
  }
  exists(): boolean {
    return true;
  }
  data(): DocumentData {
    return reviveValue(this.wire.data) as DocumentData;
  }
}

export class QuerySnapshot {
  readonly docs: QueryDocumentSnapshot[];
  constructor(wireDocs: WireDoc[]) {
    this.docs = wireDocs.map((d) => new QueryDocumentSnapshot(d));
  }
  get size() {
    return this.docs.length;
  }
  get empty() {
    return this.docs.length === 0;
  }
  forEach(fn: (d: QueryDocumentSnapshot) => void) {
    this.docs.forEach(fn);
  }
}

export class DocumentSnapshot {
  constructor(
    private readonly wire: WireDoc | null,
    private readonly fallbackId: string
  ) {}
  get id() {
    return this.wire?.id ?? this.fallbackId;
  }
  get ref() {
    return this.wire
      ? new DocumentReference(this.wire.path, this.wire.id)
      : null;
  }
  exists(): boolean {
    return this.wire !== null;
  }
  data(): DocumentData {
    return this.wire ? (reviveValue(this.wire.data) as DocumentData) : ({} as DocumentData);
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getDocs(
  source: Query | CollectionReference
): Promise<QuerySnapshot> {
  const { docs } = await api.list(toRequest(source));
  return new QuerySnapshot(docs);
}

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const { doc: wire } = await api.get(ref.parentPath, ref.id);
  return new DocumentSnapshot(wire, ref.id);
}

// ── Live reads ────────────────────────────────────────────────────────────────

type SnapshotHandler<T> = ((snap: T) => void) | { next?: (snap: T) => void };
type ErrorHandler = (err: Error) => void;

function invoke<T>(handler: SnapshotHandler<T>, snap: T) {
  if (typeof handler === "function") handler(snap);
  else handler?.next?.(snap);
}

export function onSnapshot(
  source: DocumentReference,
  handler: SnapshotHandler<DocumentSnapshot>,
  onError?: ErrorHandler
): () => void;
export function onSnapshot(
  source: Query | CollectionReference,
  handler: SnapshotHandler<QuerySnapshot>,
  onError?: ErrorHandler
): () => void;
export function onSnapshot(
  source: Query | CollectionReference | DocumentReference,
  handler: SnapshotHandler<any>,
  onError?: ErrorHandler
): () => void {
  let cancelled = false;

  const isDoc = source instanceof DocumentReference;
  const watchTarget = isDoc
    ? source.parentPath
    : (source as Query | CollectionReference).path;

  const load = async () => {
    try {
      const snap = isDoc
        ? await getDoc(source)
        : await getDocs(source as Query | CollectionReference);
      if (!cancelled) invoke(handler, snap);
    } catch (err) {
      if (cancelled) return;
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) onError(error);
      else console.error("[TRON] snapshot error:", error.message);
    }
  };

  void load();
  const unwatch = watchPath(watchTarget, () => void load());

  return () => {
    cancelled = true;
    unwatch();
  };
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function addDoc(
  ref: CollectionReference,
  data: DocumentData
): Promise<DocumentReference> {
  const { doc: wire } = await api.add(ref.path, serializeValue(data));
  return new DocumentReference(wire.path, wire.id);
}

export async function setDoc(
  ref: DocumentReference,
  data: DocumentData,
  options?: { merge?: boolean }
): Promise<void> {
  await api.set(ref.parentPath, ref.id, serializeValue(data), Boolean(options?.merge));
}

export async function updateDoc(
  ref: DocumentReference,
  data: DocumentData
): Promise<void> {
  await api.update(ref.parentPath, ref.id, serializeValue(data));
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  await api.remove(ref.parentPath, ref.id);
}

export async function purgeCollections(paths: string[]): Promise<number> {
  const { deletedCount } = await api.purge(paths);
  return deletedCount;
}

// ── Field sentinels ───────────────────────────────────────────────────────────

export function serverTimestamp() {
  return { __sentinel: "serverTimestamp" as const };
}

export function increment(by: number) {
  return { __sentinel: "increment" as const, by };
}

export function arrayUnion(...elements: unknown[]) {
  return { __sentinel: "arrayUnion" as const, elements };
}

export function arrayRemove(...elements: unknown[]) {
  return { __sentinel: "arrayRemove" as const, elements };
}

export function deleteField() {
  return { __sentinel: "deleteField" as const };
}
