import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
import { OTHER_STORE_URL, UNKNOWN_HOST_URL } from "../playwright.config";

test.describe.configure({ mode: "serial" });

const BUYER = { name: "Ada Lovelace", email: `ada+${Date.now()}@example.test`, password: "correct-horse-battery" };
const OTHER = { name: "Grace Hopper", email: `grace+${Date.now()}@example.test`, password: "another-long-passphrase" };

async function signUp(page: Page, who: typeof BUYER, next = "/") {
  await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email", { exact: true }).fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

let licenseCode = "";

test("storefront is themed per brand and lists only that brand's products", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Moodicons", exact: true })).toBeVisible();
  await expect(page.getByText(/Test mode/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Products" }).getByRole("link", { name: /Beating Heart/ })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--color-primary").trim());
  expect(bg).toMatch(/^#/);

  await page.goto(`${OTHER_STORE_URL}/`);
  await expect(page.getByRole("link", { name: "SonicGlyphs", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Beating Heart/ })).toHaveCount(0);
  // A different layout family, not a color swap.
  expect(await page.evaluate(() => document.body.dataset.layout)).toBe("studio-dark");
  expect((await page.goto(`${OTHER_STORE_URL}/products/beating-heart`))!.status()).toBe(404);
  expect((await page.goto(`${UNKNOWN_HOST_URL}/`))!.status()).toBe(404);
});

test("a visitor must sign in to buy", async ({ page }) => {
  await page.goto("/products/beating-heart");
  await expect(page.getByRole("heading", { name: "Beating Heart" })).toBeVisible();
  await expect(page.getByText("$5.00")).toBeVisible();
  await expect(page.getByText("$15.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy now" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "create an account" })).toBeVisible();
});

test("buy, download a licensed package and verify the license", async ({ page }) => {
  await signUp(page, BUYER, "/products/beating-heart");
  await page.getByLabel(/Commercial/).check();
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL(/\/checkout\/test\?session=chk_/);
  await expect(page.getByText("$15.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Pay \$15\.00 \(test\)/ }).click();
  await page.waitForURL(/\/account\?purchased=/);
  await expect(page.getByText("Your purchase is ready below")).toBeVisible();
  await expect(page.getByText("Commercial license")).toBeVisible();
  licenseCode = (await page.locator("code").first().textContent())!.trim();
  expect(licenseCode).toMatch(/^MOOD-[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download Beating Heart/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("beating-heart-v1.zip");
  const files = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const license = strFromU8(files["LICENSE.txt"]!);
  expect(license).toContain("COMMERCIAL LICENSE");
  expect(license).toContain(licenseCode);
  expect(license).toContain("Ada Lovelace");
  expect(license).not.toContain("PREVIEW");
  expect(Object.keys(files).some((f) => f.endsWith(".svg"))).toBe(true);

  await page.getByRole("link", { name: "View certificate" }).click();
  await expect(page.getByText(licenseCode).first()).toBeVisible();

  await page.goto(`/licenses/verify?code=${licenseCode.toLowerCase()}`);
  await expect(page.getByText("Valid license")).toBeVisible();
  await expect(page.getByText("A. L.")).toBeVisible();
  await expect(page.getByText(BUYER.email)).toHaveCount(0);
  const api = await page.evaluate(async (code) => (await fetch(`/api/v1/licenses/verify?code=${code}`)).json(), licenseCode);
  expect(api).toMatchObject({ valid: true, status: "active", brand: "Moodicons", licenseType: "commercial" });

  const data = await page.evaluate(async () => (await fetch("/account/data")).json());
  expect(data.orders).toHaveLength(1);
  expect(data.orders[0]).toMatchObject({ totalCents: 1500, status: "paid" });
});

test("another customer can't use someone else's entitlement, and sessions don't cross brands", async ({ page }) => {
  await signUp(page, OTHER, "/account");
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  // Forge a download request for an entitlement id that isn't theirs.
  const status = await page.evaluate(async () => {
    const body = new URLSearchParams({ entitlementId: "ent_01AAAAAAAAAAAAAAAAAAAAAAAA", assetId: "ast_01AAAAAAAAAAAAAAAAAAAAAAAA" });
    const res = await fetch("/api/downloads", { method: "POST", body, redirect: "manual" });
    return res.type === "opaqueredirect" ? "redirect" : String(res.status);
  });
  expect(status).toBe("redirect");
  await page.goto("/account?error=not_entitled");
  await expect(page.getByText("You don't have access to that item.")).toBeVisible();
  // Signed in at Moodicons, but not at SonicGlyphs.
  await page.goto(`${OTHER_STORE_URL}/account`);
  await page.waitForURL(/\/sign-in/);
});

test("search, categories and the live preview (sound off by default)", async ({ page }) => {
  await page.goto("/?q=heart");
  await expect(page.getByRole("list", { name: "Products" }).getByRole("link")).toHaveCount(2);
  await page.goto("/?q=zebra");
  await expect(page.getByText(/No icons match/)).toBeVisible();
  await page.goto("/");
  await page.getByRole("navigation", { name: "Categories" }).getByRole("link").nth(1).click();
  await expect(page).toHaveURL(/category=/);
  await page.goto("/products/beating-heart");
  await expect(page.getByTestId("live-preview").locator("svg")).toBeVisible();
  const sound = page.getByRole("button", { name: /Turn sound on/ });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.goto("/help/licenses");
  await expect(page.getByRole("heading", { name: "Commercial" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enterprise" })).toHaveCount(0); // Moodicons doesn't sell it
});

test("free products are claimed without checkout and arrive with a license", async ({ page }) => {
  await page.goto("/sign-in?next=/products/free-heart");
  await page.getByLabel("Email").fill(BUYER.email);
  await page.getByLabel("Password").fill(BUYER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/free-heart/);
  await page.getByRole("button", { name: "Get it free" }).click();
  await page.waitForURL(/\/account\?claimed=1/);
  await expect(page.getByText("It's yours!")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free Heart" })).toBeVisible();
});

test("hover to hear: silent until sound is switched on, then hovering an icon plays it", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__starts = 0;
    const o = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a: any[]) {
      (window as any).__starts++;
      return o.apply(this, a as any);
    };
  });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /Sound off/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const card = page.getByRole("list", { name: "Products" }).locator("[data-hover-sound]").first();
  await card.hover();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).__starts)).toBe(0);

  await toggle.click();
  await expect(page.getByRole("button", { name: /Sound on/ })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await card.hover();
  await expect.poll(() => page.evaluate(() => (window as any).__starts), { timeout: 5000 }).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByRole("button", { name: /Sound on/ })).toBeVisible(); // remembered
});

test("test checkout can be cancelled and unknown sessions are hidden", async ({ page }) => {
  await page.goto("/sign-in?next=/products/beating-heart");
  await page.getByLabel("Email").fill(BUYER.email);
  await page.getByLabel("Password").fill(BUYER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/products\/beating-heart/);
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL(/\/checkout\/test/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  expect((await page.goto("/checkout/test?session=chk_01AAAAAAAAAAAAAAAAAAAAAAAA"))!.status()).toBe(404);
});
