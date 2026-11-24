import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/**
 * Shared React primitives. Styling uses Tailwind utilities that read the
 * active theme's CSS variables (`--color-*`, `--radius`), so the same
 * components render in each brand's identity. Apps must include this
 * package in Tailwind's sources (`@source`).
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90",
    secondary:
      "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/40",
    ghost: "text-[var(--color-text)] hover:bg-[var(--color-border)]/40",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        "rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-text)]">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
    info: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
    success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
    warning: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
    danger: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-text)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted-text)]">{hint}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--color-text)]">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--color-muted-text)]">{hint}</p>}
      {error && (
        <p className="text-xs text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted-text)] focus:outline focus:outline-2 focus:outline-[var(--color-primary)]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, props.className)} />;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-muted-text)]">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Swatch({ color, label }: { color: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label ? `${label}: ${color}` : color}>
      <span className="inline-block h-4 w-4 rounded-full border border-black/10" style={{ background: color }} />
      {label && <span className="text-xs text-[var(--color-muted-text)]">{label}</span>}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-10 text-center">
      <p className="font-medium text-[var(--color-text)]">{title}</p>
      {children && <div className="mt-2 text-sm text-[var(--color-muted-text)]">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "danger"; children: ReactNode }) {
  const tones = {
    info: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
    success: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
    danger: "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-[var(--radius)] border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
