import { isId } from "@sb/core";
import { getBrandBySlug, seed, type DbHandle } from "@sb/db";
import { createTestDb } from "@sb/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, createStaffUser, getStaffContext, requirePermission, type Auth } from "./index";

const SECRET = "test-secret-test-secret-test-secret-0123";
const BASE = "http://admin.localhost:3100";
let h: DbHandle;
let auth: Auth;

async function signIn(a: Auth, email: string, password: string) {
  const res = await a.api.signInEmail({ body: { email, password }, asResponse: true });
  const cookie = res.headers.get("set-cookie");
  return { status: res.status, cookie };
}

beforeAll(async () => {
  h = await createTestDb();
  await seed(h.db);
  auth = createAuth({ db: h.db, secret: SECRET, baseURL: BASE, allowSignUp: false, rateLimit: false });
});
afterAll(async () => {
  await h?.close();
});

describe("auth", () => {
  it("rejects a short secret", () => {
    expect(() => createAuth({ db: h.db, secret: "short", baseURL: BASE, allowSignUp: false })).toThrow();
  });

  it("does not allow public sign-up on the admin instance", async () => {
    const res = await auth.api.signUpEmail({
      body: { email: "intruder@example.com", password: "long-enough-password", name: "x" },
      asResponse: true,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("creates staff with prefixed ids, hashes passwords, and signs in", async () => {
    const { userId } = await createStaffUser(h.db, {
      email: "Owner@Example.com",
      name: "Owner",
      password: "correct horse battery staple",
      role: "owner",
      secret: SECRET,
    });
    expect(isId(userId, "usr")).toBe(true);
    const acct = await h.db.query.account.findFirst();
    expect(acct?.password).toBeTruthy();
    expect(acct?.password).not.toContain("correct horse");

    const bad = await signIn(auth, "owner@example.com", "wrong password here");
    expect(bad.status).toBe(401);

    const ok = await signIn(auth, "owner@example.com", "correct horse battery staple");
    expect(ok.status).toBe(200);
    expect(ok.cookie).toMatch(/session_token/);
    expect(ok.cookie).toMatch(/HttpOnly/i);

    const headers = new Headers({ cookie: ok.cookie!.split(";")[0]! });
    const staff = await getStaffContext(auth, h.db, headers);
    expect(staff?.user.email).toBe("owner@example.com");
    expect(requirePermission(staff, "order.refund").user.id).toBe(userId);
  });

  it("enforces minimum password length", async () => {
    await expect(
      createStaffUser(h.db, { email: "a@example.com", name: "A", password: "short", role: "support", secret: SECRET }),
    ).rejects.toThrow();
  });

  it("brand-scoped staff only get permissions on their brand", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const sonic = (await getBrandBySlug(h.db, "sonicglyphs"))!;
    await createStaffUser(h.db, {
      email: "mgr@example.com",
      name: "Mgr",
      password: "another long password",
      role: "brand_manager",
      brandId: mood.id,
      secret: SECRET,
    });
    const { cookie } = await signIn(auth, "mgr@example.com", "another long password");
    const staff = await getStaffContext(auth, h.db, new Headers({ cookie: cookie!.split(";")[0]! }));
    expect(() => requirePermission(staff, "brand.update", mood.id)).not.toThrow();
    expect(() => requirePermission(staff, "brand.update", sonic.id)).toThrow(/permission/);
    expect(() => requirePermission(staff, "team.write")).toThrow(/permission/);
  });

  it("signed-out requests have no staff context", async () => {
    expect(await getStaffContext(auth, h.db, new Headers())).toBeNull();
    expect(() => requirePermission(null, "overview.read")).toThrow(/Sign in/);
  });

  it("rate-limits repeated sign-in attempts", async () => {
    const limited = createAuth({ db: h.db, secret: SECRET, baseURL: BASE, allowSignUp: false, rateLimit: true });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await limited.handler(
        new Request(`${BASE}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", origin: BASE },
          body: JSON.stringify({ email: "owner@example.com", password: "wrong password here" }),
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
