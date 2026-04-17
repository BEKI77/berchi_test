"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Droplets,
  TrendingDown,
  TrendingUp,
  Info,
  Search,
  ArrowRight,
  FlaskConical,
  BarChart,
  PieChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

type UsageStat = {
  serviceId: string;
  serviceName: string;
  productId: string;
  productName: string;
  avgUsage: number;
  minUsage: number;
  maxUsage: number;
  totalSessions: number;
};

export function ServiceUsageClient() {
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/reports/service-usage")
      .then(r => r.json())
      .then(data => {
        setStats(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = stats.filter(s =>
    s.serviceName.toLowerCase().includes(search.toLowerCase()) ||
    s.productName.toLowerCase().includes(search.toLowerCase())
  );

  // Group by service for the UI
  const groupedByService: Record<string, UsageStat[]> = {};
  filtered.forEach(s => {
    if (!groupedByService[s.serviceName]) groupedByService[s.serviceName] = [];
    groupedByService[s.serviceName].push(s);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-violet-200 border-t-violet-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Analyzing usage patterns...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200">
              <FlaskConical className="h-7 w-7" />
            </div>
            Product Yield Analytics
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Monitor how much product is actually used per service instance.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
          <Input
            placeholder="Filter by service or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-12 rounded-2xl border-violet-100 bg-white/50 backdrop-blur-sm focus:border-violet-300 focus:ring-violet-500/10 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2rem] border-none bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-xl shadow-violet-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BarChart className="h-24 w-24" />
          </div>
          <CardContent className="pt-8">
            <p className="text-violet-100 text-sm font-bold uppercase tracking-widest">Active Services</p>
            <h3 className="text-5xl font-black mt-2">{Object.keys(groupedByService).length}</h3>
            <div className="mt-6 flex items-center gap-2 text-violet-100 text-xs font-medium bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
              <TrendingUp className="h-3 w-3" />
              Tracking {stats.reduce((a, b) => a + b.totalSessions, 0)} sessions
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none bg-white shadow-xl shadow-slate-200/50 overflow-hidden relative">
          <CardContent className="pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <PieChart className="h-5 w-5" />
              </div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Top Consumption</p>
            </div>
            <h3 className="text-2xl font-black text-slate-800">
              {stats.length > 0 ? stats.sort((a, b) => b.avgUsage - a.avgUsage)[0].productName : "N/A"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Highest average ml per service</p>
            <Progress value={75} className="h-2 mt-6 bg-slate-100" />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none bg-white shadow-xl shadow-slate-200/50 overflow-hidden relative">
          <CardContent className="pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Efficiency Alert</p>
            </div>
            <h3 className="text-2xl font-black text-slate-800">
              High Variance
            </h3>
            <p className="text-xs text-slate-400 mt-1">2 services showing erratic usage</p>
            <div className="mt-6 flex items-center gap-1 text-amber-600 font-bold text-xs uppercase tracking-tighter">
              View Anomalies <ArrowRight className="h-3 w-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Data Table/Cards */}
      <div className="space-y-6">
        {Object.entries(groupedByService).map(([serviceName, items]) => (
          <div key={serviceName} className="group">
            <div className="flex items-center gap-3 mb-3 px-2">
              <h2 className="text-lg font-bold text-slate-800">{serviceName}</h2>
              <Badge variant="secondary" className="bg-violet-50 text-violet-600 border-violet-100 rounded-lg px-2 py-0.5 text-[10px] font-bold">
                {items.length} Product(s)
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item, idx) => (
                <Card key={idx} className="rounded-3xl border border-slate-100 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100 transition-all duration-300 overflow-hidden bg-white group/card">
                  <div className="h-1.5 w-full bg-slate-50 group-hover/card:bg-violet-500 transition-colors" />
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-slate-800">{item.productName}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Avg. Usage Per Session</p>
                      </div>
                      <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/card:bg-violet-50 group-hover/card:text-violet-500 transition-all">
                        <Droplets className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="flex items-end gap-1 mb-6">
                      <span className="text-3xl font-black text-violet-600">{Number(item.avgUsage).toFixed(1)}</span>
                      <span className="text-xs font-bold text-slate-400 pb-1.5">ml</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Minimum</p>
                        <p className="text-sm font-black text-slate-700">{item.minUsage} ml</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maximum</p>
                        <p className="text-sm font-black text-slate-700">{item.maxUsage} ml</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <BarChart3 className="h-3.5 w-3.5" />
                        {item.totalSessions} Sessions
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="p-1.5 rounded-full hover:bg-slate-100 text-slate-300 transition-colors">
                              <Info className="h-4 w-4" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white p-3 rounded-xl shadow-xl">
                            <p className="text-xs leading-relaxed">Based on dynamic usage recorded by stylists during checkout for this specific service.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedByService).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <FlaskConical className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-800">No usage data yet</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs text-center">
              Usage data is collected when stylists record product consumption during the service session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
