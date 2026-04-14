"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Scissors,
  Award,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Percent,
  Heart,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  commissionRate: number;
  isActive: boolean;
  createdAt: string;
  stats: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    inProgressOrders: number;
    totalServiceRevenue: number;
    servicesPerformed: number;
    totalCommissions: number;
    totalInvoiceRevenue: number;
    totalTipsEarned: number;
    avgRevenuePerOrder: number;
    completionRate: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
  };
  topServices: { name: string; count: number; revenue: number }[];
};

type Summary = {
  totalEmployees: number;
  activeEmployees: number;
  totalRevenue: number;
  totalCommissions: number;
  totalOrders: number;
  totalServicesPerformed: number;
  totalTips: number;
};

const roleColors: Record<string, string> = {
  OWNER: "bg-amber-50 text-amber-700 border-amber-200",
  SERVER: "bg-pink-50 text-pink-700 border-pink-200",
  CASHIER: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function EmployeesClient() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/employees");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEmployees(data.employees);
      setSummary(data.summary);
    } catch {
      toast.error("Failed to load employee data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-violet-200 border-t-violet-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading employee data...</p>
      </div>
    );
  }

  const topPerformer = [...employees].sort((a, b) => b.stats.totalInvoiceRevenue - a.stats.totalInvoiceRevenue)[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-violet-500" />
          Employee Performance
        </h1>
        <p className="text-muted-foreground mt-1">Detailed stats for every team member</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl border-violet-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Employees</p>
              <p className="text-xl font-bold mt-1">{summary.totalEmployees}</p>
              <p className="text-[10px] text-muted-foreground">{summary.activeEmployees} active</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-emerald-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Total Revenue</p>
              <p className="text-xl font-bold mt-1">ETB {summary.totalRevenue.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.totalOrders} orders</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-pink-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wider">Commissions Paid</p>
              <p className="text-xl font-bold mt-1">ETB {summary.totalCommissions.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.totalServicesPerformed} services</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-amber-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Tips Earned</p>
              <p className="text-xl font-bold mt-1">ETB {summary.totalTips.toFixed(0)}</p>
              {topPerformer && (
                <p className="text-[10px] text-muted-foreground">Top: {topPerformer.firstName}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employee Cards */}
      <div className="space-y-3">
        {employees.map((emp) => {
          const isOpen = expanded.has(emp.id);
          const s = emp.stats;
          const highestRev = Math.max(...employees.map(e => e.stats.totalInvoiceRevenue), 1);
          const revPct = (s.totalInvoiceRevenue / highestRev) * 100;

          return (
            <Card
              key={emp.id}
              className={`rounded-xl overflow-hidden transition-colors ${
                emp.isActive ? "border-violet-50 hover:border-violet-100" : "border-red-50 opacity-60"
              }`}
            >
              <div className={`h-0.5 ${emp.isActive ? "bg-gradient-to-r from-violet-400 to-purple-400" : "bg-gradient-to-r from-red-300 to-red-400"}`} />
              <CardContent className="py-3 px-3 sm:px-4">
                {/* Compact row */}
                <button onClick={() => toggleExpand(emp.id)} className="w-full text-left">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      emp.isActive ? "bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600" : "bg-gray-100 text-gray-400"
                    }`}>
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{emp.firstName} {emp.lastName}</p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${roleColors[emp.role] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {emp.role}
                        </span>
                        {!emp.isActive && (
                          <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200 py-0">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{s.completedOrders} orders</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{s.servicesPerformed} services</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="flex items-center gap-0.5"><Percent className="h-2.5 w-2.5" />{emp.commissionRate}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-sm text-violet-700">ETB {s.totalInvoiceRevenue.toFixed(0)}</p>
                        <p className="text-[9px] text-emerald-600 font-medium">+ETB {s.totalCommissions.toFixed(0)} comm</p>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                    </div>
                  </div>

                  {/* Revenue bar */}
                  <div className="mt-2 h-1.5 bg-violet-50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-400 transition-all" style={{ width: `${revPct}%` }} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-dashed border-violet-100/60 space-y-4">
                    {/* Contact info */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.email}</span>
                      {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Joined {new Date(emp.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {emp.commissionRate}% commission</span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-lg bg-violet-50/60 border border-violet-100/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
                        <p className="font-bold text-sm text-violet-700">ETB {s.totalInvoiceRevenue.toFixed(0)}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Commissions</p>
                        <p className="font-bold text-sm text-emerald-700">ETB {s.totalCommissions.toFixed(0)}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg per Order</p>
                        <p className="font-bold text-sm text-blue-700">ETB {s.avgRevenuePerOrder.toFixed(0)}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-pink-50/60 border border-pink-100/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Heart className="h-2.5 w-2.5" /> Tips</p>
                        <p className="font-bold text-sm text-pink-700">ETB {s.totalTipsEarned.toFixed(0)}</p>
                      </div>
                    </div>

                    {/* Orders breakdown */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-gray-100 p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Scissors className="h-3 w-3" /> Orders
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-400" /><span>Total</span></div>
                            <span className="font-semibold">{s.totalOrders}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" /><span>Completed</span></div>
                            <span className="font-semibold text-emerald-600">{s.completedOrders}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-amber-400" /><span>In Progress</span></div>
                            <span className="font-semibold">{s.inProgressOrders}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><XCircle className="h-3 w-3 text-red-400" /><span>Cancelled</span></div>
                            <span className="font-semibold text-red-500">{s.cancelledOrders}</span>
                          </div>
                          {s.totalOrders > 0 && (
                            <div className="pt-1.5 border-t border-gray-100">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Completion Rate</span>
                                <span className="font-bold text-emerald-600">{s.completionRate.toFixed(1)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-100 p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Appointments
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-400" /><span>Total</span></div>
                            <span className="font-semibold">{s.totalAppointments}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" /><span>Completed</span></div>
                            <span className="font-semibold text-emerald-600">{s.completedAppointments}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><XCircle className="h-3 w-3 text-red-400" /><span>Cancelled</span></div>
                            <span className="font-semibold text-red-500">{s.cancelledAppointments}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-400" /><span>No-Show</span></div>
                            <span className="font-semibold text-amber-500">{s.noShowAppointments}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top services */}
                    {emp.topServices.length > 0 && (
                      <div className="rounded-lg border border-gray-100 p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Top Services
                        </p>
                        <div className="space-y-2">
                          {emp.topServices.map((svc) => {
                            const maxSvcRev = emp.topServices[0]?.revenue || 1;
                            const pct = (svc.revenue / maxSvcRev) * 100;
                            return (
                              <div key={svc.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Scissors className="h-3 w-3 text-violet-400 shrink-0" />
                                    <span className="truncate">{svc.name}</span>
                                    <span className="text-muted-foreground shrink-0">{svc.count}x</span>
                                  </div>
                                  <span className="font-semibold text-violet-700 shrink-0">ETB {svc.revenue.toFixed(0)}</span>
                                </div>
                                <div className="h-1.5 bg-violet-50 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-400" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* View full profile link */}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/admin/staff/${emp.id}`); }}
                      className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                    >
                      View full profile <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {employees.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">No employees found.</div>
        )}
      </div>
    </div>
  );
}
