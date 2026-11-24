import { themeToCssVars } from "@sb/core";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getCommerce, getShopper, getStore } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore();
  if (!store) return { title: "Storefront not found", robots: { index: false } };
  const c = store.brand.config;
  return { title: { default: `${c.name} — ${c.tagline}`, template: `%s · ${c.name}` }, description: c.description || c.tagline };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await getStore();
  if (!store) {
    return (
      <html lang="en">
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    );
  }
  const shopper = await getShopper();
  const active = getCommerce().active;
  const c = store.brand.config;
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased" style={themeToCssVars(c.theme) as CSSProperties}>
        {active?.testMode && (
          <p className="bg-amber-300 px-4 py-1 text-center text-xs font-medium text-amber-950" role="status">
            Test mode — {active.label}. No real payments are taken.
          </p>
        )}
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {c.name}
            </Link>
            <nav aria-label="Main" className="flex items-center gap-4 text-sm">
              <Link href="/">Catalog</Link>
              {shopper ? (
                <>
                  <Link href="/account">Your library</Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/sign-in">Sign in</Link>
                  <Link href="/sign-up" className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 font-medium text-[var(--color-primary-text)]">
                    Create account
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-muted-text)]">
          <p>
            {c.name} · {c.tagline}
          </p>
          <p className="mt-1">
            <Link href="/licenses/verify" className="underline">
              Verify a license
            </Link>{" "}
            · A Seven Brands company
          </p>
        </footer>
      </body>
    </html>
  );
}
