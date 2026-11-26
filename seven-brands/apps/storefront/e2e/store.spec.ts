import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OTHER_STORE_URL, STORE_URL, UNKNOWN_HOST_URL } from "../playwright.config";

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

test("developer API: public search, then license-checked icon files for the CLI and AI agents", async ({ page }) => {
  await page.goto("/developers");
  await expect(page.getByRole("heading", { name: "For developers and AI agents" })).toBeVisible();
  await expect(page.getByText("claude mcp add moodicons").first()).toBeVisible();
  const llms = await page.evaluate(async () => (await fetch("/llms.txt")).text());
  expect(llms).toContain("npx -y moodicons mcp");

  const search = await page.evaluate(async () => (await fetch("/api/v1/icons?q=heart")).json());
  expect(search.icons[0]).toMatchObject({ slug: "beating-heart", hasSound: true });
  expect(search.icons[0].products.map((p: { slug: string }) => p.slug).sort()).toEqual(["beating-heart", "free-heart"]);
  expect(search.icons[0].previewUrl).toContain("/api/v1/icons/beating-heart/preview.svg");
  const detail = await page.evaluate(async () => (await fetch("/api/v1/icons/beating-heart")).json());
  expect(detail.formats).toContain("react");
  const preview = await page.evaluate(async () => {
    const r = await fetch("/api/v1/icons/beating-heart/preview.svg");
    return { type: r.headers.get("content-type"), body: await r.text() };
  });
  expect(preview.type).toContain("image/svg+xml");
  expect(preview.body).toContain("<svg");

  const call = (code: string | null, format: string) =>
    page.evaluate(
      async ([c, f]) => {
        const r = await fetch("/api/v1/icons/beating-heart/files", { method: "POST", headers: { "content-type": "application/json", ...(c ? { authorization: `Bearer ${c}` } : {}) }, body: JSON.stringify({ format: f }) });
        return { status: r.status, body: await r.json() };
      },
      [code, format] as const,
    );
  expect(await call(null, "react")).toMatchObject({ status: 401, body: { error: "license_required" } });
  expect(await call("MOOD-AAAA-BBBB-CCCC-DDDD", "react")).toMatchObject({ status: 401, body: { error: "invalid_license" } });
  expect(await call(licenseCode, "pdf")).toMatchObject({ status: 400, body: { error: "bad_format" } });
  const ok = await call(licenseCode, "react");
  expect(ok.status).toBe(200);
  expect(ok.body.files[0].path).toBe("BeatingHeart.tsx");
  expect(ok.body.files[0].content).toContain("export function BeatingHeart");
  expect(ok.body).toMatchObject({ needsPlayer: true, license: { code: licenseCode, licenseType: "commercial" } });
  const wc = await call(licenseCode, "web-component");
  expect(wc.body.files[0].path).toBe("beating-heart.json");
  expect(wc.body.usage).toContain('<daos-asset src="icons/beating-heart.json"');

  const flutter = await call(licenseCode, "flutter");
  expect(flutter.body.files.map((f: { path: string }) => f.path)).toEqual(["beating-heart.lottie.json", "beating-heart.wav", "beating_heart_icon.dart"]);
  expect(atob(flutter.body.files[1].content).slice(0, 4)).toBe("RIFF");
  const rn = await call(licenseCode, "react-native");
  expect(rn.body.files[2].content).toContain('from "daos-icons-react-native"');

  // A Moodicons code means nothing on another brand's store.
  await page.goto(`${OTHER_STORE_URL}/developers`);
  const other = await call(licenseCode, "react");
  expect(other).toMatchObject({ status: 401, body: { error: "invalid_license" } });
});

