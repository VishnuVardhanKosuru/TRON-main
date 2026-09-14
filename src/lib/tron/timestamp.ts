/**
 * TRON — local Timestamp.
 *
 * Same shape the UI already consumes (.toDate(), .toMillis(), Timestamp.fromDate)
 * so no screen had to change when Firestore was removed.
 */
export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds = 0) {
    this.seconds = Math.floor(seconds);
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  static fromMillis(ms: number): Timestamp {
    const safe = Number.isFinite(ms) ? ms : Date.now();
    return new Timestamp(Math.floor(safe / 1000), (safe % 1000) * 1e6);
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.round(this.nanoseconds / 1e6);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  valueOf(): number {
    return this.toMillis();
  }

  toString(): string {
    return this.toDate().toISOString();
  }

  toJSON(): { __ts: number } {
    return { __ts: this.toMillis() };
  }

  isEqual(other: Timestamp): boolean {
    return other instanceof Timestamp && other.toMillis() === this.toMillis();
  }
}

export function isTimestampLike(v: unknown): v is { __ts: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { __ts?: unknown }).__ts === "number"
  );
}

/** Wire form → live objects (so `data.dueDate.toDate()` keeps working). */
export function reviveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveValue);
  if (isTimestampLike(value)) return Timestamp.fromMillis(value.__ts);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = reviveValue(v);
    }
    return out;
  }
  return value;
}

/** Live objects → wire form. Sentinels pass through untouched for the server. */
export function serializeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toJSON();
  if (value instanceof Date) return { __ts: value.getTime() };
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.__sentinel === "string") {
      return {
        ...obj,
        ...(Array.isArray(obj.elements)
          ? { elements: obj.elements.map(serializeValue) }
          : {}),
      };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}
