"use client";

import { cuePan, cueTime, type AssetDefinition } from "@sb/asset/runtime";
import { AssetPlayer } from "@sb/player";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSound } from "./sound";

export interface PreviewAsset {
  id: string;
  name: string;
  definition: AssetDefinition;
}

/** Color-style name: "(mint)" in the asset name, else the rig's palette tag (always the last tag), else the name. */
const styleName = (a: PreviewAsset) => /\(([^)]+)\)$/.exec(a.name)?.[1] ?? a.definition.tags.at(-1) ?? a.name;

/**
 * Live product preview: real player (not a GIF), color styles included in the product, an optional color customizer,
 * and sound that stays off until the visitor turns it on. Honors prefers-reduced-motion.
 * `look` only changes styling: "playful" (Moodicons) or "studio" (SonicGlyphs, with a cue timeline).
 */
export function LivePreview({ assets, look, customizer, soundUrls }: { assets: PreviewAsset[]; look: "playful" | "studio"; customizer: boolean; soundUrls?: Record<string, string> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AssetPlayer | null>(null);
  // Starts with the site-wide sound switch, and keeps the visitor's choice when they switch color styles.
  const { enabled: siteSound } = useSound();
  const mutedRef = useRef(!siteSound);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [reduced, setReduced] = useState(false);
  const current = assets[index]!;
  const [tokens, setTokens] = useState<Record<string, string>>(current.definition.tokens);
  const ad = current.definition;
  // A product either holds one design in several color styles, or several different designs (packs and bundles).
  const baseName = (a: PreviewAsset) => a.name.replace(/\s*\([^)]*\)$/, "");
  const manyDesigns = new Set(assets.map(baseName)).size > 1;
  const SHOWN = 16;

  useEffect(() => {
    const isReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(isReduced);
    setTokens(ad.tokens);
    const p = new AssetPlayer(hostRef.current!, ad, {
      autoplay: !isReduced,
      muted: mutedRef.current,
      soundUrls,
      onTick: (t) => setTime(t),
      onStateChange: (s) => {
        setPlaying(s.playing);
        setMuted(s.muted);
        mutedRef.current = s.muted;
      },
    });
    playerRef.current = p;
    return () => p.destroy();
  }, [ad]);

  const cues = useMemo(() => ad.sounds.map((c) => ({ id: c.id, at: cueTime(c, ad.timeline), pan: cuePan(c, ad), sound: c.sound.startsWith("snd_") ? "recorded" : c.sound.replace(/^synth:/, "") })), [ad]);
  /** Mixing-desk style position: "C", "L40", "R75". */
  const panLabel = (p: number) => (Math.abs(p) < 0.05 ? "C" : `${p < 0 ? "L" : "R"}${Math.round(Math.abs(p) * 100)}`);
  const studio = look === "studio";
  const btn = studio
    ? "rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 font-mono text-xs uppercase tracking-wider hover:border-[var(--color-primary)]"
    : "rounded-full bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-[var(--color-border)] hover:ring-[var(--color-primary)]";

  return (
    <div className="space-y-4">
      <div
        className={
          studio
            ? "relative flex aspect-square items-center justify-center overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)]"
            : "relative flex aspect-square items-center justify-center overflow-hidden rounded-[36px] bg-[var(--color-accent)]/35"
        }
        data-testid="live-preview"
      >
        {studio && <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:32px_32px]" />}
        {!studio && <div aria-hidden className="absolute h-3/4 w-3/4 rounded-full bg-[var(--color-surface)]" />}
        <div ref={hostRef} className="relative w-3/5" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} aria-pressed={playing} onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={btn} onClick={() => playerRef.current?.restart()}>
          Replay
        </button>
        {ad.sounds.length > 0 && (
          <button type="button" className={`${btn} ${!muted ? "!bg-[var(--color-primary)] !text-[var(--color-primary-text)]" : ""}`} aria-pressed={!muted} onClick={() => playerRef.current?.setMuted(!muted)}>
            {muted ? (studio ? "Sound: off" : "🔇 Turn sound on") : studio ? "Sound: on" : "🔊 Sound on"}
          </button>
        )}
      </div>
      {reduced && <p className="text-xs text-[var(--color-muted-text)]">Reduced motion is on, so the preview starts paused. Press Play to watch it.</p>}

      {studio && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3" aria-label="Sound cue timeline">
          <div className="mb-2 flex justify-between font-mono text-[11px] uppercase tracking-wider text-[var(--color-muted-text)]">
            <span>Cue sheet</span>
            <span>{(ad.timeline.duration / 1000).toFixed(1)} s loop</span>
          </div>
          <div className="relative h-8 rounded bg-[var(--color-background)]">
            <div className="absolute inset-y-0 left-0 bg-[var(--color-primary)]/15" style={{ width: `${(time / ad.timeline.duration) * 100}%` }} />
            {cues.map((c) => (
              <div key={c.id} className="absolute inset-y-0 w-0.5 bg-[var(--color-accent)]" style={{ left: `${(c.at / ad.timeline.duration) * 100}%` }} title={`${c.sound} at ${c.at} ms`} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 font-mono text-xs text-[var(--color-muted-text)]">
            {cues.map((c) => (
              <li key={c.id}>
                <span className="text-[var(--color-accent)]">●</span> {c.sound} @ {c.at} ms · {panLabel(c.pan)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assets.length > 1 && (
        <fieldset>
          <legend className={studio ? "mb-2 font-mono text-xs uppercase tracking-wider text-[var(--color-muted-text)]" : "mb-2 text-sm font-bold"}>
            {manyDesigns ? `${assets.length} icons included` : `${assets.length} color styles included`}
          </legend>
          <div className="flex flex-wrap gap-2">
            {assets.slice(0, SHOWN).map((a, i) => {
              const swatch = Object.values(a.definition.tokens).slice(0, 3);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-pressed={i === index}
                  className={`flex items-center gap-2 ${btn} ${i === index ? "!ring-2 !ring-[var(--color-primary)] border-[var(--color-primary)]" : ""}`}
                >
                  <span aria-hidden className="flex">
                    {swatch.map((c) => (
                      <span key={c} className="-ml-1 inline-block h-4 w-4 rounded-full border border-black/20 first:ml-0" style={{ background: c }} />
                    ))}
                  </span>
                  {manyDesigns ? a.name : styleName(a)}
                </button>
              );
            })}
            {assets.length > SHOWN && <span className="self-center text-sm text-[var(--color-muted-text)]">and {assets.length - SHOWN} more</span>}
          </div>
        </fieldset>
      )}

      {customizer && Object.keys(tokens).length > 0 && (
        <details className={studio ? "rounded-[var(--radius)] border border-[var(--color-border)] p-3" : "rounded-3xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]"}>
          <summary className={studio ? "cursor-pointer font-mono text-xs uppercase tracking-wider" : "cursor-pointer text-sm font-bold"}>Try your own colors</summary>
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(tokens).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  value={v}
                  aria-label={`Color ${k}`}
                  onChange={(e) => {
                    const next = { ...tokens, [k]: e.target.value.toUpperCase() };
                    setTokens(next);
                    playerRef.current?.setTokens(next);
                  }}
                  className="h-8 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
                />
                {k}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted-text)]">Your files come with editable color tokens, so you can do the same in your project.</p>
        </details>
      )}
    </div>
  );
}
