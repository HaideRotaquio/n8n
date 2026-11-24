import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth-forms";
import { getShopper, requireStore, safeNext } from "@/lib/store";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const store = await requireStore();
  const next = safeNext((await searchParams).next);
  if (await getShopper()) redirect(next);
  return (
    <div className="mx-auto max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-text)]">Your {store.brand.name} library and licenses.</p>
      <SignInForm next={next} />
      <p className="mt-4 text-sm">
        New here?{" "}
        <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="underline">Create an account</Link>
      </p>
    </div>
  );
}
