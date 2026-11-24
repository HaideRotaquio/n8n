import { getDb, getSounds } from "@sb/db";
import { getStore, storageFor } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Preview audio for library sounds used by this brand's icons (shared sounds or the brand's own).
 * Previews are public like the animated previews; the licensed files come with the purchase.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await getStore();
  const { id } = await params;
  if (!store || !/^snd_[0-9A-Z]{26}$/.test(id)) return new Response("Not found", { status: 404 });
  const [s] = await getSounds(getDb(), [id]);
  if (!s || (s.brandId && s.brandId !== store.brand.id)) return new Response("Not found", { status: 404 });
  const body = await storageFor(store.origin).get(s.storageKey);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(body), { headers: { "content-type": "audio/wav", "cache-control": "public, max-age=3600" } });
}
