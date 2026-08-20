import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/invoices", label: "Invoices" },
  { href: "/delivery-slips", label: "Delivery slips" },
  { href: "/purchases", label: "Purchases" },
  { href: "/customers", label: "Customers" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/reports", label: "Reports" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="font-semibold">Inventory</span>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              {profile?.full_name ?? user.email}
              {profile?.role ? ` (${profile.role})` : ""}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
