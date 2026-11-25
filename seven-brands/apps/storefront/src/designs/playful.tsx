import { renderAnimatedSvg, serialize, type AssetDefinition } from "@sb/asset";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { LivePreview } from "@/components/live-preview";
import { ScrollShowcase } from "@/components/scroll-showcase";
import { HoverSound, SoundToggle } from "@/components/sound";
import type { CatalogItem, Design, HomeProps, ProductProps, ShellProps } from "./types";

/**
 * Moodicons — "playful-grid": warm cream page, chunky rounded shapes, a sticker-wall hero, colorful category chips
 * and tinted cards. Motion is bouncy but never moves page layout; everything respects reduced motion.
 */

const TINTS = ["#FFE3EC", "#FFF1C7", "#DDF5EC", "#EAE3FF", "#FFE6D6", "#E0F0FF"];
const tint = (i: number) => TINTS[i % TINTS.length]!;

/** Static-safe animated SVG from our renderer (schema-validated input, no user markup). */
function Art({ ad, playOn = "hover", className = "" }: { ad: AssetDefinition; playOn?: "hover" | "load"; className?: string }) {
  return <div className={`[&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: serialize(renderAnimatedSvg(ad, { playOn, title: true })) }} />;
}

function Shell({ brandName, tagline, signedIn, testMode, children }: ShellProps) {
  return (
    <>
      {testMode && <p className="bg-[var(--color-accent)] px-4 py-1 text-center text-xs font-bold text-[var(--color-text)]" role="status">Test mode — no real payments are taken.</p>}
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <Link href="/" className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-[var(--color-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
          <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent)] text-xl motion-safe:animate-[bounce_2.4s_ease-in-out_infinite]">☺</span>
          {brandName}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1 rounded-full bg-[var(--color-surface)] p-1 text-sm font-bold shadow-sm ring-1 ring-[var(--color-border)]">
          <Link href="/" className="rounded-full px-4 py-2 hover:bg-[var(--color-accent)]/40">Shop</Link>
          <Link href="/help" className="rounded-full px-4 py-2 hover:bg-[var(--color-accent)]/40">Help</Link>
          <SoundToggle look="playful" />
          {signedIn ? (
            <>
              <Link href="/account" className="rounded-full px-4 py-2 hover:bg-[var(--color-accent)]/40">Your library</Link>
              <span className="px-3"><SignOutButton /></span>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-full px-4 py-2 hover:bg-[var(--color-accent)]/40">Sign in</Link>
              <Link href="/sign-up" className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-[var(--color-primary-text)]">Join free</Link>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">{children}</main>
      <footer className="mt-auto bg-[var(--color-primary)] px-4 py-10 text-[var(--color-primary-text)]">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          <div>
            <p className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{brandName}</p>
            <p className="opacity-90">{tagline}</p>
          </div>
          <ul className="space-y-1 text-sm font-semibold">
            <li><Link href="/help/licenses">Licenses explained</Link></li>
            <li><Link href="/help/refunds">Refunds</Link></li>
            <li><Link href="/licenses/verify">Verify a license</Link></li>
          </ul>
          <p className="text-sm opacity-90">Every icon is drawn and animated by us, with sound we make ourselves. A Seven Brands company.</p>
        </div>
      </footer>
    </>
  );
}

function Card({ item, i }: { item: CatalogItem; i: number }) {
  return (
    <HoverSound cues={item.cues}>
    <Link href={`/products/${item.slug}`} className="group block rounded-[32px] p-3 transition motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-[-1deg]" style={{ background: tint(i) }}>
      <div className="relative aspect-square rounded-[26px] bg-[var(--color-surface)] p-5 shadow-sm">
        {item.cover && <Art ad={item.cover} className="h-full w-full" />}
        {item.isFree && <span className="absolute left-3 top-3 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-extrabold">FREE</span>}
        {item.kind === "pack" && item.assetCount > 4 && <span className="absolute right-3 top-3 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-extrabold text-[var(--color-primary-text)]">{item.assetCount} icons</span>}
      </div>
      <div className="flex items-baseline justify-between gap-2 px-2 pb-1 pt-3">
        <span className="text-lg font-extrabold leading-tight" style={{ fontFamily: "var(--font-heading)" }}>{item.title}</span>
        {item.priceLabel && !item.isFree && <span className="shrink-0 text-sm font-bold text-[var(--color-muted-text)]">{item.priceLabel}</span>}
      </div>
    </Link>
    </HoverSound>
  );
}

function Home({ tagline, description, items, categories, q, category, freePack, showcase, scrollDemo }: HomeProps) {
  const filtered = !!q || !!category;
  return (
    <div className="space-y-12">
      {!filtered && (
        <section className="grid items-center gap-8 rounded-[48px] bg-[var(--color-surface)] p-6 shadow-sm ring-1 ring-[var(--color-border)] md:grid-cols-2 md:p-10">
          <div>
            <h1 className="text-5xl font-extrabold leading-[1.05] text-[var(--color-primary)] sm:text-6xl" style={{ fontFamily: "var(--font-heading)" }}>{tagline}</h1>
            <p className="mt-4 max-w-md text-lg text-[var(--color-muted-text)]">{description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#shop" className="rounded-full bg-[var(--color-primary)] px-6 py-3 font-extrabold text-[var(--color-primary-text)] shadow">Browse the icons</a>
              {freePack && <Link href={`/products/${freePack.slug}`} className="rounded-full bg-[var(--color-accent)] px-6 py-3 font-extrabold">Get the free pack</Link>}
            </div>
            <p className="mt-4 text-sm text-[var(--color-muted-text)]">Animated SVG, Lottie, GIF, MP4, WebM, React and Web Components — with sound.</p>
            <p className="mt-2 text-sm font-bold">Turn 🔇 Sound on (top right), then hover any icon to hear it.</p>
          </div>
          <ul className="grid grid-cols-3 gap-3" aria-label="Featured icons">
            {showcase.slice(0, 6).map((it, i) => (
              <li key={it.slug} className={`rounded-[28px] p-3 ${i % 2 ? "rotate-3" : "-rotate-3"}`} style={{ background: tint(i) }}>
                <HoverSound cues={it.cues} keepPlaying>
                  <Link href={`/products/${it.slug}`} aria-label={it.title}>{it.cover && <Art ad={it.cover} playOn="load" className="aspect-square" />}</Link>
                </HoverSound>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!filtered && <ScrollShowcase items={scrollDemo} look="playful" />}

      <section id="shop" className="scroll-mt-6 space-y-5">
        <form method="get" className="flex flex-wrap items-center gap-2" role="search">
          <label htmlFor="q" className="sr-only">Search icons</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search: happy, love, party…" className="min-w-0 flex-1 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 font-semibold outline-none focus:border-[var(--color-primary)]" />
          {category && <input type="hidden" name="category" value={category} />}
          <button className="rounded-full bg-[var(--color-text)] px-6 py-3 font-extrabold text-[var(--color-background)]">Search</button>
        </form>
        <nav aria-label="Categories" className="flex flex-wrap gap-2">
          <Link href={q ? `/?q=${encodeURIComponent(q)}#shop` : "/#shop"} aria-current={!category ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-extrabold ring-2 ${!category ? "bg-[var(--color-text)] text-[var(--color-background)] ring-[var(--color-text)]" : "bg-[var(--color-surface)] ring-[var(--color-border)]"}`}>All</Link>
          {categories.map((c, i) => (
            <Link key={c.slug} href={`/?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}#shop`} aria-current={category === c.slug ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-extrabold ring-2 ${category === c.slug ? "bg-[var(--color-text)] text-[var(--color-background)] ring-[var(--color-text)]" : "ring-transparent"}`} style={category === c.slug ? undefined : { background: tint(i) }}>
              {c.label} <span className="opacity-60">{c.count}</span>
            </Link>
          ))}
        </nav>
        {filtered && <p className="font-semibold text-[var(--color-muted-text)]">{items.length} {items.length === 1 ? "result" : "results"}{q && <> for “{q}”</>}. <Link href="/#shop" className="underline">Clear</Link></p>}
        {items.length === 0 ? (
          <p className="rounded-[32px] bg-[var(--color-surface)] p-10 text-center text-lg font-bold">No icons match yet. Try another word.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Products">
            {items.map((it, i) => <li key={it.slug}><Card item={it} i={i} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Product({ title, description, categoryLabel, assets, buy, facts, customizer, soundUrls }: ProductProps) {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <LivePreview assets={assets} look="playful" customizer={customizer} soundUrls={soundUrls} />
      <div>
        {categoryLabel && <p className="inline-block rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-extrabold uppercase tracking-wide">{categoryLabel}</p>}
        <h1 className="mt-3 text-5xl font-extrabold leading-tight text-[var(--color-primary)]" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
        {description && <p className="mt-3 whitespace-pre-line text-lg text-[var(--color-muted-text)]">{description}</p>}
        <ul className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          {facts.map((f) => <li key={f.label} className="rounded-full bg-[var(--color-surface)] px-3 py-1.5 ring-1 ring-[var(--color-border)]">{f.label}: {f.value}</li>)}
        </ul>
        <div className="mt-8 rounded-[32px] bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--color-border)]">{buy}</div>
      </div>
    </div>
  );
}

function Page({ title, intro, children, narrow }: { title: string; intro?: string; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto ${narrow ? "max-w-md" : "max-w-3xl"}`}>
      <h1 className="text-4xl font-extrabold text-[var(--color-primary)]" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
      {intro && <p className="mt-2 text-lg text-[var(--color-muted-text)]">{intro}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

export const playful: Design = { Shell, Home, Product, Page };
