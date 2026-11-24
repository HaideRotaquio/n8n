import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth-forms";
import { getShopper, requireStore, safeNext } from "@/lib/store";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const store = await requireStore();
  const next = safeNext((await searchParams).next);
  if (await getShopper()) redirect(next);
  return (
    <div className="mx-auto max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-text)]">Keep your {store.brand.name} purchases, downloads and licenses in one place.</p>
      <SignUpForm next={next} brandName={store.brand.name} />
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="underline">Sign in</Link>
      </p>
    </div>
  );
}
