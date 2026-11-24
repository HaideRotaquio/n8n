"use client";

import type { BrandConfig, BrandStatus } from "@sb/core";
import { Button, Field, Input, Notice, Textarea } from "@sb/ui";
import { useActionState } from "react";
import { setBrandStatusAction, updateBrandAction, type FormState } from "./actions";

const TOKEN_LABELS: Record<keyof BrandConfig["theme"]["tokens"], string> = {
  background: "Background",
  surface: "Surface",
  text: "Text",
  mutedText: "Muted text",
  primary: "Primary",
  primaryText: "Text on primary",
  accent: "Accent",
  border: "Border",
};

const initial: FormState = { ok: false, message: "" };

export function BrandForm({ slug, config, canEdit }: { slug: string; config: BrandConfig; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateBrandAction.bind(null, slug), initial);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5">
      {state.message && <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>}
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={err.name}>
            <Input id="name" name="name" defaultValue={config.name} required />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={err.tagline}>
            <Input id="tagline" name="tagline" defaultValue={config.tagline} required />
          </Field>
        </div>
        <Field label="Description" htmlFor="description" error={err.description}>
          <Textarea id="description" name="description" rows={3} defaultValue={config.description} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Domains" htmlFor="domains" hint="One per line. Hostnames only." error={err.domains}>
            <Textarea id="domains" name="domains" rows={3} defaultValue={config.domains.join("\n")} />
          </Field>
          <Field label="Audiences" htmlFor="audiences" hint="One per line." error={err.audiences}>
            <Textarea id="audiences" name="audiences" rows={3} defaultValue={config.audiences.join("\n")} />
          </Field>
          <Field label="Marketing channels" htmlFor="marketingChannels" hint="One per line." error={err.marketingChannels}>
            <Textarea id="marketingChannels" name="marketingChannels" rows={3} defaultValue={config.marketingChannels.join("\n")} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Color tokens</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(TOKEN_LABELS) as (keyof typeof TOKEN_LABELS)[]).map((k) => (
              <Field key={k} label={TOKEN_LABELS[k]} htmlFor={`token_${k}`} error={err[`token_${k}`]}>
                <Input
                  id={`token_${k}`}
                  name={`token_${k}`}
                  type="color"
                  defaultValue={config.theme.tokens[k].toLowerCase()}
                  className="h-10 cursor-pointer p-1"
                />
              </Field>
            ))}
          </div>
        </div>
        {canEdit && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </fieldset>
    </form>
  );
}

export function StatusForm({ slug, status, statuses }: { slug: string; status: BrandStatus; statuses: { value: BrandStatus; label: string }[] }) {
  const [state, action, pending] = useActionState(setBrandStatusAction.bind(null, slug), initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Status" htmlFor="status">
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Update status
      </Button>
      {state.message && <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
