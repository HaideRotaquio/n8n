import { describe, expect, it } from "vitest";
import { BEATING_HEART } from "./fixtures";
import {
  AssetDefinition,
  cubicBezier,
  cueTime,
  easeProgress,
  evaluateTrack,
  localTime,
  parseAssetDefinition,
  renderAnimatedSvgString,
  renderFrameSvg,
  runQa,
  springAt,
  totalDuration,
} from "./index";

const heart = () => parseAssetDefinition(structuredClone(BEATING_HEART));

describe("schema", () => {
  it("accepts the fixture", () => {
    expect(heart().name).toBe("Beating Heart");
  });
  it("rejects script-like path data and unknown fields", () => {
    const bad = structuredClone(BEATING_HEART) as any;
    bad.layers[0].children[0].shape.d = "M0 0 L10 10\"/><script>alert(1)</script>";
    expect(AssetDefinition.safeParse(bad).success).toBe(false);
    const extra = structuredClone(BEATING_HEART) as any;
    extra.layers[0].onclick = "alert(1)";
    expect(AssetDefinition.safeParse(extra).success).toBe(false);
  });
  it("rejects non-hex colors (no url() or CSS injection)", () => {
    const bad = structuredClone(BEATING_HEART) as any;
    bad.tokens.primary = "url(javascript:alert(1))";
    expect(AssetDefinition.safeParse(bad).success).toBe(false);
  });
  it("requires exactly one of at/marker on cues", () => {
    const bad = structuredClone(BEATING_HEART) as any;
    bad.sounds[0].at = 10;
    expect(AssetDefinition.safeParse(bad).success).toBe(false);
  });
});

describe("easing", () => {
  it("cubic-bezier matches endpoints and is monotonic for ease-in-out", () => {
    const f = cubicBezier(0.42, 0, 0.58, 1);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(0.5)).toBeCloseTo(0.5, 3);
    let prev = 0;
    for (let p = 0; p <= 1; p += 0.05) {
      expect(f(p)).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = f(p);
    }
  });
  it("underdamped springs overshoot then settle; overdamped do not overshoot", () => {
    const under = { stiffness: 300, damping: 10 };
    const values = Array.from({ length: 100 }, (_, i) => springAt(i * 10, under));
    expect(Math.max(...values)).toBeGreaterThan(1.05);
    expect(springAt(3000, under)).toBeCloseTo(1, 2);
    const over = { stiffness: 100, damping: 60 };
    for (let i = 0; i < 200; i++) expect(springAt(i * 10, over)).toBeLessThanOrEqual(1 + 1e-9);
    expect(springAt(0, under)).toBe(0);
  });
  it("snaps to the target at segment end", () => {
    expect(easeProgress({ spring: { stiffness: 50, damping: 2, mass: 1 } }, 100, 100)).toBe(1);
    expect(easeProgress("step", 50, 100)).toBe(0);
  });
});

describe("tracks & time", () => {
  it("interpolates between keyframes and clamps outside", () => {
    const k = [
      { at: 100, value: 0 },
      { at: 200, value: 10 },
    ];
    expect(evaluateTrack(k, 0)).toBe(0);
    expect(evaluateTrack(k, 150)).toBe(5);
    expect(evaluateTrack(k, 999)).toBe(10);
  });
  it("maps playback time through loop settings", () => {
    const tl = heart().timeline;
    expect(totalDuration(tl)).toBe(Infinity);
    expect(localTime(tl, 2500)).toBe(500);
    const twice = { ...tl, loop: 2 as const };
    expect(localTime(twice, 1500)).toBe(500);
    expect(localTime(twice, 2500)).toBe(1000);
    expect(localTime({ ...tl, loop: false }, 5000)).toBe(1000);
  });
  it("resolves cue times from markers", () => {
    const ad = heart();
    expect(cueTime(ad.sounds[0]!, ad.timeline)).toBe(0);
  });
});

describe("rendering", () => {
  it("renders a static frame with the animated transform applied", () => {
    const ad = heart();
    const atRest = renderFrameSvg(ad, 0);
    const atPeak = renderFrameSvg(ad, 120);
    expect(atRest).not.toContain("scale(");
    expect(atPeak).toContain("scale(1.18 1.18)");
    expect(atPeak).toContain('fill="#E8336D"');
    expect(atPeak).toContain("<title>Beating red heart</title>");
  });
  it("applies customer color overrides but ignores unknown or invalid tokens", () => {
    const svg = renderFrameSvg(heart(), 0, { tokens: { primary: "#00AA00", bogus: "#000000", highlight: "red" } });
    expect(svg).toContain('fill="#00AA00"');
    expect(svg).toContain('fill="#FFFFFF"');
  });
  it("escapes the accessible label", () => {
    const ad = heart();
    ad.a11y.label = 'Heart <script>"x"</script>';
    const svg = renderFrameSvg(ad, 0);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
  it("produces an animated SVG with CSS keyframes and a reduced-motion fallback", () => {
    const svg = renderAnimatedSvgString(heart());
    expect(svg).toMatch(/@keyframes k-heart\{0%\{/);
    expect(svg).toContain("animation:k-heart 1000ms linear infinite both");
    expect(svg).toContain("prefers-reduced-motion:reduce");
    expect(svg).not.toMatch(/<script|on[a-z]+=/i);
    const hover = renderAnimatedSvgString(heart(), { playOn: "hover", speed: 2 });
    expect(hover).toContain("animation-play-state:paused");
    expect(hover).toContain("500ms");
  });
});

describe("QA", () => {
  it("passes a good asset", () => {
    const r = runQa(heart());
    expect(r.errors).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.stats.layers).toBe(3);
  });
  it("reports schema errors without throwing", () => {
    const r = runQa({ nope: true });
    expect(r.passed).toBe(false);
    expect(r.errors[0]?.code).toBe("schema");
  });
  it("finds semantic errors and warnings", () => {
    const ad = heart() as any;
    ad.timeline.tracks.push({ target: "ghost", property: "rotate", keyframes: [{ at: 0, value: 0 }, { at: 2000, value: 90 }] });
    ad.timeline.tracks.push({ target: "shine", property: "translateX", keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 5 }] });
    ad.layers[0].children[1].fill = { token: "missing" };
    const r = runQa(ad);
    const codes = r.errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["unknown-target", "keyframe-after-end", "unknown-token"]));
    expect(r.warnings.map((w) => w.code)).toContain("loop-seam");
    expect(r.passed).toBe(false);
  });
  it("ignores seams that are invisible (transparent) or full-turn rotations", () => {
    const ad = heart() as any;
    ad.timeline.tracks.push({ target: "shine", property: "rotate", keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 360 }] });
    ad.timeline.tracks.push({ target: "shine", property: "translateY", keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 9 }] });
    ad.timeline.tracks.push({ target: "shine", property: "opacity", keyframes: [{ at: 0, value: 0 }, { at: 500, value: 1 }, { at: 1000, value: 0 }] });
    expect(runQa(ad).warnings).toEqual([]);
  });
  it("warns when a spring has not settled by the next keyframe", () => {
    const ad = heart() as any;
    ad.timeline.tracks[0].keyframes[1].ease = { spring: { stiffness: 20, damping: 1, mass: 1 } };
    expect(runQa(ad).warnings.map((w) => w.code)).toContain("spring-unsettled");
  });
});
