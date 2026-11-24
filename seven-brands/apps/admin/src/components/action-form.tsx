"use client";

import { Button, Notice } from "@sb/ui";
import { useActionState, type ReactNode } from "react";

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
      action={run}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
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
