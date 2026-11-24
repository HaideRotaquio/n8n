import { expect, test } from "@playwright/test";
import { signIn, waitForJob } from "./helpers";
import { MANAGER, OWNER } from "./users";

test.describe.configure({ mode: "serial" });

test("rig job produces SonicGlyphs assets that pass QA", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/production");
  await page.getByLabel("Brand").selectOption({ label: "SonicGlyphs" });
  await page.getByRole("button", { name: "Queue job" }).click();
  await expect(page.getByText(/Queued 14 assets/)).toBeVisible();
  await page.getByRole("link", { name: "View job" }).click();
  await page.waitForURL(/\/production\/job_/);
  const jobUrl = page.url();
  expect(await waitForJob(page, jobUrl)).toBe("succeeded");
  await expect(page.getByRole("link", { name: "bell" })).toBeVisible();
  await expect(page.getByText("$0.0000")).toBeVisible();
});

test("asset viewer plays, customizes colors and supports review", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/assets?brand=sonicglyphs");
  await page.getByRole("link", { name: /Ringing Bell/ }).click();
  await expect(page.getByRole("heading", { name: "Ringing Bell" })).toBeVisible();
  const host = page.getByTestId("viewer-host");
  await expect(host.locator("svg")).toBeVisible();
  // The artwork fills the stage at the chosen size (280 px), not its native 64 px.
  expect((await host.locator("svg").boundingBox())!.width).toBeGreaterThan(250);
  // Animation runs: the bell's transform changes over time.
  const t1 = await host.locator('[data-layer="bell"]').getAttribute("transform");
  await page.waitForTimeout(300);
  const t2 = await host.locator('[data-layer="bell"]').getAttribute("transform");
  expect(t1).not.toBe(t2);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  // Sound is opt-in.
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
  // Color customization reaches the artwork.
  await page.getByLabel("Color line").fill("#ff0000");
  await expect(host.locator('[stroke="#FF0000"]').first()).toBeVisible();
  // QA passed → approve.
  await expect(page.getByText("100/100")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved.")).toBeVisible();
});

test("export job produces downloadable files with honest capability labels", async ({ page, request }) => {
  await signIn(page, OWNER);
  await page.goto("/assets?brand=sonicglyphs");
  await page.getByRole("link", { name: /Spinning Vinyl/ }).click();
  await page.getByRole("button", { name: "Generate exports" }).click();
  await expect(page.getByText(/Export job .* queued/)).toBeVisible();
  const assetUrl = page.url();
  await expect(async () => {
    await page.goto(assetUrl);
    await expect(page.getByRole("cell", { name: "zip", exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("row", { name: /gif .*motion · not interactive · no sound/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /mp4 .*motion · not interactive · sound/ })).toBeVisible();
  const href = await page.getByRole("row", { name: /zip/ }).getByRole("link", { name: "Download" }).getAttribute("href");
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
  // Tampered link is refused.
  expect((await request.get(href!.replace(/sig=[^&]+/, "sig=bad"))).status()).toBe(403);
});

test("AI job via the labelled fixture provider records agent calls and a fixture asset", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/production");
  await page.getByLabel("Brand").selectOption({ label: "Moodicons" });
  await page.getByLabel("Method").selectOption("ai");
  await page.getByLabel("Brief").fill("A celebratory star that sparkles");
  await page.getByRole("button", { name: "Queue job" }).click();
  await expect(page.getByText(/AI job queued \(Fixture outputs \(not AI\)\)/)).toBeVisible();
  await page.getByRole("link", { name: "View job" }).click();
  await page.waitForURL(/\/production\/job_/);
  expect(await waitForJob(page, page.url())).toBe("succeeded");
  await expect(page.getByRole("cell", { name: "creative_director" })).toBeVisible();
  await page.getByRole("link", { name: "sparkle-star" }).click();
  await expect(page.getByText("Fixture — not AI").first()).toBeVisible();
  await expect(page.getByText(/not AI output and is not for sale/)).toBeVisible();
  await page.goto("/agents");
  await expect(page.getByRole("cell", { name: "svg_artist" }).first()).toBeVisible();
  await page.goto("/quality");
  await expect(page.getByText("Sparkle Star")).toBeVisible();
});

test("owner records an expense; the brand manager can't see finances or other brands' assets", async ({ page, browser }) => {
  await signIn(page, OWNER);
  await page.goto("/expenses");
  await page.getByLabel("Description").fill("Neon Launch plan");
  await page.getByLabel("Amount (USD)").fill("19");
  await page.getByLabel("Category").selectOption("infrastructure");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("Expense recorded.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Neon Launch plan" })).toBeVisible();

  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await signIn(m, MANAGER);
  await m.goto("/expenses");
  await expect(m.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  await m.goto("/assets");
  await expect(m.getByText("Ringing Bell")).toHaveCount(0);
  await m.goto("/production");
  await expect(m.getByLabel("Brand").locator("option")).toHaveText(["Moodicons"]);
  await ctx.close();
});
