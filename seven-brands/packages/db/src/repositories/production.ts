import { newId, NotFoundError } from "@sb/core";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import {
  agentTask,
  brand,
  expense,
  productionJob,
  type AgentTask,
  type Expense,
  type ProductionJob,
  EXPENSE_CATEGORIES,
} from "../schema";
import { recordAudit, type AuditContext } from "./audit";
import type { BrandScope } from "./brands";

// ─── Jobs (the table is the queue) ───────────────────────────────────────────

export async function enqueueJob(
  db: Database,
  ctx: AuditContext,
  input: { brandId: string; kind: ProductionJob["kind"]; brief: unknown; maxAttempts?: number },
): Promise<ProductionJob> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(productionJob)
      .values({
        id: newId("job"),
        brandId: input.brandId,
        kind: input.kind,
        brief: input.brief,
        maxAttempts: input.maxAttempts ?? 2,
        requestedBy: ctx.actorUserId,
      })
      .returning();
    await recordAudit(tx, ctx, { action: "production.enqueue", entityType: "production_job", entityId: job!.id, brandId: input.brandId, after: { kind: input.kind, brief: input.brief } });
    await tx.execute(sql`select pg_notify('daos_jobs', ${job!.id})`);
    return job!;
  });
}

/** Atomically claims the next runnable job (safe with many workers). */
export async function claimNextJob(db: Database, kinds?: ProductionJob["kind"][]): Promise<ProductionJob | null> {
  const kindFilter = kinds?.length ? sql`and kind in (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})` : sql``;
  const res = await db.execute<{ id: string }>(sql`
    update production_job set status = 'running', attempts = attempts + 1, started_at = now(), updated_at = now(), error = null
    where id = (
      select id from production_job
      where status = 'queued' and run_after <= now() ${kindFilter}
      order by run_after, created_at
      for update skip locked
      limit 1
    )
    returning id`);
  const id = res.rows[0]?.id;
  if (!id) return null;
  return (await db.query.productionJob.findFirst({ where: eq(productionJob.id, id) })) ?? null;
}

export async function completeJob(db: DbOrTx, jobId: string, result: unknown): Promise<void> {
  await db
    .update(productionJob)
    .set({ status: "succeeded", result, finishedAt: new Date() })
    .where(eq(productionJob.id, jobId));
}

/** Retries with backoff while attempts remain; otherwise marks the job failed. */
export async function failJob(db: DbOrTx, job: ProductionJob, error: string, retryable = true): Promise<"retry" | "failed"> {
  const canRetry = retryable && job.attempts < job.maxAttempts;
  await db
    .update(productionJob)
    .set(
      canRetry
        ? { status: "queued", error: error.slice(0, 4000), runAfter: new Date(Date.now() + 15_000 * job.attempts) }
        : { status: "failed", error: error.slice(0, 4000), finishedAt: new Date() },
    )
    .where(eq(productionJob.id, job.id));
  return canRetry ? "retry" : "failed";
}

export async function cancelJob(db: Database, ctx: AuditContext, jobId: string): Promise<void> {
  const res = await db
    .update(productionJob)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(productionJob.id, jobId), eq(productionJob.status, "queued")))
    .returning();
  if (!res.length) throw new NotFoundError("Only queued jobs can be cancelled");
  await recordAudit(db, ctx, { action: "production.cancel", entityType: "production_job", entityId: jobId, brandId: res[0]!.brandId });
}

/** Re-queues jobs stuck in `running` (e.g. a worker crashed) after `staleMs`. */
export async function requeueStaleJobs(db: Database, staleMs = 15 * 60_000): Promise<number> {
  const res = await db.execute(sql`
    update production_job set status = 'queued', run_after = now(), updated_at = now(), error = 'Re-queued after worker timeout'
    where status = 'running' and started_at < now() - (${staleMs} || ' milliseconds')::interval and attempts < max_attempts`);
  return res.rowCount ?? 0;
}

export async function listJobs(db: Database, scope: BrandScope, limit = 50) {
  if (scope !== "all" && scope.length === 0) return [];
  return db
    .select({ job: productionJob, brandSlug: brand.slug, brandName: brand.name })
    .from(productionJob)
    .innerJoin(brand, eq(brand.id, productionJob.brandId))
    .where(scope === "all" ? undefined : inArray(productionJob.brandId, scope))
    .orderBy(desc(productionJob.createdAt))
    .limit(Math.min(limit, 200));
}

export async function getJob(db: Database, id: string) {
  const job = await db.query.productionJob.findFirst({ where: eq(productionJob.id, id) });
  if (!job) return null;
  const tasks = await db.select().from(agentTask).where(eq(agentTask.productionJobId, id)).orderBy(agentTask.createdAt);
  return { job, tasks };
}

