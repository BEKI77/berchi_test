"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Users,
  Scissors,
  TrendingUp,
  Package,
  Award,
  Heart,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

type Stats = {
  todaysRevenue: number;
  todaysTips: number;
  clientsServed: number;
  servicesDone: number;
  activeStaff: number;
  totalCustomers: number;
  totalServices: number;
  lowStockProducts: number;
  transactionCount: number;
  topServer: { name: string; count: number } | null;
};

export function AdminDashboardClient({ firstName }: { firstName: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-amber-200 border-t-amber-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1">Here&apos;s how your salon is doing today</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchStats}
          className="rounded-xl border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-all"
        >
          <RefreshCw className="h-4 w-4 mr-2 text-amber-500" />
          Refresh
        </Button>
      </div>

      {/* Main stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-lg shadow-emerald-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-2">
            <DollarSign className="h-4 w-4" />
            Today&apos;s Revenue
          </div>
          <p className="text-2xl font-bold">ETB {formatMoney((stats?.todaysRevenue || 0))}</p>
          <p className="text-emerald-200 text-xs mt-1">{stats?.transactionCount || 0} transactions</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 p-5 text-white shadow-lg shadow-blue-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-2 text-blue-100 text-xs font-semibold uppercase tracking-wider mb-2">
            <Users className="h-4 w-4" />
            Clients Served
          </div>
          <p className="text-2xl font-bold">{stats?.clientsServed || 0}</p>
          <p className="text-blue-200 text-xs mt-1">Today</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 p-5 text-white shadow-lg shadow-pink-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-2 text-pink-100 text-xs font-semibold uppercase tracking-wider mb-2">
            <Scissors className="h-4 w-4" />
            Services Done
          </div>
          <p className="text-2xl font-bold">{stats?.servicesDone || 0}</p>
          <p className="text-pink-200 text-xs mt-1">Today</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-lg shadow-amber-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-2 text-amber-100 text-xs font-semibold uppercase tracking-wider mb-2">
            <TrendingUp className="h-4 w-4" />
            Tips Collected
          </div>
          <p className="text-2xl font-bold">ETB {formatMoney((stats?.todaysTips || 0))}</p>
          <p className="text-amber-200 text-xs mt-1">Today</p>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-violet-100 bg-white p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 shrink-0">
            <Users className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Staff</p>
            <p className="text-xl font-bold">{stats?.activeStaff || 0}</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 shrink-0">
            <Users className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Customers</p>
            <p className="text-xl font-bold">{stats?.totalCustomers || 0}</p>
          </div>
        </div>

        <div className="rounded-xl border border-pink-100 bg-white p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 shrink-0">
            <Scissors className="h-6 w-6 text-pink-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Services</p>
            <p className="text-xl font-bold">{stats?.totalServices || 0}</p>
          </div>
        </div>
      </div>

      {/* Quick info row */}
      <div className="grid gap-4 sm:grid-cols-2">
        {stats?.topServer && (
          <div className="rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50 p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 shrink-0">
              <Award className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Top Stylist Today</p>
              <p className="text-base font-bold">{stats.topServer.name}</p>
              <p className="text-xs text-muted-foreground">{stats.topServer.count} client(s) served</p>
            </div>
          </div>
        )}

        {(stats?.lowStockProducts || 0) > 0 && (
          <div className="rounded-xl border border-red-100 bg-gradient-to-r from-red-50/50 to-orange-50/50 p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-100 to-orange-100 shrink-0">
              <Package className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Low Stock Alert</p>
              <p className="text-base font-bold text-red-600">{stats?.lowStockProducts} product(s)</p>
              <p className="text-xs text-muted-foreground">Below reorder level</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
