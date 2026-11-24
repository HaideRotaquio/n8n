import { sql } from "drizzle-orm";
import { createDb, runMigrations, type DbHandle } from "./client";

export const DEFAULT_TEST_DATABASE_URL = "postgres://daos:daos_dev_only@localhost:5432/daos_test";

/**
 * Creates a fresh, fully migrated test database schema.
 * Destroys everything in the target database's `public` schema — only point this at a test DB.
 */
export async function createTestDb(): Promise<DbHandle> {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  if (!/test/i.test(url)) throw new Error(`Refusing to reset a non-test database: ${url.replace(/\/\/.*@/, "//***@")}`);
  const handle = createDb(url, { max: 5 });
  await handle.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await handle.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await handle.db.execute(sql`CREATE SCHEMA public`);
  await runMigrations(handle.db);
  return handle;
}
