import { renderAnimatedSvg, serialize, type AssetDefinition } from "@sb/asset";
import Link from "next/link";
import { LivePreview } from "@/components/live-preview";
import { HoverSound, SoundToggle } from "@/components/sound";
import { SignOutButton } from "@/components/sign-out-button";
import type { CatalogItem, Design, HomeProps, ProductProps, ShellProps } from "./types";

/**
 * SonicGlyphs — "studio-dark": a night-time studio. Dark panels on a faint grid, monospace labels like hardware,
 * neon mint for signal and violet for sound. Cards read as rack modules with index numbers and cue counts.
 */

const mono = "font-mono text-[11px] uppercase tracking-[0.18em]";

function Art({ ad, playOn = "hover", className = "" }: { ad: AssetDefinition; playOn?: "hover" | "load"; className?: string }) {
  return <div className={`[&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: serialize(renderAnimatedSvg(ad, { playOn, title: true })) }} />;
}

function Shell({ brandName, tagline, signedIn, testMode, children }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col [background-image:linear-gradient(rgba(124,240,197,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(124,240,197,0.04)_1px,transparent_1px)] [background-size:48px_48px]">
      {testMode && <p className={`border-b border-[var(--color-accent)] bg-[var(--color-accent)]/20 px-4 py-1 text-center ${mono}`} role="status">Test mode — no real payments are taken</p>}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span aria-hidden className="flex h-6 items-end gap-[3px]">
              {[10, 18, 24, 14, 20].map((hgt, i) => <span key={i} className="w-[3px] rounded-full bg-[var(--color-primary)]" style={{ height: hgt }} />)}
            </span>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{brandName}</span>
          </Link>
          <nav aria-label="Main" className={`flex flex-wrap items-center gap-5 ${mono}`}>
            <Link href="/" className="hover:text-[var(--color-primary)]">Library</Link>
            <Link href="/help" className="hover:text-[var(--color-primary)]">Help</Link>
            <SoundToggle look="studio" />
            {signedIn ? (
              <>
                <Link href="/account" className="hover:text-[var(--color-primary)]">My glyphs</Link>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="hover:text-[var(--color-primary)]">Sign in</Link>
                <Link href="/sign-up" className="rounded-[var(--radius)] border border-[var(--color-primary)] px-3 py-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-text)]">Create account</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-[var(--color-border)] px-4 py-8">
        <div className={`mx-auto flex max-w-6xl flex-wrap justify-between gap-4 text-[var(--color-muted-text)] ${mono}`}>
          <span>{brandName} — {tagline}</span>
          <span className="flex gap-5">
            <Link href="/help/licenses" className="hover:text-[var(--color-primary)]">Licenses</Link>
            <Link href="/help/refunds" className="hover:text-[var(--color-primary)]">Refunds</Link>
            <Link href="/licenses/verify" className="hover:text-[var(--color-primary)]">Verify</Link>
          </span>
          <span>Sounds synthesized in-house · Seven Brands</span>
        </div>
      </footer>
    </div>
  );
}

function Module({ item, n }: { item: CatalogItem; n: number }) {
  const cues = item.cover?.sounds.length ?? 0;
  return (
    <HoverSound cues={item.cues}>
    <Link href={`/products/${item.slug}`} className="group block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-primary)] hover:shadow-[0_0_0_1px_var(--color-primary),0_0_24px_-6px_var(--color-primary)]">
      <div className={`flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-muted-text)] ${mono}`}>
        <span>SG-{String(n + 1).padStart(2, "0")}</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${item.isFree ? "bg-[var(--color-primary)]" : "bg-[var(--color-accent)]"} group-hover:animate-pulse`} />
          {item.isFree ? "Free" : `${cues} cue${cues === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="aspect-[4/3] p-6">{item.cover && <Art ad={item.cover} className="mx-auto h-full max-w-[60%]" />}</div>
      <div className="flex items-baseline justify-between gap-2 border-t border-[var(--color-border)] px-3 py-3">
        <span className="font-medium">{item.title}</span>
        <span className="shrink-0 font-mono text-sm text-[var(--color-primary)]">{item.isFree ? "$0" : item.priceLabel}</span>
      </div>
      {item.kind === "pack" && item.assetCount > 3 && <p className={`px-3 pb-3 text-[var(--color-muted-text)] ${mono}`}>{item.assetCount} glyphs in pack</p>}
    </Link>
    </HoverSound>
  );
}

function Home({ tagline, description, items, categories, q, category, freePack, showcase }: HomeProps) {
  const filtered = !!q || !!category;
  return (
    <div className="space-y-12">
      {!filtered && (
        <section className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className={`text-[var(--color-primary)] ${mono}`}>Audio-reactive icon library</p>
            <h1 className="mt-3 text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl" style={{ fontFamily: "var(--font-heading)" }}>{tagline}</h1>
            <p className="mt-4 max-w-lg text-[var(--color-muted-text)]">{description} Every cue lands on the frame it belongs to — export for web, apps and video with the timing intact.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#library" className="rounded-[var(--radius)] bg-[var(--color-primary)] px-5 py-3 font-semibold text-[var(--color-primary-text)]">Browse the library</a>
              {freePack && <Link href={`/products/${freePack.slug}`} className="rounded-[var(--radius)] border border-[var(--color-accent)] px-5 py-3 font-semibold text-[var(--color-text)] hover:bg-[var(--color-accent)]/20">Hear the free pack →</Link>}
            </div>
          </div>
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_0_60px_-20px_var(--color-accent)]">
            <div className={`mb-3 flex justify-between text-[var(--color-muted-text)] ${mono}`}><span>Rack 01 — sound on, then hover to hear</span><span className="text-[var(--color-primary)]">● live</span></div>
            <ul className="grid grid-cols-3 gap-2" aria-label="Featured glyphs">
              {showcase.slice(0, 6).map((it) => (
                <li key={it.slug} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] p-3 hover:border-[var(--color-primary)]">
                  <HoverSound cues={it.cues} keepPlaying>
                    <Link href={`/products/${it.slug}`} aria-label={it.title}>{it.cover && <Art ad={it.cover} playOn="load" className="aspect-square" />}</Link>
                  </HoverSound>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="library" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{filtered ? "Results" : "The library"} <span className="font-mono text-base text-[var(--color-muted-text)]">[{items.length}]</span></h2>
          <form method="get" role="search" className="flex gap-2">
            <label htmlFor="q" className="sr-only">Search glyphs</label>
            <input id="q" name="q" defaultValue={q} placeholder="speaker, beat, play…" className="w-56 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-primary)]" />
            {category && <input type="hidden" name="category" value={category} />}
            <button className={`rounded-[var(--radius)] border border-[var(--color-border)] px-3 ${mono} hover:border-[var(--color-primary)]`}>Search</button>
          </form>
        </div>
        <nav aria-label="Categories" className={`flex flex-wrap gap-2 ${mono}`}>
          {[{ slug: null as string | null, label: "All", count: null as number | null }, ...categories].map((c) => {
            const active = c.slug === category;
            const href = c.slug ? `/?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}#library` : q ? `/?q=${encodeURIComponent(q)}#library` : "/#library";
            return (
              <Link key={c.label} href={href} aria-current={active ? "page" : undefined} className={`rounded-[var(--radius)] border px-3 py-2 ${active ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-text)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}>
                {c.label}{c.count !== null && <span className="ml-2 opacity-60">{c.count}</span>}
              </Link>
            );
          })}
        </nav>
        {filtered && <p className="text-sm text-[var(--color-muted-text)]">{q && <>Matching “{q}”. </>}<Link href="/#library" className="underline">Clear filters</Link></p>}
        {items.length === 0 ? (
          <p className={`rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-10 text-center ${mono}`}>No signal. Try another search.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Products">
            {items.map((it, i) => <li key={it.slug}><Module item={it} n={i} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Product({ title, description, categoryLabel, assets, buy, facts, customizer, soundUrls }: ProductProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <LivePreview assets={assets} look="studio" customizer={customizer} soundUrls={soundUrls} />
      <div className="space-y-6">
        <div>
          {categoryLabel && <p className={`text-[var(--color-primary)] ${mono}`}>{categoryLabel}</p>}
          <h1 className="mt-2 text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
          {description && <p className="mt-3 whitespace-pre-line text-[var(--color-muted-text)]">{description}</p>}
        </div>
        <dl className="divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)]">
          {facts.map((f) => (
            <div key={f.label} className="flex justify-between gap-4 px-3 py-2 text-sm">
              <dt className={`text-[var(--color-muted-text)] ${mono}`}>{f.label}</dt>
              <dd className="text-right font-mono">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">{buy}</div>
      </div>
    </div>
  );
}

function Page({ title, intro, children, narrow }: { title: string; intro?: string; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto ${narrow ? "max-w-md" : "max-w-3xl"}`}>
      <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
      {intro && <p className="mt-2 text-[var(--color-muted-text)]">{intro}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

export const studio: Design = { Shell, Home, Product, Page };
