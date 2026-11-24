"use client";

import { Notice } from "@sb/ui";
import Link from "next/link";
import { useActionState, useState } from "react";
import { startCheckout, type BuyState } from "./actions";

interface Option {
  licenseType: string;
  currency: string;
  label: string;
  hint: string;
  price: string;
  free: boolean;
}

export function BuyForm({ slug, options, signedIn, checkoutAvailable }: { slug: string; options: Option[]; signedIn: boolean; checkoutAvailable: boolean }) {
  const [state, action, pending] = useActionState(startCheckout, { error: null } as BuyState);
  const [selected, setSelected] = useState(0);
  const chosen = options[selected];
  if (options.length === 0) return <p>Not available right now.</p>;
  const next = `/products/${slug}`;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">Choose a license</legend>
        {options.map((o, i) => (
          <label key={`${o.licenseType}-${o.currency}`} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3 has-[:checked]:border-[var(--color-primary)] has-[:checked]:ring-1 has-[:checked]:ring-[var(--color-primary)]">
            <input type="radio" name="license" value={`${o.licenseType}:${o.currency}`} checked={i === selected} onChange={() => setSelected(i)} className="mt-1 accent-[var(--color-primary)]" />
            <span className="flex-1">
              <span className="flex justify-between gap-2 font-semibold">
                <span>{o.label}</span>
                <span>{o.price}</span>
              </span>
              <span className="block text-sm text-[var(--color-muted-text)]">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {!signedIn ? (
        <p className="text-sm">
          <Link href={`/sign-in?next=${next}`} className="font-semibold underline">Sign in</Link> or{" "}
          <Link href={`/sign-up?next=${next}`} className="font-semibold underline">create an account</Link> to {chosen?.free ? "get it" : "buy"}. Your files and license stay in your library.
        </p>
      ) : !chosen?.free && !checkoutAvailable ? (
        <Notice>Checkout opens soon.</Notice>
      ) : (
        <button type="submit" disabled={pending} className="w-full rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-3 font-bold text-[var(--color-primary-text)] hover:opacity-90 disabled:opacity-50">
          {pending ? "One moment…" : chosen?.free ? "Get it free" : `Buy now — ${chosen?.price}`}
        </button>
      )}
      <p className="text-xs text-[var(--color-muted-text)]">
        {chosen?.free ? "Free downloads come with a personal license certificate." : "Payment is handled by our reseller (Merchant of Record), who also handles sales tax/VAT."}{" "}
        <Link href="/help/licenses" className="underline">Compare licenses</Link>
      </p>
    </form>
  );
}
