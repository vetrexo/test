import { createClient } from "@/lib/supabase/server";
import { ProductDialog } from "@/components/inventory/product-dialog";
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      "id, sku, barcode, name, description, category, unit, cost_price, sale_price, quantity_on_hand, is_active",
    )
    .order("name");

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
  }

  const { data: products, error } = await query;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex w-full max-w-sm gap-2">
          <Input
            name="q"
            placeholder="Search by name, SKU or barcode..."
            defaultValue={q ?? ""}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <ProductDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sale price</TableHead>
                  <TableHead className="text-right">Qty on hand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.length ? (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.category ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {Number(product.cost_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(product.sale_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(product.quantity_on_hand)} {product.unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <AdjustStockDialog
                            productId={product.id}
                            productName={product.name}
                          />
                          <ProductDialog product={product} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No products yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
