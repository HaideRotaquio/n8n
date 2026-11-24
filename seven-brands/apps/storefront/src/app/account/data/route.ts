import { exportCustomerData, getDb } from "@sb/db";
import { getShopper } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Data-access request: everything we hold about this customer, as JSON. */
export async function GET() {
  const shopper = await getShopper();
  if (!shopper) return new Response("Sign in required", { status: 401 });
  const data = await exportCustomerData(getDb(), shopper.customer.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${shopper.brand.slug}-my-data.json"`,
      "cache-control": "private, no-store",
    },
  });
}
