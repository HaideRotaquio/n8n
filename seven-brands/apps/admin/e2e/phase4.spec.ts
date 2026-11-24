import { expect, test } from "@playwright/test";
import { encodeWav } from "@sb/audio";
import { BEATING_HEART } from "@sb/asset";
import { createDb, createProduct, getBrandBySlug, reviewAsset, saveAssetDefinition, type DbHandle } from "@sb/db";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signIn } from "./helpers";
import { OWNER } from "./users";

test.describe.configure({ mode: "serial" });

let h: DbHandle;
let productId = "";
test.beforeAll(async () => {
  h = createDb(E2E_DATABASE_URL, { max: 2 });
  const def = structuredClone(BEATING_HEART);
  def.slug = "phase4-heart";
  def.name = "Phase Four Heart";
  const saved = await saveAssetDefinition(h.db, { actorUserId: null }, def);
  await reviewAsset(h.db, { actorUserId: null }, { assetId: saved.asset.id, decision: "approved" });
  const mood = (await getBrandBySlug(h.db, "moodicons"))!;
  productId = (await createProduct(h.db, { actorUserId: null }, { brandId: mood.id, slug: "phase4-heart", title: "Phase Four Heart", kind: "single", assetIds: [saved.asset.id] })).id;
});
test.afterAll(async () => {
  await h?.close();
});

test("owner adds a licensed sound and swaps it into an asset as a new version", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/sounds");
  const tone = Float32Array.from({ length: 24_000 }, (_, i) => 0.25 * Math.sin((2 * Math.PI * 523 * i) / 48_000));
  await page.getByLabel(/WAV file/).setInputFiles({ name: "chime.wav", mimeType: "audio/wav", buffer: Buffer.from(encodeWav([tone], 48_000)) });
  await page.getByLabel("Name").fill("Studio Chime");
  await page.getByLabel("Author").fill("Seven Brands");
  await page.getByLabel("License or source").fill("Own recording");
  await page.getByRole("button", { name: "Upload sound" }).click();
  await expect(page.getByText("Confirm that we may use and sell this sound.")).toBeVisible();
  await page.getByLabel(/I confirm we may use this sound/).check();
  await page.getByRole("button", { name: "Upload sound" }).click();
  await expect(page.getByText(/Added \(0\.5 s, normalized to -1[56]\.\d LUFS\)/)).toBeVisible();
  await expect(page.getByRole("cell", { name: /Studio Chime/ })).toBeVisible();

  await page.goto("/assets?brand=moodicons");
  await page.getByRole("link", { name: /Phase Four Heart/ }).click();
  await page.waitForURL(/\/assets\/ast_/);
  await page.getByRole("button", { name: "Replace sound (new version)" }).click();
  await expect(page.getByText(/Saved as version 2 \(QA 100\/100\)/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Studio Chime \(library\)/)).toBeVisible();
});

test("catalog writer suggests copy that only changes the product when applied", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto(`/catalog/${productId}`);
  await page.getByRole("button", { name: "Suggest copy" }).click();
  await expect(page.getByText(/Queued \(Fixture outputs \(not AI\)/)).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: "Apply title and description" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByLabel("Description")).toHaveValue("");
  await page.getByRole("button", { name: "Apply title and description" }).click();
  await expect(page.getByText("Applied.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Description")).toHaveValue(/Fixture copy, not AI/);
});

test("launch drafts report what's missing instead of creating half-empty products", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/catalog");
  await page.getByRole("button", { name: /Create SonicGlyphs launch drafts/ }).click();
  await expect(page.getByText(/0 draft products created, 0 already existed\. 16 skipped/)).toBeVisible();
});
