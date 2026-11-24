import { createStaffUser } from "@sb/auth";
import { getBrandBySlug, seed } from "@sb/db";
import { createTestDb } from "@sb/db/testing";
import { MANAGER, OWNER } from "./users";

const E2E_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://daos:daos_dev_only@localhost:5432/daos_e2e_test";

const SECRET = "e2e-secret-e2e-secret-e2e-secret-0123456";

async function main() {
  process.env.TEST_DATABASE_URL = E2E_DATABASE_URL;
  const h = await createTestDb();
  try {
    await seed(h.db);
    await createStaffUser(h.db, { ...OWNER, name: "Owner", role: "owner", secret: SECRET });
    const mood = await getBrandBySlug(h.db, "moodicons");
    await createStaffUser(h.db, { ...MANAGER, name: "Mood Manager", role: "brand_manager", brandId: mood!.id, secret: SECRET });
  } finally {
    await h.close();
  }
}

await main();
console.log("E2E database ready.");
