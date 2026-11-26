import { describe, expect, it } from "vitest";
import {
  applyBrandPatch,
  BrandConfig,
  brandsWith,
  can,
  canAny,
  checkThemeAccessibility,
  contrastRatio,
  isId,
  newId,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  themeToCssVars,
  ulid,
  validateGrant,
  type BrandConfig as BrandConfigT,
} from "./index";

const sample: BrandConfigT = {
  slug: "moodicons",
  name: "Moodicons",
  tagline: "Feelings, animated.",
  description: "Expressive animated icons.",
  category: "Emotional icons",
  domains: ["moodicons.localhost"],
  defaultCurrency: "USD",
  theme: {
    tokens: {
      background: "#FFFFFF",
      surface: "#F7F7F7",
      text: "#111111",
      mutedText: "#555555",
      primary: "#222222",
      primaryText: "#FFFFFF",
      accent: "#FF0066",
      border: "#DDDDDD",
    },
    fonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
    radius: "lg",
    motionPersonality: "bouncy",
  },
  layout: "playful-grid",
  catalog: { categories: [{ slug: "love", label: "Love" }] },
  audiences: ["Creators"],
  marketingChannels: ["TikTok"],
  licenseTypes: ["personal", "commercial"],
  features: { soundPreview: false, customizer: true, developerExports: true, childSafeMode: false },
};

describe("ids", () => {
  it("creates prefixed, sortable ids", () => {
    const a = newId("brd", 1_000);
    const b = newId("brd", 2_000);
    expect(isId(a, "brd")).toBe(true);
    expect(isId(a, "usr")).toBe(false);
    expect(a < b).toBe(true);
    expect(ulid()).toHaveLength(26);
  });
  it("rejects bad prefixes", () => {
    expect(() => newId("BAD")).toThrow();
    expect(isId("brd_short")).toBe(false);
    expect(isId(42)).toBe(false);
  });
});

describe("BrandConfig", () => {
  it("accepts a valid config", () => {
    expect(BrandConfig.parse(sample)).toEqual(sample);
  });
  it("rejects invalid colors and unsafe font stacks", () => {
    const bad = structuredClone(sample);
    bad.theme.tokens.primary = "red";
    expect(BrandConfig.safeParse(bad).success).toBe(false);
    const bad2 = structuredClone(sample);
    bad2.theme.fonts.body = "Inter; } body { display:none";
    expect(BrandConfig.safeParse(bad2).success).toBe(false);
  });
  it("rejects domains with schemes or uppercase", () => {
    const bad = structuredClone(sample);
    bad.domains = ["https://Moodicons.com"];
    expect(BrandConfig.safeParse(bad).success).toBe(false);
  });
  it("applies an admin patch and leaves locked fields alone", () => {
    const next = applyBrandPatch(sample, { tagline: "New tagline" });
    expect(next.tagline).toBe("New tagline");
    expect(next.slug).toBe("moodicons");
    expect(() => applyBrandPatch(sample, { slug: "aliveui" } as never)).toThrow();
  });
  it("patches theme tokens only", () => {
    const tokens = { ...sample.theme.tokens, accent: "#00AA00" };
    const next = applyBrandPatch(sample, { theme: { tokens } });
    expect(next.theme.tokens.accent).toBe("#00AA00");
    expect(next.theme.fonts).toEqual(sample.theme.fonts);
  });
  it("produces CSS variables", () => {
    const vars = themeToCssVars(sample.theme);
    expect(vars["--color-primary-text"]).toBe("#FFFFFF");
    expect(vars["--color-muted-text"]).toBe("#555555");
    expect(vars["--radius"]).toBe("16px");
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
  it("flags low-contrast themes", () => {
    const t = structuredClone(sample.theme);
    t.tokens.mutedText = "#CCCCCC";
    expect(checkThemeAccessibility(t)).toHaveLength(1);
    expect(checkThemeAccessibility(sample.theme)).toEqual([]);
  });
});

describe("rbac", () => {
  it("every role only references known permissions", () => {
    for (const r of ROLES) for (const p of ROLE_PERMISSIONS[r]) expect(PERMISSIONS).toContain(p);
  });
  it("owner can do everything, admin cannot refund", () => {
    expect(can([{ role: "owner", brandId: null }], "order.refund")).toBe(true);
    expect(can([{ role: "admin", brandId: null }], "order.refund")).toBe(false);
    expect(can([{ role: "admin", brandId: null }], "brand.update", "brd_x")).toBe(true);
  });
  it("brand-scoped roles do not leak to other brands or global actions", () => {
    const grants = [{ role: "brand_manager" as const, brandId: "brd_a" }];
    expect(can(grants, "brand.update", "brd_a")).toBe(true);
    expect(can(grants, "brand.update", "brd_b")).toBe(false);
    expect(can(grants, "brand.update")).toBe(false);
  });
  it("no grants means no access", () => {
    expect(can([], "overview.read")).toBe(false);
  });
  it("lists accessible brands", () => {
    expect(brandsWith([{ role: "analyst", brandId: null }], "analytics.read")).toBe("all");
    expect(
      brandsWith(
        [
          { role: "producer", brandId: "brd_a" },
          { role: "support", brandId: "brd_b" },
        ],
        "asset.write",
      ),
    ).toEqual(["brd_a"]);
  });
  it("canAny accepts brand-scoped grants for section access", () => {
    expect(canAny([{ role: "producer", brandId: "brd_a" }], "asset.write")).toBe(true);
    expect(canAny([{ role: "producer", brandId: "brd_a" }], "order.read")).toBe(false);
  });
  it("owner/admin cannot be brand-scoped", () => {
    expect(() => validateGrant({ role: "owner", brandId: "brd_a" })).toThrow();
    expect(() => validateGrant({ role: "producer", brandId: "brd_a" })).not.toThrow();
  });
});

describe("style demand verdict", async () => {
  const { styleVerdict } = await import("./style-demand");
  it("waits for enough downloads and customers", () => {
    expect(styleVerdict(50, 100, 40).kind).toBe("collecting");
    expect(styleVerdict(100, 200, 10).kind).toBe("collecting");
  });
  it("recommends from the 3D share once there is enough data", () => {
    expect(styleVerdict(60, 140, 30)).toMatchObject({ kind: "premium-3d", share: 70 });
    expect(styleVerdict(100, 100, 30)).toMatchObject({ kind: "both", share: 50 });
    expect(styleVerdict(150, 50, 30)).toMatchObject({ kind: "flat-first", share: 25 });
  });
});
