import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { forwardRef, useImperativeHandle, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal stand-ins for the native modules: enough to see what the component asks them to do.
const calls: string[] = [];
let reduceMotion = false;
let reduceListener: ((v: boolean) => void) | undefined;
const player = { volume: 1, play: () => calls.push("audio.play"), pause: () => calls.push("audio.pause"), seekTo: async (s: number) => void calls.push(`audio.seek:${s}`) };

vi.mock("react-native", () => ({
  View: (p: { children?: ReactNode }) => createElement("View", p, p.children),
  Pressable: (p: { children?: ReactNode }) => createElement("Pressable", p, p.children),
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => reduceMotion,
    addEventListener: (_: string, fn: (v: boolean) => void) => ((reduceListener = fn), { remove: () => (reduceListener = undefined) }),
  },
}));
vi.mock("expo-audio", () => ({ useAudioPlayer: (src: unknown) => (calls.push(`audio.source:${String(src)}`), player) }));
vi.mock("lottie-react-native", () => ({
  default: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ play: () => calls.push("lottie.play"), reset: () => calls.push("lottie.reset") }));
    return createElement("Lottie", props);
  }),
}));

const { DaosIcon } = await import("./DaosIcon");

async function render(props: Record<string, unknown> = {}): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(DaosIcon, { animation: { v: "5" } as never, sound: 7, durationMs: 1000, stillFrameMs: 250, label: "Happy face", ...props }));
  });
  return r;
}

beforeEach(() => {
  calls.length = 0;
  reduceMotion = false;
});

describe("DaosIcon", () => {
  it("autoplays the Lottie loop silently and replays motion with sound on tap", async () => {
    const r = await render();
    const lottie = r.root.findByType("Lottie" as never);
    expect(lottie.props).toMatchObject({ loop: true, progress: undefined, style: { width: 64, height: 64 } });
    expect(calls).toContain("audio.source:7");
    expect(calls).toContain("lottie.play"); // started once Reduce Motion was known to be off
    expect(calls).not.toContain("audio.play");
    const button = r.root.findByType("Pressable" as never);
    expect(button.props).toMatchObject({ accessibilityRole: "button", accessibilityLabel: "Happy face" });
    calls.length = 0;
    await act(async () => button.props.onPress());
    expect(calls).toEqual(["lottie.reset", "lottie.play", "audio.seek:0", "audio.play"]);
  });

  it("in always mode the sound restarts with each animation loop", async () => {
    const r = await render({ soundMode: "always" });
    expect(calls.filter((c) => c === "audio.play")).toHaveLength(1);
    await act(async () => r.root.findByType("Lottie" as never).props.onAnimationLoop());
    expect(calls.filter((c) => c === "audio.play")).toHaveLength(2);
  });

  it("shows the still frame and doesn't autoplay when Reduce Motion is on, and reacts to changes", async () => {
    reduceMotion = true;
    const r = await render({ soundMode: "always" });
    expect(r.root.findByType("Lottie" as never).props).toMatchObject({ loop: false, progress: 0.25 });
    expect(calls).not.toContain("audio.play");
    expect(calls).not.toContain("lottie.play");
    await act(async () => reduceListener?.(false));
    expect(r.root.findByType("Lottie" as never).props).toMatchObject({ loop: true, progress: undefined });
    expect(calls).toContain("lottie.play");
    expect(calls).toContain("audio.play");
  });

  it("is a plain image when sound is off and there's no onPress", async () => {
    const r = await render({ soundMode: "off" });
    expect(r.root.findAllByType("Pressable" as never)).toHaveLength(0);
    expect(r.root.findByType("View" as never).props).toMatchObject({ accessibilityRole: "image", accessibilityLabel: "Happy face" });
  });
});
