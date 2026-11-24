"use client";

import type { AssetDefinition } from "@sb/asset/runtime";
import { AssetPlayer } from "@sb/player";
import { Button } from "@sb/ui";
import { useEffect, useRef, useState } from "react";

const BACKGROUNDS = {
  light: "#FFFFFF",
  dark: "#0B0B14",
  cream: "#FFF8EC",
  checker: "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 20px 20px",
} as const;
type Bg = keyof typeof BACKGROUNDS;

/**
 * Universal Viewer: playback, restart, speed, sound (user-initiated), background,
 * color customization, size, fullscreen and a timeline scrubber. Honors reduced motion.
 */
export function UniversalViewer({ definition, defaultBackground, soundUrls }: { definition: AssetDefinition; defaultBackground: Bg; soundUrls?: Record<string, string> }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AssetPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [size, setSize] = useState(280);
  const [bg, setBg] = useState<Bg>(defaultBackground);
  const [tokens, setTokens] = useState<Record<string, string>>(definition.tokens);
  const [time, setTime] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const host = hostRef.current!;
    const isReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(isReduced);
    const p = new AssetPlayer(host, definition, {
      autoplay: !isReduced,
      muted: true,
      soundUrls,
      onTick: (t) => setTime(t),
      onStateChange: (s) => {
        setPlaying(s.playing);
        setMuted(s.muted);
      },
    });
    playerRef.current = p;
    return () => p.destroy();
  }, [definition]);

  const update = (k: string, v: string) => {
    const next = { ...tokens, [k]: v.toUpperCase() };
    setTokens(next);
    playerRef.current?.setTokens(next);
  };

  const duration = definition.timeline.duration;
  const hasSound = definition.sounds.length > 0;

  return (
    <div className="space-y-4">
      <div
        ref={stageRef}
        className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]"
        style={{ background: BACKGROUNDS[bg] }}
        data-testid="viewer-stage"
      >
        <div ref={hostRef} style={{ width: size, maxWidth: "100%" }} data-testid="viewer-host" />
      </div>

      {reduced && (
        <p className="text-xs text-[var(--color-muted-text)]">
          Your system asks for reduced motion, so the still frame is shown. Press Play to preview the animation.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())} aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </Button>
        <Button variant="secondary" onClick={() => playerRef.current?.restart()}>
          Restart
        </Button>
        {hasSound && (
          <Button variant="secondary" onClick={() => playerRef.current?.setMuted(!muted)} aria-pressed={!muted}>
            {muted ? "Sound off" : "Sound on"}
          </Button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm">
          Speed
          <select
            value={speed}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSpeed(v);
              playerRef.current?.setSpeed(v);
            }}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1"
          >
            {[0.25, 0.5, 1, 1.5, 2].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" onClick={() => stageRef.current?.requestFullscreen?.()}>
          Fullscreen
        </Button>
      </div>

      <label className="block text-sm">
        <span className="sr-only">Timeline position</span>
        <input
          type="range"
          min={0}
          max={duration}
          value={Math.round(time)}
          onChange={(e) => {
            playerRef.current?.pause();
            playerRef.current?.seek(Number(e.target.value));
          }}
          className="w-full"
          aria-label="Timeline position"
        />
        <span className="font-mono text-xs text-[var(--color-muted-text)]">
          {Math.round(time)} / {duration} ms
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Background</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BACKGROUNDS) as Bg[]).map((b) => (
              <Button key={b} variant={b === bg ? "primary" : "secondary"} onClick={() => setBg(b)} aria-pressed={b === bg}>
                {b}
              </Button>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            Size: {size}px
            <input type="range" min={64} max={512} step={8} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" />
          </label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Colors</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(tokens).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="color" value={v.toLowerCase()} onChange={(e) => update(k, e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-[var(--color-border)]" aria-label={`Color ${k}`} />
                {k}
              </label>
            ))}
          </div>
          <Button variant="ghost" onClick={() => { setTokens(definition.tokens); playerRef.current?.setTokens(definition.tokens); }}>
            Reset colors
          </Button>
        </fieldset>
      </div>
    </div>
  );
}
