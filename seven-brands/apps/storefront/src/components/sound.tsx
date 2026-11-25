"use client";

import { parseSynthRef, renderPreset } from "@sb/audio";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Hover-to-hear for the whole storefront.
 *
 * Browsers only allow sound after the visitor clicks, taps or presses a key on the page, so sound starts with an
 * explicit "Sound on" switch (that click unlocks audio). The choice is remembered; on a later visit the first click
 * or key press anywhere unlocks audio again. Sound is never on by default.
 */

/** A sound cue, pre-resolved on the server (time, stereo position) so cards don't ship whole asset definitions. */
export interface HoverCue {
  sound: string;
  params?: Record<string, number>;
  atMs: number;
  gain: number;
  pan: number;
}

interface SoundApi {
  enabled: boolean;
  toggle(): void;
  play(cues: HoverCue[]): void;
  stop(): void;
}

const SoundContext = createContext<SoundApi>({ enabled: false, toggle() {}, play() {}, stop() {} });
export const useSound = () => useContext(SoundContext);

const STORAGE_KEY = "sb-sound";
const RATE = 48_000;

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const active = useRef(new Set<AudioBufferSourceNode>());

  const ensureContext = useCallback(() => {
    if (typeof AudioContext === "undefined") return null;
    ctxRef.current ??= new AudioContext();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  // Remembered choice: show "on", and unlock audio on the first gesture anywhere on the page.
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      /* storage unavailable: stay off */
    }
    if (!saved) return;
    setEnabled(true);
    const unlock = () => ensureContext();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensureContext]);

  const stop = useCallback(() => {
    for (const s of active.current) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    active.current.clear();
  }, []);

  const bufferFor = useCallback(async (ctx: AudioContext, cue: HoverCue): Promise<AudioBuffer | null> => {
    const key = `${cue.sound}|${JSON.stringify(cue.params ?? {})}`;
    const cached = buffers.current.get(key);
    if (cached) return cached;
    let buf: AudioBuffer | null = null;
    const preset = parseSynthRef(cue.sound);
    if (preset) {
      const data = renderPreset(preset, cue.params ?? {}, RATE);
      buf = ctx.createBuffer(1, data.length, RATE);
      buf.copyToChannel(new Float32Array(data), 0);
    } else if (/^snd_[0-9A-Z]{26}$/.test(cue.sound)) {
      try {
        buf = await ctx.decodeAudioData(await (await fetch(`/api/sounds/${cue.sound}`)).arrayBuffer());
      } catch {
        buf = null; // a missing sound stays silent rather than breaking the page
      }
    }
    if (buf) buffers.current.set(key, buf);
    return buf;
  }, []);

  const play = useCallback(
    (cues: HoverCue[]) => {
      if (!enabled || cues.length === 0) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== "running") return; // not unlocked yet: no sound until the first click
      stop();
      const start = ctx.currentTime + 0.02;
      for (const cue of cues) {
        void bufferFor(ctx, cue).then((buf) => {
          if (!buf) return;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.value = cue.gain * 0.8;
          let node: AudioNode = src.connect(g);
          if (cue.pan !== 0 && typeof ctx.createStereoPanner === "function") {
            const p = ctx.createStereoPanner();
            p.pan.value = cue.pan;
            node = node.connect(p);
          }
          node.connect(ctx.destination);
          src.onended = () => active.current.delete(src);
          active.current.add(src);
          src.start(Math.max(ctx.currentTime, start + cue.atMs / 1000));
        });
      }
    },
    [enabled, ensureContext, stop, bufferFor],
  );

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* not remembered: fine */
    }
    if (next) ensureContext(); // this click is the gesture that unlocks audio
    else stop();
  }, [enabled, ensureContext, stop]);

  const api = useMemo(() => ({ enabled, toggle, play, stop }), [enabled, toggle, play, stop]);
  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}

/** Header switch. `look` only changes styling. */
export function SoundToggle({ look }: { look: "playful" | "studio" }) {
  const { enabled, toggle } = useSound();
  const cls =
    look === "studio"
      ? `rounded-[var(--radius)] border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] ${enabled ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-[var(--color-border)]"}`
      : `rounded-full px-4 py-2 ${enabled ? "bg-[var(--color-accent)]" : "hover:bg-[var(--color-accent)]/40"}`;
  return (
    <button type="button" className={cls} aria-pressed={enabled} onClick={toggle} title={enabled ? "Hover an icon to hear it" : "Turn sound on, then hover an icon to hear it"}>
      {look === "studio" ? (enabled ? "● Sound on" : "○ Sound off") : enabled ? "🔊 Sound on" : "🔇 Sound off"}
    </button>
  );
}

/**
 * Wraps a card or tile: on hover (or keyboard focus) restarts the icon's animation from the first frame and plays its
 * sound cues in sync; on leave, stops the sound and pauses the animation.
 */
export function HoverSound({ cues, children, className, keepPlaying }: { cues: HoverCue[]; children: ReactNode; className?: string; /** Icons that animate on their own (hero): don't pause on leave. */ keepPlaying?: boolean }) {
  const { play, stop } = useSound();
  const ref = useRef<HTMLDivElement>(null);
  const animations = () => ref.current?.querySelector("svg")?.getAnimations({ subtree: true }) ?? [];
  const enter = () => {
    for (const a of animations()) {
      a.currentTime = 0;
      a.play();
    }
    play(cues);
  };
  const leave = () => {
    if (!keepPlaying) for (const a of animations()) a.pause();
    stop();
  };
  return (
    <div ref={ref} className={className} onPointerEnter={(e) => e.pointerType !== "touch" && enter()} onPointerLeave={leave} onFocus={enter} onBlur={leave} data-hover-sound={cues.length > 0 ? "" : undefined}>
      {children}
    </div>
  );
}
