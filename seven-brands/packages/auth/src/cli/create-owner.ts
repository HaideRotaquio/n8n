/**
 * Creates the first owner account.
 *
 *   OWNER_EMAIL=you@example.com OWNER_NAME="Your Name" OWNER_PASSWORD='...' pnpm create-owner
 *
 * The password is read from the environment (not argv) so it doesn't land in shell history listings.
 */
import { createDb } from "@sb/db";
import { createStaffUser, MIN_PASSWORD_LENGTH } from "../index";

const { OWNER_EMAIL, OWNER_NAME, OWNER_PASSWORD, BETTER_AUTH_SECRET, DATABASE_URL } = process.env;
if (!OWNER_EMAIL || !OWNER_NAME || !OWNER_PASSWORD) {
  console.error("Set OWNER_EMAIL, OWNER_NAME and OWNER_PASSWORD.");
  process.exit(1);
}
if (OWNER_PASSWORD.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}
const handle = createDb(DATABASE_URL ?? "");
try {
  const { userId } = await createStaffUser(handle.db, {
    email: OWNER_EMAIL,
    name: OWNER_NAME,
    password: OWNER_PASSWORD,
    role: "owner",
    secret: BETTER_AUTH_SECRET ?? "",
  });
  console.log(`Owner created: ${OWNER_EMAIL} (${userId})`);
} finally {
  await handle.close();
}