test("the built CLI and its MCP server install a purchased icon into a project", async () => {
  const cliDir = path.resolve(process.cwd(), "../../packages/cli");
  const cli = path.join(cliDir, "dist/moodicons/cli.js");
  if (!existsSync(cli)) execFileSync("npx", ["tsx", "scripts/build.ts"], { cwd: cliDir, stdio: "ignore" });
  const projectDir = mkdtempSync(path.join(os.tmpdir(), "sb-e2e-project-"));
  writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ dependencies: { react: "19" } }));
  mkdirSync(path.join(projectDir, "src"));
  const store = `http://localhost:${new URL(STORE_URL).port}`;
  const env = { ...process.env, MOODICONS_STORE_URL: store, SEVENBRANDS_CONFIG_DIR: mkdtempSync(path.join(os.tmpdir(), "sb-e2e-cfg-")) };
  const run = (args: string[], extra: Record<string, string> = {}) => execFileSync("node", [cli, ...args], { cwd: projectDir, env: { ...env, ...extra }, encoding: "utf8" });

  expect(run(["search", "heart"])).toContain("beating-heart");
  expect(() => run(["add", "beating-heart"])).toThrow(); // no license yet
  expect(run(["login", licenseCode])).toContain("Saved");
  expect(run(["add", "beating-heart"])).toContain("BeatingHeart");
  const icons = path.join(projectDir, "src/components/icons");
  expect(readFileSync(path.join(icons, "BeatingHeart.tsx"), "utf8")).toContain("export function BeatingHeart");
  expect(readFileSync(path.join(icons, "daos-player.js"), "utf8")).toContain("DAOS player");
  expect(readFileSync(path.join(icons, "ICON-LICENSES.md"), "utf8")).toContain(licenseCode);

  // The MCP server over stdio, as an AI coding agent would use it.
  const child = spawn("node", [cli, "mcp"], { cwd: projectDir, env: { ...env, MOODICONS_LICENSE: licenseCode } });
  const replies = new Map<number, any>();
  let buf = "";
  child.stdout.on("data", (d: Buffer) => {
    buf += d.toString();
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) {
        const msg = JSON.parse(line);
        if (msg.id !== undefined) replies.set(msg.id, msg);
      }
    }
  });
  const send = (msg: object) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);
  const reply = async (id: number) => {
    await expect.poll(() => replies.has(id), { timeout: 15_000 }).toBe(true);
    return replies.get(id);
  };
  try {
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e-agent", version: "1" } } });
    expect((await reply(1)).result.serverInfo.name).toBe("moodicons");
    send({ method: "notifications/initialized" });
    send({ id: 2, method: "tools/call", params: { name: "search_icons", arguments: { query: "heart" } } });
    expect(JSON.stringify((await reply(2)).result.content)).toContain("beating-heart");
    send({ id: 3, method: "tools/call", params: { name: "add_icon", arguments: { slug: "beating-heart", format: "web-component", directory: "public/icons" } } });
    const added = (await reply(3)).result;
    expect(added.isError).toBeFalsy();
    expect(JSON.stringify(added.content)).toContain("daos-asset");
    expect(existsSync(path.join(projectDir, "public/icons/beating-heart.json"))).toBe(true);
  } finally {
    child.kill();
  }
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

test("scroll to play: the strip's icons follow the scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto("/");
  const strip = page.getByRole("region", { name: "Scroll to play them" });
  await expect(strip).toBeVisible();
  // Snapshot of every layer's transform in the strip (what is drawn right now).
  const frame = () => strip.evaluate((el) => Array.from(el.querySelectorAll("svg [data-layer]"), (n) => n.getAttribute("transform") ?? "-").join("|"));
  await strip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150); // let the scroll handler draw the frame for this position
  const start = await page.evaluate(() => window.scrollY);
  const a = await frame();
  // Walk down in small steps: the icon must pass through several different frames (it beats, then rests).
  const seen = new Set<string>([a]);
  for (let i = 1; i <= 12; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), start + i * 30);
    await page.waitForTimeout(60);
    seen.add(await frame());
  }
  expect(seen.size).toBeGreaterThan(1);
  // Back to where we started: exactly the same frame (scroll position, not time, decides).
  await page.evaluate((y) => window.scrollTo(0, y), start);
  await page.waitForTimeout(150);
  expect(await frame()).toBe(a);
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
