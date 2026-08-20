"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: boolean } | undefined;

function num(formData: FormData, key: string) {
  const raw = formData.get(key);
  const value = raw === null || raw === "" ? 0 : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function str(formData: FormData, key: string) {
  const raw = formData.get(key);
  const value = String(raw ?? "").trim();
  return value === "" ? null : value;
}

export async function createProduct(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const { error } = await supabase.from("products").insert({
    sku: str(formData, "sku"),
    barcode: str(formData, "barcode"),
    name: str(formData, "name"),
    description: str(formData, "description"),
    category: str(formData, "category"),
    unit: str(formData, "unit") ?? "pcs",
    cost_price: num(formData, "cost_price"),
    sale_price: num(formData, "sale_price"),
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateProduct(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("products")
    .update({
      sku: str(formData, "sku"),
      barcode: str(formData, "barcode"),
      name: str(formData, "name"),
      description: str(formData, "description"),
      category: str(formData, "category"),
      unit: str(formData, "unit") ?? "pcs",
      cost_price: num(formData, "cost_price"),
      sale_price: num(formData, "sale_price"),
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { success: true };
}

export async function adjustStock(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const productId = String(formData.get("product_id") ?? "");
  const delta = num(formData, "quantity_delta");
  const reason = str(formData, "reason");

  if (!delta) return { error: "Enter a non-zero quantity" };

  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    movement_type: "adjustment",
    quantity_delta: delta,
    reference_type: "manual",
    notes: reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { success: true };
}
