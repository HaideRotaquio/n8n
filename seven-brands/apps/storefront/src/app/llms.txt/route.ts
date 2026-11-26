import { llmsTxt } from "@/lib/developers";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** /llms.txt — how AI tools should find, install and use this store's icons. */
export async function GET() {
  const store = await getStore();
  if (!store) return new Response("Not found", { status: 404 });
  return new Response(llmsTxt(store.brand, store.origin), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
