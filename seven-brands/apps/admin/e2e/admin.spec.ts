import { expect, test, type Page } from "@playwright/test";
import { MANAGER, OWNER } from "./users";

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test.describe("signed out", () => {
  test("pages redirect to login and APIs return 401", async ({ page, request }) => {
    await page.goto("/brands");
    await expect(page).toHaveURL(/\/login$/);
    expect((await request.get("/api/v1/brands")).status()).toBe(401);
    const health = await request.get("/api/health");
    expect(await health.json()).toEqual({ status: "ok", db: "ok" });
    expect(health.headers()["x-frame-options"]).toBe("DENY");
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill("not-the-password-at-all");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });
});

test.describe("owner", () => {
  test("sees all seven brands and edits one, with an audit entry", async ({ page }) => {
    await signIn(page, OWNER);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Brands" }).click();
    await expect(page.getByRole("heading", { name: "Brands" })).toBeVisible();
    for (const name of ["Moodicons", "SonicGlyphs", "LearnIcons", "ShopMotion", "CineGlyphs", "AtmosIcons", "AliveUI"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await page.getByRole("link", { name: /Moodicons/ }).first().click();
    await page.getByLabel("Tagline").fill("Feelings, animated — edited in E2E");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Brand settings saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Tagline")).toHaveValue("Feelings, animated — edited in E2E");

    await page.goto("/audit");
    await expect(page.getByRole("cell", { name: "brand.update" }).first()).toBeVisible();
  });

  test("invalid domain shows a field error and saves nothing", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/brands/sonicglyphs");
    await page.getByLabel("Domains").fill("https://Not A Domain");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Domains")).toHaveValue("sonicglyphs.localhost");
  });

  test("changes a brand's business status", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/brands/cineglyphs");
    await page.getByLabel("Status").selectOption("in_development");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText("Status updated.")).toBeVisible();
  });

  test("planned sections say they are not built", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/orders");
    await expect(page.getByText("Not built yet — scheduled for Phase 3")).toBeVisible();
  });

  test("infrastructure checks pass for database and storage", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/infrastructure");
    const db = page.getByRole("row", { name: /Database/ });
    await expect(db).toContainText("OK");
    await expect(db).toContainText(/\d+ migrations applied/);
    await expect(page.getByRole("row", { name: /Object storage/ })).toContainText("OK");
  });
});

test.describe("brand manager (Moodicons only)", () => {
  test("only sees and edits their own brand", async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto("/brands");
    await expect(page.getByText("Moodicons", { exact: true })).toBeVisible();
    await expect(page.getByText("SonicGlyphs", { exact: true })).toHaveCount(0);

    await page.goto("/brands/sonicglyphs");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Team & roles" })).toHaveCount(0);
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
    await page.goto("/team");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();

    await page.goto("/brands/moodicons");
    await expect(page.getByText("Only owners and administrators can change status.")).toBeVisible();
  });

  test("API enforces brand scope and same-origin writes", async ({ page }) => {
    await signIn(page, MANAGER);
    const api = page.request;
    const list = await (await api.get("/api/v1/brands")).json();
    expect(list.data.map((b: { slug: string }) => b.slug)).toEqual(["moodicons"]);
    expect((await api.get("/api/v1/brands/sonicglyphs")).status()).toBe(404);
    expect(
      (await api.patch("/api/v1/brands/sonicglyphs", { data: { tagline: "hijack" } })).status(),
    ).toBe(404);

    const ok = await api.patch("/api/v1/brands/moodicons", {
      data: { tagline: "Updated via API" },
      headers: { origin: "http://localhost:3199" },
    });
    expect(ok.status()).toBe(200);

    const bad = await api.patch("/api/v1/brands/moodicons", { data: { slug: "aliveui" } });
    expect(bad.status()).toBe(400);

    const crossSite = await api.patch("/api/v1/brands/moodicons", {
      data: { tagline: "csrf" },
      headers: { origin: "https://evil.example" },
    });
    expect(crossSite.status()).toBe(403);
  });
});

test("layout has no horizontal scroll on a phone", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await signIn(page, OWNER);
  for (const path of ["/", "/brands", "/brands/moodicons"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});
