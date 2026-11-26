import { getDb, searchPublishedIcons } from "@sb/db";
import { apiStore, iconCard, PUBLIC_JSON } from "@/lib/dev-api";

export const dynamic = "force-dynamic";

/** GET /api/v1/icons?q=happy+cat&limit=20 — search this store's published icons (no license needed). */
export async function GET(req: Request) {
  const store = await apiStore();
  if (store instanceof Response) return store;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const limit = Number(url.searchParams.get("limit") ?? 20) || 20;
  const icons = await searchPublishedIcons(getDb(), store.brand.id, { q, limit });
  return Response.json({ store: store.brand.name, query: q, icons: icons.map((i) => iconCard(i, store.origin)) }, { headers: PUBLIC_JSON });
}
