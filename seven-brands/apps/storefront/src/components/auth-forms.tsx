"use client";

import { authClient } from "@sb/auth/client";
import { Button, Field, Input, Notice } from "@sb/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveConsent } from "./auth-actions";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: String(f.get("email") ?? ""), password: String(f.get("password") ?? "") });
    setPending(false);
    if (error) return setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Email or password is incorrect.");
    router.replace(next);
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignUpForm({ next, brandName }: { next: string; brandName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password.length < 12) return setError("Use at least 12 characters for your password.");
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name: String(f.get("name") ?? "").trim(), email: String(f.get("email") ?? "").trim(), password });
    if (error) {
      setPending(false);
      return setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : error.message ?? "We couldn't create your account.");
    }
    await saveConsent(f.get("marketing") === "on");
    router.replace(next);
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Name" htmlFor="name" hint="Shown on your license certificates.">
        <Input id="name" name="name" autoComplete="name" required maxLength={100} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 12 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="marketing" className="mt-1" />
        <span>Email me about new {brandName} releases. Optional; unsubscribe any time.</span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
