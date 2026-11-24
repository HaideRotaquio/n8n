"use server";

import { AppError, can, ValidationError } from "@sb/core";
import {
  archiveProduct,
  createCollection,
  createProduct,
  getDb,
  getProductDetail,
  publishProduct,
  setCollectionStatus,
  updateProduct,
  upsertPrice,
  schema,
} from "@sb/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { parseMoney } from "@/lib/money";
import { getStaff, requestAuditContext } from "@/lib/server";

const fail = (message: string, issues?: string[]): ActionState => ({ ok: false, message, issues });

function asState(e: unknown): ActionState {
  if (e instanceof ValidationError) return fail(e.message, (e.issues as unknown[]).filter((i): i is string => typeof i === "string"));
  if (e instanceof AppError) return fail(e.message);
  throw e;
}

async function staffFor(permission: Parameters<typeof can>[1], brandId: string) {
  const staff = await getStaff();
  if (!staff || !can(staff.grants, permission, brandId)) return null;
  return staff;
}

export async function createProductAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const brandId = String(form.get("brandId") ?? "");
  const staff = await staffFor("catalog.write", brandId);
  if (!staff) return fail("You can't edit this brand's catalog.");
  const assetIds = form.getAll("assetIds").map(String);
  let id: string;
  try {
    const p = await createProduct(getDb(), await requestAuditContext(staff.user.id), {
      brandId,
      slug: String(form.get("slug") ?? "").trim(),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      kind: assetIds.length > 1 ? "pack" : "single",
      assetIds,
    });
    id = p.id;
  } catch (e) {
    return asState(e);
  }
  revalidatePath("/catalog");
  redirect(`/catalog/${id}`);
}

async function productStaff(productId: string, permission: Parameters<typeof can>[1]) {
  const detail = await getProductDetail(getDb(), productId);
  if (!detail) return { detail: null, staff: null };
  return { detail, staff: await staffFor(permission, detail.product.brandId) };
}

export async function updateProductAction(productId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { staff } = await productStaff(productId, "catalog.write");
  if (!staff) return fail("You can't edit this product.");
  try {
    await updateProduct(getDb(), await requestAuditContext(staff.user.id), productId, { title: String(form.get("title") ?? ""), description: String(form.get("description") ?? "") });
  } catch (e) {
    return asState(e);
  }
  revalidatePath(`/catalog/${productId}`);
  return { ok: true, message: "Saved." };
}

export async function setPriceAction(productId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { staff } = await productStaff(productId, "pricing.write");
  if (!staff) return fail("You can't set prices for this brand.");
  const amountCents = parseMoney(String(form.get("amount") ?? ""));
  if (amountCents === null) return fail("Enter an amount like 9 or 9.99.");
  try {
    await upsertPrice(getDb(), await requestAuditContext(staff.user.id), {
      productId,
      licenseType: String(form.get("licenseType") ?? ""),
      currency: "USD",
      amountCents,
      active: form.get("active") !== "off",
    });
  } catch (e) {
    return asState(e);
  }
  revalidatePath(`/catalog/${productId}`);
  return { ok: true, message: "Price saved." };
}

export async function publishAction(productId: string, _prev: ActionState): Promise<ActionState> {
  const { staff } = await productStaff(productId, "asset.publish");
  if (!staff) return fail("Publishing needs the asset.publish permission for this brand.");
  try {
    await publishProduct(getDb(), await requestAuditContext(staff.user.id), productId);
  } catch (e) {
    return asState(e);
  }
  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
  return { ok: true, message: "Published. It's now on the storefront." };
}

export async function archiveAction(productId: string, _prev: ActionState): Promise<ActionState> {
  const { staff } = await productStaff(productId, "asset.publish");
  if (!staff) return fail("Archiving needs the asset.publish permission for this brand.");
  await archiveProduct(getDb(), await requestAuditContext(staff.user.id), productId);
  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
  return { ok: true, message: "Archived. Existing buyers keep their downloads." };
}

export async function createCollectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const brandId = String(form.get("brandId") ?? "");
  const staff = await staffFor("catalog.write", brandId);
  if (!staff) return fail("You can't edit this brand's catalog.");
  try {
    await createCollection(getDb(), await requestAuditContext(staff.user.id), {
      brandId,
      slug: String(form.get("slug") ?? "").trim(),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      productIds: form.getAll("productIds").map(String),
    });
  } catch (e) {
    return asState(e);
  }
  revalidatePath("/catalog");
  return { ok: true, message: "Collection created as a draft." };
}

export async function collectionStatusAction(collectionId: string, status: "published" | "draft" | "archived", _prev: ActionState): Promise<ActionState> {
  const db = getDb();
  const [c] = await db.select().from(schema.collection).where(eq(schema.collection.id, collectionId));
  if (!c) return fail("Collection not found.");
  const staff = await staffFor(status === "published" ? "asset.publish" : "catalog.write", c.brandId);
  if (!staff) return fail("You can't change this collection.");
  await setCollectionStatus(db, await requestAuditContext(staff.user.id), collectionId, status);
  revalidatePath("/catalog");
  return { ok: true, message: `Collection is now ${status}.` };
}