// ─── Agent runs & costs ──────────────────────────────────────────────────────

export interface AgentTaskInput {
  productionJobId: string;
  brandId: string;
  agent: string;
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  input?: unknown;
  output?: unknown;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

/** Records an agent call, adds its cost to the job, and books an AI expense. One transaction. */
export async function recordAgentTask(db: Database, t: AgentTaskInput): Promise<AgentTask> {
  return db.transaction(async (tx) => {
    const id = newId("agt");
    const [row] = await tx
      .insert(agentTask)
      .values({
        id,
        productionJobId: t.productionJobId,
        agent: t.agent,
        provider: t.provider,
        model: t.model,
        status: t.status,
        input: t.input ?? null,
        output: t.output ?? null,
        error: t.error ?? null,
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        costUsd: t.costUsd.toFixed(6),
        durationMs: t.durationMs,
      })
      .returning();
    if (t.costUsd > 0) {
      await tx
        .update(productionJob)
        .set({ costUsd: sql`${productionJob.costUsd} + ${t.costUsd.toFixed(6)}` })
        .where(eq(productionJob.id, t.productionJobId));
      await tx.insert(expense).values({
        id: newId("exp"),
        brandId: t.brandId,
        category: "ai",
        description: `${t.agent} (${t.model})`,
        amountUsd: t.costUsd.toFixed(6),
        source: `agent_task:${id}`,
      });
    }
    return row!;
  });
}

export async function listAgentTasks(db: Database, scope: BrandScope, limit = 100) {
  if (scope !== "all" && scope.length === 0) return [];
  return db
    .select({ task: agentTask, brandSlug: brand.slug })
    .from(agentTask)
    .innerJoin(productionJob, eq(productionJob.id, agentTask.productionJobId))
    .innerJoin(brand, eq(brand.id, productionJob.brandId))
    .where(scope === "all" ? undefined : inArray(productionJob.brandId, scope))
    .orderBy(desc(agentTask.createdAt))
    .limit(Math.min(limit, 500));
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function addExpense(
  db: Database,
  ctx: AuditContext,
  input: { brandId: string | null; category: Expense["category"]; description: string; amountUsd: number; incurredAt?: Date },
): Promise<Expense> {
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) throw new Error("Unknown expense category");
  if (!(input.amountUsd >= 0) || input.amountUsd > 1_000_000) throw new Error("Amount must be between 0 and 1,000,000");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expense)
      .values({
        id: newId("exp"),
        brandId: input.brandId,
        category: input.category,
        description: input.description.slice(0, 300),
        amountUsd: input.amountUsd.toFixed(6),
        source: "manual",
        incurredAt: input.incurredAt ?? new Date(),
        createdBy: ctx.actorUserId,
      })
      .returning();
    await recordAudit(tx, ctx, { action: "finance.expense", entityType: "expense", entityId: row!.id, brandId: input.brandId, after: { category: input.category, amountUsd: input.amountUsd } });
    return row!;
  });
}

export async function sumExpenses(db: DbOrTx, opts: { since: Date; category?: Expense["category"]; brandId?: string }): Promise<number> {
  const conds = [gte(expense.incurredAt, opts.since)];
  if (opts.category) conds.push(eq(expense.category, opts.category));
  if (opts.brandId) conds.push(eq(expense.brandId, opts.brandId));
  const [r] = await db.select({ total: sql<string>`coalesce(sum(${expense.amountUsd}), 0)` }).from(expense).where(and(...conds));
  return Number(r?.total ?? 0);
}

export interface ExpenseSummaryRow {
  month: string;
  brandSlug: string | null;
  category: string;
  totalUsd: number;
}

export async function expenseSummary(db: Database, months = 6): Promise<ExpenseSummaryRow[]> {
  const res = await db.execute<{ month: string; brand_slug: string | null; category: string; total: string }>(sql`
    select to_char(date_trunc('month', e.incurred_at), 'YYYY-MM') as month, b.slug as brand_slug, e.category::text as category, sum(e.amount_usd) as total
    from expense e left join brand b on b.id = e.brand_id
    where e.incurred_at >= date_trunc('month', now()) - (${months - 1} || ' months')::interval
    group by 1, 2, 3 order by 1 desc, 2 nulls first, 3`);
  return res.rows.map((r) => ({ month: r.month, brandSlug: r.brand_slug, category: r.category, totalUsd: Number(r.total) }));
}

export async function listExpenses(db: Database, limit = 100) {
  return db
    .select({ expense, brandSlug: brand.slug })
    .from(expense)
    .leftJoin(brand, eq(brand.id, expense.brandId))
    .orderBy(desc(expense.incurredAt))
    .limit(Math.min(limit, 500));
}
