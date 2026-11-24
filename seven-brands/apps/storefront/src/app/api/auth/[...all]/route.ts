import { toNextJsHandler } from "@sb/auth/next";
import { getStore, authFor } from "@/lib/store";

async function handler(req: Request, method: "GET" | "POST") {
  const store = await getStore();
  if (!store) return new Response("Not found", { status: 404 });
  return toNextJsHandler(authFor(store.origin))[method](req);
}
export const GET = (req: Request) => handler(req, "GET");
export const POST = (req: Request) => handler(req, "POST");
