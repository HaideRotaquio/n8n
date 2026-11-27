import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { OWNER } from "./users";

/** Plays "a shady website": requests carry a foreign Origin, the way a browser sends them from another site. */
test("CORS: other websites can't read staff data, sign staff in, or change anything", async ({ playwright }) => {
  const EVIL = "https://evil.example";
  const staff = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { origin: BASE_URL } });
  try {
    // A real staff session (same-origin sign-in), so the checks below run with valid cookies attached.
    expect((await staff.post("/api/auth/sign-in/email", { data: { email: OWNER.email, password: OWNER.password } })).ok()).toBe(true);
    const evil = { origin: EVIL };

    for (const path of ["/api/v1/brands", "/api/v1/brands/moodicons", "/api/auth/get-session"]) {
      const r = await staff.get(path, { headers: evil });
      expect(r.headers()["access-control-allow-origin"], path).toBeUndefined();
    }
    const preflight = await staff.fetch("/api/v1/brands/moodicons", { method: "OPTIONS", headers: { ...evil, "access-control-request-method": "PATCH" } });
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();

    const patch = await staff.patch("/api/v1/brands/moodicons", { headers: evil, data: { name: "Hacked" } });
    expect(patch.status()).toBe(403);
    expect(await patch.json()).toMatchObject({ error: { code: "bad_origin" } });
    expect((await (await staff.get("/api/v1/brands/moodicons")).json()).brand?.name ?? "Moodicons").not.toBe("Hacked");

    const signIn = await staff.post("/api/auth/sign-in/email", { headers: evil, data: { email: OWNER.email, password: OWNER.password } });
    expect(signIn.status()).toBe(403);
  } finally {
    await staff.dispose();
  }
});
