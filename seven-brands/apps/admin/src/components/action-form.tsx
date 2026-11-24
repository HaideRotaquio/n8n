"use client";

import { Button, Notice } from "@sb/ui";
import { startTransition, useActionState, type ReactNode } from "react";

export interface ActionState {
  ok: boolean;
  message: string;
  issues?: string[];
}

/** A form bound to a server action, with pending state and the action's result shown inline. */
export function ActionForm({
  action,
  submit,
  children,
  variant = "primary",
  className = "space-y-3",
  confirm,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submit: string;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  confirm?: string;
}) {
  const [state, run, pending] = useActionState(action, { ok: false, message: "" });
  return (
    <form
      className={className}
      // Submitted manually (not via the `action` prop) so React doesn't reset the fields:
      // after a validation error the person's input — including a chosen file — is still there.
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      {children}
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? "Working…" : submit}
      </Button>
      {state.message && (
        <Notice tone={state.ok ? "success" : "danger"}>
          {state.message}
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {state.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </form>
  );
}
