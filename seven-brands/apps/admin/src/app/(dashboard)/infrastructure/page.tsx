import { getDb, pingDb } from "@sb/db";
import { Badge, PageHeader, Table } from "@sb/ui";
import { getStorage, requirePageStaff } from "@/lib/server";

export const metadata = { title: "Infrastructure" };
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail: string };

export default async function InfrastructurePage() {
  await requirePageStaff("infrastructure.read", "global");
  const checks: Check[] = [];

  try {
    const { latencyMs, migrations } = await pingDb(getDb());
    checks.push({ name: "Database", ok: true, detail: `Connected in ${latencyMs} ms · ${migrations} migrations applied` });
  } catch (e) {
    checks.push({ name: "Database", ok: false, detail: (e as Error).message });
  }

  try {
    const s = getStorage();
    const key = "system/healthcheck.txt";
    await s.put(key, new Date().toISOString(), { contentType: "text/plain" });
    const ok = await s.exists(key);
    checks.push({ name: "Object storage", ok, detail: `Driver: ${s.kind}${s.kind === "fs" ? " (local development only)" : ""}` });
  } catch (e) {
    checks.push({ name: "Object storage", ok: false, detail: (e as Error).message });
  }

  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  checks.push({ name: "Auth secret", ok: secret.length >= 32, detail: secret.length >= 32 ? "Set" : "Missing or too short" });
  checks.push({
    name: "Auth rate limiting",
    ok: process.env.AUTH_RATE_LIMIT !== "off",
    detail: process.env.AUTH_RATE_LIMIT === "off" ? "Disabled (AUTH_RATE_LIMIT=off)" : "Enabled, stored in Postgres",
  });
  checks.push({ name: "Runtime", ok: true, detail: `Node ${process.version} · ${process.env.NODE_ENV}` });
  checks.push({ name: "AI provider", ok: false, detail: "Not configured — needed in Phase 2 (no API key provided yet)" });
  checks.push({ name: "Payment provider", ok: false, detail: "Not configured — Phase 3, test mode first" });

  return (
    <>
      <PageHeader title="Infrastructure" description="Live checks run when this page loads. Cost reporting arrives with the expense tracker (Phase 2)." />
      <Table head={["Component", "Status", "Detail"]}>
        {checks.map((c) => (
          <tr key={c.name}>
            <td className="px-4 py-2 font-medium">{c.name}</td>
            <td className="px-4 py-2"><Badge tone={c.ok ? "success" : "warning"}>{c.ok ? "OK" : "Attention"}</Badge></td>
            <td className="px-4 py-2 text-[var(--color-muted-text)]">{c.detail}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
