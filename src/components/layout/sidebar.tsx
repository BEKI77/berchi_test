"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
type StaffRole = "SERVER" | "CASHIER" | "OWNER";
import {
  LayoutDashboard,
  Users,
  Scissors,
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
  Sparkles,
  Award,
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

const roleSubtitle: Record<string, string> = {
  SERVER: "Stylist Station",
  CASHIER: "Front Desk",
  OWNER: "Management",
};

export function Sidebar({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const navItems = getNavItems(role);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-gradient-to-b from-white via-white to-pink-50/30">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-pink-100/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-md shadow-pink-200/40">
          <Scissors className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
            Berchi Salon
          </span>
          <span className="text-[10px] font-medium text-pink-400/80 uppercase tracking-widest leading-none">
            {roleSubtitle[role]}
          </span>
        </div>
      </div>

      {/* Navigation */}
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
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 shadow-sm shadow-pink-100/50 border border-pink-100/60"
                      : "text-muted-foreground hover:bg-pink-50/50 hover:text-pink-600"
                  )}
                >
                  <item.icon className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors duration-200",
                    isActive ? "text-pink-500" : "text-muted-foreground/60 group-hover:text-pink-400"
                  )} />
                  {item.title}
                  {isActive && (
                    <Sparkles className="ml-auto h-3 w-3 text-pink-300" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom branding */}
      <div className="px-4 py-3 border-t border-pink-100/40">
        <p className="text-[10px] text-center text-pink-300 font-medium tracking-wide">
          Made with love for Berchi
        </p>
      </div>
    </aside>
  );
}
