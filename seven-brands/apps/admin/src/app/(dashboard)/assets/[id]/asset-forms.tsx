"use client";

import { Button, Field, Notice, Textarea } from "@sb/ui";
import { useActionState } from "react";
import { exportAction, reviewAction, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: "" };

export function ReviewForm({ assetId, canApprove }: { assetId: string; canApprove: boolean }) {
  const [state, action, pending] = useActionState(reviewAction.bind(null, assetId), initial);
  return (
    <form action={action} className="space-y-3">
      {state.message && <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>}
      <Field label="Review notes" htmlFor="notes" hint="Required when rejecting.">
        <Textarea id="notes" name="notes" rows={3} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="approved" disabled={pending || !canApprove} title={canApprove ? undefined : "Fails automated QA"}>
          Approve
        </Button>
        <Button type="submit" name="decision" value="rejected" variant="danger" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}

export function ExportButton({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(exportAction.bind(null, assetId), initial);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Queuing…" : "Generate exports"}
      </Button>
      {state.message && <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
