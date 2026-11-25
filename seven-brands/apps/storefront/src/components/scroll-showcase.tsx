"use client";

import type { AssetDefinition } from "@sb/asset/runtime";
import { AssetPlayer, attachScroll } from "@sb/player";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSound } from "./sound";

export interface ScrollItem {
  slug: string;
  title: string;
  definition: AssetDefinition;
}

/** One icon whose animation follows the page scroll (the same `scroll="scrub"` mode customers get). */
function ScrubIcon({ item, className }: { item: ScrollItem; className: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<AssetPlayer | null>(null);
  const { enabled } = useSound();

  useEffect(() => {
    const p = new AssetPlayer(host.current!, item.definition, { autoplay: false, muted: true });
    player.current = p;
    const detach = attachScroll(p, host.current!, "scrub", { loops: 2 });
    return () => {
      detach();
      p.destroy();
    };
  }, [item.definition]);

  // Sound follows the site-wide switch (its click already unlocked audio for this page).
  useEffect(() => {
    void player.current?.setMuted(!enabled);
  }, [enabled]);

  return (
    <Link href={`/products/${item.slug}`} className={className} aria-label={item.title}>
      <div ref={host} />
    </Link>
  );
}

export function ScrollShowcase({ items, look }: { items: ScrollItem[]; look: "playful" | "studio" }) {
  if (items.length === 0) return null;
  const studio = look === "studio";
  return (
    <section aria-labelledby="scroll-h" className={studio ? "rounded-[var(--radius)] border border-[var(--color-border)] p-5" : "rounded-[40px] bg-[var(--color-accent)]/30 p-6"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="scroll-h" className={studio ? "font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]" : "text-2xl font-extrabold"} style={studio ? undefined : { fontFamily: "var(--font-heading)" }}>
          {studio ? "Scroll to play" : "Scroll to play them"}
        </h2>
        <p className="text-sm text-[var(--color-muted-text)]">
          These follow your scroll, forwards and back. Yours can too: <code className="font-mono">scroll=&quot;scrub&quot;</code> in the Web Component and React files.
        </p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <li key={it.slug}>
            <ScrubIcon
              item={it}
              className={
                studio
                  ? "block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]"
                  : "block rounded-[28px] bg-[var(--color-surface)] p-4 shadow-sm"
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
