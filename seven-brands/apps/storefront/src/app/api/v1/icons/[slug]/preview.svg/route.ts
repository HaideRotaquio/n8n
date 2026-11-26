import { renderFrameSvg } from "@sb/asset";
import { getDb, getPublishedIcon } from "@sb/db";
import { apiError, apiStore } from "@/lib/dev-api";

export const dynamic = "force-dynamic";

/** A still preview (the reduced-motion frame), the same picture the store shows on product cards. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const store = await apiStore();
  if (store instanceof Response) return store;
  const { slug } = await params;
  const icon = await getPublishedIcon(getDb(), store.brand.id, slug);
  if (!icon) return apiError(404, "not_found", `No published icon called "${slug}".`);
  const svg = renderFrameSvg(icon.definition, icon.definition.a11y.reducedMotionFrame);
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'", "x-content-type-options": "nosniff" } });
}
