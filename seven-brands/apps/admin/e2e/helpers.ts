import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

/** Reloads a job page until the job reaches a final state. */
export async function waitForJob(page: Page, jobUrl: string, timeoutMs = 60_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await page.goto(jobUrl);
    const header = page.locator("main");
    for (const s of ["succeeded", "failed", "cancelled"]) {
      if (await header.getByText(s, { exact: true }).first().isVisible().catch(() => false)) return s;
    }
    if (Date.now() > deadline) throw new Error(`Job at ${jobUrl} did not finish in time`);
    await page.waitForTimeout(1000);
  }
}
