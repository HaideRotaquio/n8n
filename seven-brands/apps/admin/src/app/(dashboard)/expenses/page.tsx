import { can } from "@sb/core";
import { EXPENSE_CATEGORIES, expenseSummary, getDb, listBrands, listExpenses } from "@sb/db";
import { Card, EmptyState, PageHeader, Stat, Table } from "@sb/ui";
import { aiBudget, requirePageStaff } from "@/lib/server";
import { usd } from "../production/job-status";
import { ExpenseForm } from "./expense-form";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const staff = await requirePageStaff("finance.read", "global");
  const db = getDb();
  const [summary, recent, brands] = await Promise.all([expenseSummary(db, 6), listExpenses(db, 50), listBrands(db)]);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRows = summary.filter((r) => r.month === thisMonth);
  const monthTotal = monthRows.reduce((s, r) => s + r.totalUsd, 0);
  const aiMonth = monthRows.filter((r) => r.category === "ai").reduce((s, r) => s + r.totalUsd, 0);
  const budget = aiBudget();
  return (
    <>
      <PageHeader title="Expenses" description="AI costs are booked automatically from every agent call. Infrastructure and other costs are recorded here by the owner." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={`Total ${thisMonth}`} value={usd(monthTotal)} />
        <Stat label="AI this month" value={usd(aiMonth)} hint={`Cap $${budget.monthlyUsd}/month · $${budget.dailyUsd}/day`} />
        <Stat label="Months shown" value={new Set(summary.map((r) => r.month)).size} />
        <Stat label="Entries (recent)" value={recent.length} />
      </div>
      {can(staff.grants, "finance.write") && (
        <div className="mb-6"><Card title="Record an expense"><ExpenseForm brands={brands.map((b) => ({ id: b.id, name: b.name }))} categories={EXPENSE_CATEGORIES} /></Card></div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="By month, brand and category">
          {summary.length === 0 ? <EmptyState title="No expenses recorded" /> : (
            <Table head={["Month", "Brand", "Category", "Total"]}>
              {summary.map((r, i) => (
                <tr key={i}><td className="px-4 py-2">{r.month}</td><td className="px-4 py-2">{r.brandSlug ?? "shared"}</td><td className="px-4 py-2">{r.category}</td><td className="px-4 py-2 font-mono text-xs">{usd(r.totalUsd)}</td></tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Recent entries">
          {recent.length === 0 ? <EmptyState title="Nothing yet" /> : (
            <Table head={["Date", "Description", "Brand", "Category", "Amount"]}>
              {recent.map(({ expense: e, brandSlug }) => (
                <tr key={e.id}><td className="whitespace-nowrap px-4 py-2 text-xs">{e.incurredAt.toISOString().slice(0, 10)}</td><td className="px-4 py-2">{e.description}</td><td className="px-4 py-2">{brandSlug ?? "shared"}</td><td className="px-4 py-2">{e.category}</td><td className="px-4 py-2 font-mono text-xs">{usd(e.amountUsd)}</td></tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
