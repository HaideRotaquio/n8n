/**
 * Production worker: runs rig, AI and export jobs from the `production_job` queue.
 *   pnpm --filter @sb/worker start          # run until stopped
 *   pnpm --filter @sb/worker start --once   # drain the queue and exit
 */
import { createDb } from "@sb/db";
import { createStorageFromEnv } from "@sb/storage";
import pg from "pg";
import { consoleLogger, drain, runForever } from "./worker";

const handle = createDb(process.env.DATABASE_URL ?? "", { max: 4 });
const storage = createStorageFromEnv(process.env);
const deps = { db: handle.db, storage };

if (process.argv.includes("--once")) {
  const n = await drain(deps);
  consoleLogger.info("worker.drained", { jobs: n });
  await handle.close();
} else {
  const ac = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => ac.abort());
  await runForever(deps, {
    signal: ac.signal,
    listen: async (onNotify) => {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      client.on("notification", onNotify);
      await client.query("LISTEN daos_jobs");
      return async () => client.end();
    },
  });
  await handle.close();
}
