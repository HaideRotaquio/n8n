"use client";

import { Button, Field, Input, Notice } from "@sb/ui";
import { useActionState } from "react";
import { addExpenseAction } from "./actions";

const select = "w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm";

export function ExpenseForm({ brands, categories }: { brands: { id: string; name: string }[]; categories: readonly string[] }) {
  const [state, action, pending] = useActionState(addExpenseAction, { ok: false, message: "" });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5 sm:items-end">
      <Field label="Description" htmlFor="description"><Input id="description" name="description" placeholder="Neon Launch plan" /></Field>
      <Field label="Amount (USD)" htmlFor="amount"><Input id="amount" name="amount" type="number" step="0.01" min="0" /></Field>
      <Field label="Category" htmlFor="category">
        <select id="category" name="category" className={select}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
      <Field label="Brand" htmlFor="brandId">
        <select id="brandId" name="brandId" className={select}>
          <option value="">Shared (company)</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <Button type="submit" disabled={pending}>Add expense</Button>
      {state.message && <div className="sm:col-span-5"><Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice></div>}
    </form>
  );
}
