import { claimNextJob, completeJob, failJob, requeueStaleJobs, type Database, type ProductionJob } from "@sb/db";
import { runJob, type JobDeps } from "./jobs";

export interface WorkerLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export const consoleLogger: WorkerLogger = {
  info: (msg, meta) => console.log(JSON.stringify({ level: "info", msg, ...meta, t: new Date().toISOString() })),
  error: (msg, meta) => console.error(JSON.stringify({ level: "error", msg, ...meta, t: new Date().toISOString() })),
};

/** Claims and runs one job. Returns the job, or null when the queue is empty. */
export async function processNext(deps: JobDeps, log: WorkerLogger = consoleLogger, kinds?: ProductionJob["kind"][]): Promise<ProductionJob | null> {
  const job = await claimNextJob(deps.db, kinds);
  if (!job) return null;
  const started = Date.now();
  log.info("job.start", { id: job.id, kind: job.kind, attempt: job.attempts });
  try {
    const result = await runJob(job, deps);
    await completeJob(deps.db, job.id, result);
    log.info("job.done", { id: job.id, ms: Date.now() - started });
  } catch (err) {
    const permanent = (err as { permanent?: boolean }).permanent === true;
    const outcome = await failJob(deps.db, job, (err as Error).message ?? String(err), !permanent);
    log.error("job.error", { id: job.id, outcome, error: (err as Error).message });
  }
  return job;
}

/** Drains the queue (used by tests and the CLI's --once mode). */
export async function drain(deps: JobDeps, log?: WorkerLogger, max = 100): Promise<number> {
  let n = 0;
  while (n < max && (await processNext(deps, log))) n++;
  return n;
}

export interface RunOptions {
  pollMs?: number;
  signal?: AbortSignal;
  /** Subscribe to Postgres NOTIFY for instant pickup. */
  listen?: (onNotify: () => void) => Promise<() => Promise<void>>;
}

export async function runForever(deps: JobDeps & { db: Database }, opts: RunOptions = {}, log: WorkerLogger = consoleLogger) {
  const pollMs = opts.pollMs ?? 5000;
  let wake: (() => void) | null = null;
  const unlisten = opts.listen ? await opts.listen(() => wake?.()) : null;
  let lastStaleCheck = 0;
  log.info("worker.ready", { pollMs });
  while (!opts.signal?.aborted) {
    if (Date.now() - lastStaleCheck > 60_000) {
      const n = await requeueStaleJobs(deps.db);
      if (n) log.info("worker.requeued_stale", { n });
      lastStaleCheck = Date.now();
    }
    const job = await processNext(deps, log).catch((e) => {
      log.error("worker.loop_error", { error: (e as Error).message });
      return null;
    });
    if (job) continue;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, pollMs);
      wake = () => {
        clearTimeout(t);
        resolve();
      };
      opts.signal?.addEventListener("abort", () => wake?.(), { once: true });
    });
    wake = null;
  }
  await unlisten?.();
  log.info("worker.stopped");
}
