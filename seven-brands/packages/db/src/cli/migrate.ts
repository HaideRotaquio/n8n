import { createDb, runMigrations } from "../client";

const handle = createDb(process.env.DATABASE_URL ?? "");
try {
  await runMigrations(handle.db);
  console.log("Migrations applied.");
} finally {
  await handle.close();
}
