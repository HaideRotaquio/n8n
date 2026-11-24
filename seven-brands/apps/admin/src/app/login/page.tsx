import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getStaff()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted-text)]">Seven Brands</p>
        <h1 className="mt-1 text-xl font-semibold">DAOS Admin</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-text)]">Staff sign-in. Accounts are created by an owner.</p>
        <LoginForm />
      </div>
    </main>
  );
}
