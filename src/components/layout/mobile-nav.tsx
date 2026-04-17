"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Scissors } from "lucide-react";
type StaffRole = "SERVER" | "CASHIER" | "OWNER";
import {
  LayoutDashboard,
  Users,
  Package,
  Calendar,
  Receipt,
  BarChart3,
  Settings,
  ClipboardList,
  CreditCard,
  History,
  DollarSign,
  UserCircle,
  Award,
  Sparkles,
} from "lucide-react";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const serverNav: NavItem[] = [
  { title: "My Queue", href: "/server", icon: ClipboardList },
  { title: "My History", href: "/server/history", icon: History },
];

const cashierNav: NavItem[] = [
  { title: "Pending Orders", href: "/cashier", icon: ClipboardList },
  { title: "Appointments", href: "/cashier/appointments", icon: Calendar },
  { title: "Transactions", href: "/cashier/transactions", icon: CreditCard },
];

const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Staff", href: "/admin/staff", icon: Users },
  { title: "Services", href: "/admin/services", icon: Scissors },
  { title: "Inventory", href: "/admin/inventory", icon: Package },
  { title: "Customers", href: "/admin/customers", icon: UserCircle },
  { title: "Appointments", href: "/admin/appointments", icon: Calendar },
  { title: "Expenses", href: "/admin/expenses", icon: DollarSign },
  { title: "Invoices", href: "/admin/invoices", icon: Receipt },
  { title: "Employees", href: "/admin/employees", icon: Award },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Product Usage", href: "/admin/analytics", icon: Sparkles },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

function getNavItems(role: StaffRole): NavItem[] {
  switch (role) {
    case "SERVER":
      return serverNav;
    case "CASHIER":
      return cashierNav;
    case "OWNER":
      return adminNav;
    default:
      return [];
  }
}

export function MobileNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <Scissors className="h-6 w-6 text-pink-600" />
        <span className="text-lg font-bold tracking-tight">Berchi Salon</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/server" &&
                item.href !== "/cashier" &&
                item.href !== "/admin" &&
                pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-pink-50 text-pink-700"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
