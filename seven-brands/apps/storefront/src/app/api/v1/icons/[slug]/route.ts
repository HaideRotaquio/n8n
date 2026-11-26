import { SOURCE_FORMATS } from "@sb/export/source";
import { getDb, getPublishedIcon } from "@sb/db";
import { apiError, apiStore, iconCard, PUBLIC_JSON } from "@/lib/dev-api";

export const dynamic = "force-dynamic";

/** GET /api/v1/icons/:slug — one icon's details, where to buy it and which formats the CLI can install. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const store = await apiStore();
  if (store instanceof Response) return store;
  const { slug } = await params;
  const icon = await getPublishedIcon(getDb(), store.brand.id, slug);
  if (!icon) return apiError(404, "not_found", `No published icon called "${slug}".`);
  return Response.json({ icon: iconCard(icon.summary, store.origin), formats: SOURCE_FORMATS, colors: icon.definition.tokens }, { headers: PUBLIC_JSON });
}
