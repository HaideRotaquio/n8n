"use client";

import { Button, Field, Notice, Textarea } from "@sb/ui";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createJobAction, type JobFormState } from "./actions";

export interface RigOption {
  id: string;
  brand: string;
  label: string;
  variants: string[];
  palettes: string[];
}
export interface BrandOption {
  id: string;
  slug: string;
  name: string;
  categories: { slug: string; label: string }[];
}

const select = "w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm";

export function NewJobForm({ brands, rigs, ai }: { brands: BrandOption[]; rigs: RigOption[]; ai: { configured: boolean; label: string } }) {
  const [state, action, pending] = useActionState(createJobAction, { ok: false, message: "" } as JobFormState);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [kind, setKind] = useState<"rig" | "ai">("rig");
  const brand = brands.find((b) => b.id === brandId);
  const brandRigs = rigs.filter((r) => r.brand === brand?.slug);
  const [rigId, setRigId] = useState(brandRigs[0]?.id ?? "");
  const rig = brandRigs.find((r) => r.id === rigId) ?? brandRigs[0];

  return (
    <form action={action} className="space-y-4">
      {state.message && (
        <Notice tone={state.ok ? "success" : "danger"}>
          {state.message} {state.jobId && <Link className="underline" href={`/production/${state.jobId}`}>View job</Link>}
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand" htmlFor="brandId">
          <select id="brandId" name="brandId" className={select} value={brandId} onChange={(e) => { setBrandId(e.target.value); setRigId(""); }}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Method" htmlFor="kind">
          <select id="kind" name="kind" className={select} value={kind} onChange={(e) => setKind(e.target.value as "rig" | "ai")}>
            <option value="rig">Rig (deterministic, free)</option>
            <option value="ai">AI brief ({ai.label})</option>
          </select>
        </Field>
      </div>

      {kind === "rig" ? (
        rig ? (
          <>
            <Field label="Rig" htmlFor="rig">
              <select id="rig" name="rig" className={select} value={rig.id} onChange={(e) => setRigId(e.target.value)}>
                {brandRigs.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Variants</legend>
              <div className="flex flex-wrap gap-3">
                {rig.variants.map((v) => (
                  <label key={v} className="flex items-center gap-1 text-sm"><input type="checkbox" name="variants" value={v} defaultChecked /> {v}</label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Palettes</legend>
              <div className="flex flex-wrap gap-3">
                {rig.palettes.map((p, i) => (
                  <label key={p} className="flex items-center gap-1 text-sm"><input type="checkbox" name="palettes" value={p} defaultChecked={i === 0} /> {p}</label>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted-text)]">No rigs exist for this brand yet. Use an AI brief.</p>
        )
      ) : (
        <>
          {!ai.configured && <Notice tone="danger">{ai.label}</Notice>}
          <Field label="Brief" htmlFor="prompt" hint="What should the asset show, and how should it move and sound?">
            <Textarea id="prompt" name="prompt" rows={4} placeholder="A waving hand that greets the viewer, with a friendly pop when it waves" />
          </Field>
          <Field label="Category" htmlFor="category">
            <select id="category" name="category" className={select}>
              <option value="">Let the creative director choose</option>
              {brand?.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </Field>
          <p className="text-xs text-[var(--color-muted-text)]">Each AI job makes 3–6 model calls. Spend is capped per day and month; results always go to human review.</p>
        </>
      )}
      <Button type="submit" disabled={pending || (kind === "ai" && !ai.configured) || (kind === "rig" && !rig)}>
        {pending ? "Queuing…" : "Queue job"}
      </Button>
    </form>
  );
}
