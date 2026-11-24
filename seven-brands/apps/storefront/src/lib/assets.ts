import "server-only";
import { getDb, schema } from "@sb/db";
import { inArray } from "drizzle-orm";

export async function listAssetNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await getDb().select({ id: schema.asset.id, name: schema.asset.name }).from(schema.asset).where(inArray(schema.asset.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}
