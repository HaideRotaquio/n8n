"use client";

import { Button, Notice } from "@sb/ui";
import Link from "next/link";
import { useActionState } from "react";
import { startCheckout, type BuyState } from "./actions";

interface Option {
  licenseType: string;
  currency: string;
  label: string;
  hint: string;
  price: string;
}

export function BuyForm({ slug, options, signedIn, checkoutAvailable }: { slug: string; options: Option[]; signedIn: boolean; checkoutAvailable: boolean }) {
  const [state, action, pending] = useActionState(startCheckout, { error: null } as BuyState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">Choose a license</legend>
        {options.map((o, i) => (
          <label key={`${o.licenseType}-${o.currency}`} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 has-[:checked]:border-[var(--color-accent)]">
            <input type="radio" name="license" value={`${o.licenseType}:${o.currency}`} defaultChecked={i === 0} className="mt-1" />
            <span className="flex-1">
              <span className="flex justify-between gap-2 font-medium">
                <span>{o.label}</span>
                <span>{o.price}</span>
              </span>
              <span className="block text-sm text-[var(--color-muted-text)]">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {!checkoutAvailable ? (
        <Notice>Checkout opens soon.</Notice>
      ) : signedIn ? (
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Opening checkout…" : "Buy now"}
        </Button>
      ) : (
        <p className="text-sm">
          <Link href={`/sign-in?next=/products/${slug}`} className="font-medium underline">
            Sign in
          </Link>{" "}
          or{" "}
          <Link href={`/sign-up?next=/products/${slug}`} className="font-medium underline">
            create an account
          </Link>{" "}
          to buy. Your purchases stay in your library.
        </p>
      )}
    </form>
  );
}
