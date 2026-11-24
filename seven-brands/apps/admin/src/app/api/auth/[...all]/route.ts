import { toNextJsHandler } from "@sb/auth/next";
import { getAuth } from "@/lib/server";

const handler = () => toNextJsHandler(getAuth());
export const GET = (req: Request) => handler().GET(req);
export const POST = (req: Request) => handler().POST(req);
