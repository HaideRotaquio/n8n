import { createDb } from "../client";
import { seed } from "../seed";

const handle = createDb(process.env.DATABASE_URL ?? "");
try {
  const result = await seed(handle.db);
  console.log(
    result.brandsCreated.length
      ? `Seeded. Created brands: ${result.brandsCreated.join(", ")}`
      : "Seeded. All brands already existed (settings left untouched).",
  );
} finally {
  await handle.close();
}
