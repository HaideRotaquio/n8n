import { expect, test } from "@playwright/test";
import { BEATING_HEART } from "@sb/asset";
import { handleWebhook, TestPaymentProvider } from "@sb/commerce";
import { newId } from "@sb/core";
import { createCheckoutSession, createDb, ensureCustomer, getBrandBySlug, reviewAsset, saveAssetDefinition, schema, type DbHandle } from "@sb/db";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signIn } from "./helpers";
import { MANAGER, OWNER } from "./users";

test.describe.configure({ mode: "serial" });

let h: DbHandle;
test.beforeAll(async () => {
  h = createDb(E2E_DATABASE_URL, { max: 2 });
  const def = structuredClone(BEATING_HEART);
  def.slug = "commerce-heart";
  def.name = "Commerce Heart";
  const saved = await saveAssetDefinition(h.db, { actorUserId: null }, def);
  await reviewAsset(h.db, { actorUserId: null }, { assetId: saved.asset.id, decision: "approved" });
});
test.afterAll(async () => {
  await h?.close();
});

test("owner exports, prices and publishes a product", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/assets?brand=moodicons");
  await page.getByRole("link", { name: /Commerce Heart/ }).click();
  await page.waitForURL(/\/assets\/ast_/);
  const assetUrl = page.url();
  await page.getByRole("button", { name: "Generate exports" }).click();
  await expect(async () => {
    await page.goto(assetUrl);
    await expect(page.getByRole("cell", { name: "zip", exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 90_000 });

  await page.goto("/catalog/new?brand=moodicons");
  await page.getByLabel("Title").fill("Commerce Heart");
  await page.getByLabel("Slug (URL)").fill("commerce-heart");
  await page.getByLabel(/Commerce Heart/).check();
  await page.getByRole("button", { name: "Create draft product" }).click();
  await page.waitForURL(/\/catalog\/prd_/);
  await expect(page.getByText("Add at least one active price above zero")).toBeVisible();

  await page.getByLabel("License").selectOption("personal");
  await page.getByLabel("Amount (USD)").fill("7");
  await page.getByRole("button", { name: "Save price" }).click();
  await expect(page.getByText("Price saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ready to publish.")).toBeVisible();
  await page.getByRole("button", { name: "Publish to storefront" }).click();
  await expect(page.getByText(/^Published \d{4}-\d{2}-\d{2}\. Buyers get/)).toBeVisible();
  await page.goto("/catalog");
  await expect(page.getByRole("row", { name: /Commerce Heart .*published/ })).toBeVisible();
});

test("a paid order appears and an owner-approved refund revokes the license", async ({ page }) => {
  // A customer buys through the test provider's signed webhook (what the storefront does).
  const brand = (await getBrandBySlug(h.db, "moodicons"))!;
  const userId = newId("usr");
  await h.db.insert(schema.user).values({ id: userId, email: "shopper@e2e.test", name: "Shopper" });
  const customer = await ensureCustomer(h.db, userId, brand.id);
  const { session } = await createCheckoutSession(h.db, { brandId: brand.id, customerId: customer.id, productSlug: "commerce-heart", licenseType: "personal", provider: "test", testMode: true });
  const provider = new TestPaymentProvider("e2e-commerce-test-secret-0123456789");
  const { body, signature } = provider.signedEvent({ type: "paid", id: "evt_e2e_1", orderId: "ord_e2e_1", checkoutSessionId: session.id, currency: "USD", amountCents: 700, at: new Date().toISOString() });
  expect((await handleWebhook(h.db, provider, body, new Headers({ "x-test-signature": signature }))).body.outcome).toBe("fulfilled");

  await signIn(page, OWNER);
  await page.goto("/orders");
  await page.getByRole("row", { name: /shopper@e2e\.test/ }).getByRole("link").click();
  await expect(page.getByText("Test order")).toBeVisible();
  await expect(page.getByText("active", { exact: true })).toBeVisible();
  await page.getByLabel("Reason").fill("Customer bought the wrong item");
  await page.getByRole("button", { name: "Request refund" }).click();
  // The owner sees the approval card; nothing has moved yet.
  await expect(page.getByText(/\$7\.00 — Customer bought the wrong item/)).toBeVisible();
  await expect(page.getByText("requested", { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Approve and refund" }).click();
  await expect(page.getByText(/revoked: refunded/)).toBeVisible();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();

  await page.goto("/licenses");
  await expect(page.getByRole("row", { name: /shopper@e2e\.test/ }).getByText(/revoked/)).toBeVisible();
  await page.goto("/revenue");
  await expect(page.getByText("No live sales yet")).toBeVisible(); // test orders don't count
  await expect(page.getByText(/test\.paid · fulfilled/)).toBeVisible();
  await page.goto("/audit");
  await expect(page.getByText("refund.approve").first()).toBeVisible();
});

test("brand manager can sell but can't refund or see revenue", async ({ page }) => {
  await signIn(page, MANAGER);
  await page.goto("/catalog");
  await expect(page.getByRole("link", { name: "Commerce Heart" })).toBeVisible();
  await page.goto("/orders");
  await page.getByRole("row", { name: /shopper@e2e\.test/ }).getByRole("link").click();
  await expect(page.getByRole("button", { name: "Request refund" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve and refund" })).toHaveCount(0);
  await page.goto("/revenue");
  await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
});
