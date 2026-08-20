import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Inventory, invoices, delivery slips, purchases and reports will
            show up here as each part of the app is built out.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
