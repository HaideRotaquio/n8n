import type { AssetPlayer } from "./index";

/**
 * Scroll-driven playback for any element that hosts an AssetPlayer.
 *
 * - "scrub": the animation follows the scroll position. Progress is 0 when the element's top reaches the bottom of the
 *   viewport and 1 when its bottom leaves the top, so the whole animation plays while the element crosses the screen.
 *   `loops` repeats the timeline that many times across that distance. Sounds (once unmuted) fire as the scroll passes
 *   their cue going forward; scrolling back rewinds silently.
 * - "in-view": plays from the start when at least half the element is visible, pauses when it leaves.
 *
 * Under prefers-reduced-motion nothing is attached: the still frame stays.
 */
export type ScrollMode = "scrub" | "in-view";

export function isScrollMode(v: unknown): v is ScrollMode {
  return v === "scrub" || v === "in-view";
}

/** 0 → element top at the viewport bottom; 1 → element bottom at the viewport top. Clamped. */
export function scrollProgress(rect: { top: number; height: number }, viewportHeight: number): number {
  const span = viewportHeight + rect.height;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (viewportHeight - rect.top) / span));
}

export function attachScroll(player: AssetPlayer, el: Element, mode: ScrollMode, opts: { loops?: number } = {}): () => void {
  if (player.reducedMotion || typeof window === "undefined") return () => {};
  if (mode === "in-view") {
    if (typeof IntersectionObserver === "undefined") return () => {};
    player.pause();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) player.restart();
          else player.pause();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }
  const loops = Math.max(1, Math.min(20, Math.floor(opts.loops ?? 1)));
  player.pause();
  let frame = 0;
  const update = () => {
    frame = 0;
    const p = scrollProgress(el.getBoundingClientRect(), window.innerHeight);
    player.scrubTo(p * loops * player.duration);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}
