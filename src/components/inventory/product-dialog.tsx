"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  cost_price: number;
  sale_price: number;
  is_active: boolean;
};

export function ProductDialog({ product }: { product?: Product }) {
  const isEdit = Boolean(product);
  const action = isEdit ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? "Product updated" : "Product added");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog is a one-off reaction to a server action result, not derived render state
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? "outline" : "default"} size={isEdit ? "sm" : "default"} />
        }
      >
        {isEdit ? "Edit" : "Add product"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              SKU is required and must be unique. Barcode is optional for now
              — useful later for camera scanning.
            </DialogDescription>
          </DialogHeader>

          {isEdit ? <input type="hidden" name="id" value={product!.id} /> : null}

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-1 flex flex-col gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku} required />
            </div>
            <div className="col-span-1 flex flex-col gap-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" name="barcode" defaultValue={product?.barcode ?? ""} />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={product?.name} required />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={product?.description ?? ""}
              />
            </div>
            <div className="col-span-1 flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={product?.category ?? ""} />
            </div>
            <div className="col-span-1 flex flex-col gap-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" defaultValue={product?.unit ?? "pcs"} />
            </div>
            <div className="col-span-1 flex flex-col gap-2">
              <Label htmlFor="cost_price">Cost price</Label>
              <Input
                id="cost_price"
                name="cost_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product?.cost_price ?? 0}
              />
            </div>
            <div className="col-span-1 flex flex-col gap-2">
              <Label htmlFor="sale_price">Sale price</Label>
              <Input
                id="sale_price"
                name="sale_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product?.sale_price ?? 0}
              />
            </div>
            {isEdit ? (
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  name="is_active"
                  defaultChecked={product?.is_active ?? true}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
