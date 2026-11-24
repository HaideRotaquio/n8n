import { contentDisposition, verifyFsDownload } from "@sb/storage";
import { getStorage } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Serves files for the local "fs" storage driver only. With S3/R2, clients download from presigned URLs. */
export async function GET(req: Request) {
  const storage = getStorage();
  if (storage.kind !== "fs") return new Response("Not found", { status: 404 });
  const verified = verifyFsDownload(new URL(req.url).searchParams, process.env.STORAGE_SIGNING_SECRET ?? "");
  if (!verified) return new Response("Link invalid or expired", { status: 403 });
  const body = await storage.get(verified.key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(body), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": contentDisposition(verified.filename),
      "cache-control": "private, no-store",
    },
  });
}
