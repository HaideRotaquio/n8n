import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; repositories accept either. */
export type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

export function createDb(connectionString: string, opts: { max?: number } = {}): DbHandle {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString, max: opts.max ?? 10 });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  return { db, pool, close: () => pool.end() };
}

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

let singleton: DbHandle | undefined;

/** Process-wide shared handle for apps (lazy; reads DATABASE_URL). */
export function getDb(): Database {
  if (!singleton) singleton = createDb(process.env.DATABASE_URL ?? "");
  return singleton.db;
}

/** Health probe used by /api/health and the infrastructure page. */
export async function pingDb(db: Database): Promise<{ latencyMs: number; migrations: number }> {
  const t0 = performance.now();
  const res = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
  return { latencyMs: Math.round(performance.now() - t0), migrations: res.rows[0]?.n ?? 0 };
}
