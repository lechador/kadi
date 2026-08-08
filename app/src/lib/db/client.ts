import "server-only";

import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

/// One `sql` interface over two drivers.
///
/// Neon's HTTP driver is the production path: a query is a single `fetch`, so
/// there is no connection to warm up and a cold serverless invocation answers
/// immediately. Anything else — a local Postgres during development, a
/// container in CI — goes through node-postgres on a pooled TCP socket. Both
/// speak the same dialect, so no query above this file knows which answered.
///
/// `DATABASE_URL` being unset is a supported state, not a crash: Kadi's source
/// of truth is the chain, and every page falls back to reading it directly.
/// Callers check `isDatabaseConfigured()` and take the slow path.

export type Row = Record<string, unknown>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

const CONNECTION_STRING = process.env.DATABASE_URL ?? "";

export function isDatabaseConfigured(): boolean {
  return CONNECTION_STRING.length > 0;
}

/// Neon serves the HTTP endpoint from the same hostname as the SQL one, so the
/// connection string is enough to pick a driver. `DATABASE_DRIVER` overrides it
/// for the awkward cases — a Neon proxy on a custom domain, or forcing TCP to
/// debug something.
function pickDriver(url: string): "neon" | "pg" {
  const override = process.env.DATABASE_DRIVER;
  if (override === "neon" || override === "pg") return override;
  try {
    return new URL(url).hostname.endsWith(".neon.tech") ? "neon" : "pg";
  } catch {
    return "pg";
  }
}

type Executor = (text: string, params: unknown[]) => Promise<Row[]>;

/// Next.js re-evaluates modules on every hot reload in development. Hanging the
/// pool off `globalThis` keeps one pool across reloads instead of leaking a new
/// set of sockets each time a file is saved.
const poolHome = globalThis as typeof globalThis & { __kadiPool?: Pool };

function pgExecutor(url: string): Executor {
  poolHome.__kadiPool ??= new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  const pool = poolHome.__kadiPool;
  return async (text, params) => (await pool.query(text, params)).rows as Row[];
}

function neonExecutor(url: string): Executor {
  const client = neon(url);
  return async (text, params) =>
    (await client.query(text, params)) as unknown as Row[];
}

let executor: Executor | undefined;

function getExecutor(): Executor {
  if (executor) return executor;
  if (!CONNECTION_STRING) throw new DatabaseNotConfiguredError();
  executor =
    pickDriver(CONNECTION_STRING) === "neon"
      ? neonExecutor(CONNECTION_STRING)
      : pgExecutor(CONNECTION_STRING);
  return executor;
}

/// Parameterised query for the cases a tagged template cannot express —
/// filters assembled at runtime, `IN` lists of unknown length. Values are still
/// bound, never interpolated.
export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  return (await getExecutor()(text, params)) as T[];
}

/// The everyday interface. Interpolations become bind parameters, so
/// `sql`select * from goals where address = ${address}`` is injection-safe by
/// construction — there is no way to splice a value in as SQL text.
export async function sql<T extends Row = Row>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let text = strings[0];
  for (let index = 0; index < values.length; index += 1) {
    text += `$${index + 1}${strings[index + 1]}`;
  }
  return query<T>(text, values);
}

export async function first<T extends Row = Row>(
  rows: Promise<T[]>
): Promise<T | null> {
  return (await rows)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Column readers
//
// `numeric` and `bigint` come back as strings from both drivers — Postgres
// values do not fit in a JS number and neither driver will silently lose
// precision. These turn them into the bigints the rest of the app uses.
// ---------------------------------------------------------------------------

export function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && value !== "") return BigInt(value);
  return 0n;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "") return Number(value);
  return 0;
}

export function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/// Chain timestamps are Unix seconds; Postgres hands back a `Date`. Goals and
/// donations are rendered from the same formatters either way, so everything
/// crossing this boundary is normalised back to seconds.
export function toUnixSeconds(value: unknown): bigint {
  if (value instanceof Date) return BigInt(Math.floor(value.getTime() / 1000));
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0n : BigInt(Math.floor(parsed / 1000));
  }
  return toBigInt(value);
}

export function fromUnixSeconds(seconds: bigint | number | null): Date | null {
  if (seconds === null) return null;
  const value = Number(seconds);
  return value > 0 ? new Date(value * 1000) : null;
}
