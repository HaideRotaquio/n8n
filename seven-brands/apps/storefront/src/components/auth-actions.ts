"use server";

import { getDb, setMarketingConsent } from "@sb/db";
import { getShopper } from "@/lib/store";

export async function saveConsent(consent: boolean): Promise<void> {
  const shopper = await getShopper();
  if (shopper) await setMarketingConsent(getDb(), shopper.customer.id, consent);
}
