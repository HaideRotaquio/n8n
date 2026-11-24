import { newId } from "@sb/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "./client";
import {
  getBrandBySlug,
  grantRole,
  listAudit,
  listBrands,
  listStaff,
  loadGrants,
  resolveBrandByHost,
  revokeRole,
  setBrandStatus,
  updateBrandConfig,
} from "./index";
import { brand, customer, user } from "./schema";
import { seed } from "./seed";
import { createTestDb } from "./testing";

let h: DbHandle;
const ctx = { actorUserId: null, ipAddress: "127.0.0.1", userAgent: "vitest" };

async function makeUser(email: string) {
  const id = newId("usr");
  await h.db.insert(user).values({ id, name: email.split("@")[0]!, email });
  return id;
}

beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

describe("migrations + seed", () => {
  it("seeds seven brands and is idempotent", async () => {
    const first = await seed(h.db);
    expect(first.brandsCreated).toHaveLength(7);
    const second = await seed(h.db);
    expect(second.brandsCreated).toHaveLength(0);
    expect(second.organizationId).toBe(first.organizationId);
    expect(await listBrands(h.db)).toHaveLength(7);
  });

  it("does not overwrite admin-edited brand settings on re-seed", async () => {
    await updateBrandConfig(h.db, ctx, "moodicons", { tagline: "Edited by admin" });
    await seed(h.db);
    expect((await getBrandBySlug(h.db, "moodicons"))!.config.tagline).toBe("Edited by admin");
  });

  it("orders brands by launch phase", async () => {
    const slugs = (await listBrands(h.db)).map((b) => b.slug);
    expect(slugs.slice(0, 2).sort()).toEqual(["moodicons", "sonicglyphs"]);
    expect(slugs.at(-1)).toBe("aliveui");
  });
});

describe("brand scoping and routing", () => {
  it("resolves brands by host, ignoring port and case", async () => {
    expect((await resolveBrandByHost(h.db, "SonicGlyphs.localhost:3000"))?.slug).toBe("sonicglyphs");
    expect(await resolveBrandByHost(h.db, "unknown.localhost")).toBeUndefined();
  });

  it("limits listing to the caller's brands", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    expect((await listBrands(h.db, [mood.id])).map((b) => b.slug)).toEqual(["moodicons"]);
    expect(await listBrands(h.db, [])).toEqual([]);
  });

  it("rejects a domain already owned by another brand", async () => {
    await expect(
      updateBrandConfig(h.db, ctx, "aliveui", { domains: ["moodicons.localhost"] }),
    ).rejects.toThrow(/already used/);
    // transaction rolled back: aliveui still has its own domain
    expect((await resolveBrandByHost(h.db, "aliveui.localhost"))?.slug).toBe("aliveui");
  });

  it("rejects invalid patches without writing", async () => {
    await expect(
      updateBrandConfig(h.db, ctx, "aliveui", { domains: ["https://bad"] } as never),
    ).rejects.toThrow(/Invalid brand settings/);
  });

  it("updates domains and records an audit entry", async () => {
    const updated = await updateBrandConfig(h.db, ctx, "aliveui", {
      domains: ["aliveui.localhost", "ui.aliveui.localhost"],
    });
    expect(updated.config.domains).toHaveLength(2);
    expect((await resolveBrandByHost(h.db, "ui.aliveui.localhost"))?.slug).toBe("aliveui");
    const log = await listAudit(h.db, { brandId: updated.id });
    expect(log[0]?.action).toBe("brand.update");
    expect(log[0]?.userAgent).toBe("vitest");
  });

  it("changes status with audit", async () => {
    const b = await setBrandStatus(h.db, ctx, "cineglyphs", "in_development");
    expect(b.status).toBe("in_development");
    await expect(setBrandStatus(h.db, ctx, "cineglyphs", "bogus" as never)).rejects.toThrow();
  });
});

describe("customers are brand-scoped", () => {
  it("one user can be a customer of two brands but only once per brand", async () => {
    const uid = await makeUser("buyer@example.com");
    const [mood, sonic] = await Promise.all([
      getBrandBySlug(h.db, "moodicons"),
      getBrandBySlug(h.db, "sonicglyphs"),
    ]);
    await h.db.insert(customer).values({ id: newId("cus"), userId: uid, brandId: mood!.id });
    await h.db.insert(customer).values({ id: newId("cus"), userId: uid, brandId: sonic!.id });
    await expect(
      h.db.insert(customer).values({ id: newId("cus"), userId: uid, brandId: mood!.id }),
    ).rejects.toThrow();
    const moodCustomers = await h.db.select().from(customer).where(eq(customer.brandId, mood!.id));
    expect(moodCustomers).toHaveLength(1);
  });

  it("a brand with customers cannot be deleted", async () => {
    await expect(h.db.delete(brand).where(eq(brand.slug, "moodicons"))).rejects.toThrow();
  });
});

describe("rbac persistence", () => {
  it("grants, de-duplicates (including global grants), loads and revokes roles", async () => {
    const uid = await makeUser("manager@example.com");
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    await grantRole(h.db, ctx, { userId: uid, role: "brand_manager", brandId: mood.id });
    await grantRole(h.db, ctx, { userId: uid, role: "brand_manager", brandId: mood.id });
    await grantRole(h.db, ctx, { userId: uid, role: "analyst", brandId: null });
    await grantRole(h.db, ctx, { userId: uid, role: "analyst", brandId: null });
    const grants = await loadGrants(h.db, uid);
    expect(grants).toHaveLength(2);
    const staff = await listStaff(h.db);
    expect(staff.find((s) => s.userId === uid)?.roles).toHaveLength(2);
    await revokeRole(h.db, ctx, { userId: uid, role: "analyst", brandId: null });
    expect(await loadGrants(h.db, uid)).toEqual([{ role: "brand_manager", brandId: mood.id }]);
    const actions = (await listAudit(h.db, { limit: 10 })).map((a) => a.action);
    expect(actions.filter((a) => a === "team.grant")).toHaveLength(2);
    expect(actions).toContain("team.revoke");
  });

  it("refuses brand-scoped owner grants", async () => {
    const uid = await makeUser("x@example.com");
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    await expect(grantRole(h.db, ctx, { userId: uid, role: "owner", brandId: mood.id })).rejects.toThrow();
  });
});

describe("audit log is append-only", () => {
  it("blocks UPDATE and DELETE", async () => {
    const pgMessage = (p: Promise<unknown>) =>
      p.then(
        () => "no error",
        (e: { cause?: { message?: string }; message: string }) => e.cause?.message ?? e.message,
      );
    expect(await pgMessage(h.db.execute(sql`UPDATE audit_log SET action = 'tampered'`))).toMatch(/append-only/);
    expect(await pgMessage(h.db.execute(sql`DELETE FROM audit_log`))).toMatch(/append-only/);
  });

  it("keeps entries when the actor user is deleted (actor set to NULL)", async () => {
    const uid = await makeUser("leaver@example.com");
    await grantRole(h.db, { actorUserId: uid }, { userId: uid, role: "support", brandId: null });
    await h.db.delete(user).where(eq(user.id, uid));
    const entries = await listAudit(h.db, { limit: 200 });
    const entry = entries.find((e) => e.entityId === uid && e.action === "team.grant");
    expect(entry).toBeDefined();
    expect(entry!.actorUserId).toBeNull();
  });
});
