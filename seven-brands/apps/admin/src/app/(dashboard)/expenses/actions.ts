"use server";

import { can } from "@sb/core";
import { addExpense, EXPENSE_CATEGORIES, getDb, type Expense } from "@sb/db";
import { revalidatePath } from "next/cache";
import { getStaff, requestAuditContext } from "@/lib/server";

export async function addExpenseAction(_prev: { ok: boolean; message: string }, form: FormData) {
  const staff = await getStaff();
  if (!staff || !can(staff.grants, "finance.write")) return { ok: false, message: "Only the owner can record expenses." };
  const category = String(form.get("category"));
  const amount = Number(form.get("amount"));
  const description = String(form.get("description") ?? "").trim();
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { ok: false, message: "Choose a category." };
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return { ok: false, message: "Enter an amount between 0 and 1,000,000." };
  if (description.length < 2) return { ok: false, message: "Add a short description." };
  await addExpense(getDb(), await requestAuditContext(staff.user.id), {
    brandId: String(form.get("brandId") ?? "") || null,
    category: category as Expense["category"],
    description,
    amountUsd: amount,
  });
  revalidatePath("/expenses");
  return { ok: true, message: "Expense recorded." };
}
