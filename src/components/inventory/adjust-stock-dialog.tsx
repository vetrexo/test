"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { adjustStock } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdjustStockDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [state, formAction, pending] = useActionState(adjustStock, undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success("Stock adjusted");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog is a one-off reaction to a server action result, not derived render state
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Adjust stock
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Adjust stock — {productName}</DialogTitle>
            <DialogDescription>
              Use a positive number to add stock, negative to remove (e.g. for
              damaged/lost goods). This is recorded in the stock ledger.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="product_id" value={productId} />

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantity_delta">Quantity change</Label>
              <Input
                id="quantity_delta"
                name="quantity_delta"
                type="number"
                step="0.01"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" placeholder="e.g. damaged, recount" />
            </div>
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
