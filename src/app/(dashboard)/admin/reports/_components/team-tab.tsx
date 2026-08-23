"use client";

import { Package, Percent, Scissors, Users } from "lucide-react";
import type { ReportData } from "../types";
import { Section } from "./section";
import { formatMoney } from "@/lib/money";

type TeamTabProps = {
  staffPerformance: ReportData["staffPerformance"];
  serviceCategories: ReportData["serviceCategories"];
  allServices: ReportData["allServices"];
  allProducts: ReportData["allProducts"];
};

export function TeamTab({ staffPerformance, serviceCategories, allServices, allProducts }: TeamTabProps) {
  const totalServiceRevenue = allServices.reduce((s, v) => s + v.revenue, 0);

  return (
    <>
      {/* Staff Performance */}
      <Section title="Staff Performance & Commissions" icon={<Users className="h-4 w-4" />}>
        <p className="text-xs text-muted-foreground mb-3">
          Each staff member&apos;s contribution — revenue generated, services performed, and commission earned.
        </p>
        {staffPerformance.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No staff data yet.</p>
        ) : (
          <div className="space-y-3">
            {staffPerformance.map((s, i) => {
              const maxRev = staffPerformance[0]?.serviceRevenue || 1;
              const pct = (s.serviceRevenue / maxRev) * 100;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600 font-bold text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="font-semibold text-pink-700 shrink-0">
                        ETB {formatMoney(s.serviceRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>{s.completedOrders} orders</span>
                      <span>{s.servicesPerformed} services</span>
                      <span className="flex items-center gap-0.5">
                        <Percent className="h-2.5 w-2.5" /> {s.commissionRate}% rate
                      </span>
                      <span className="text-emerald-600 font-medium">
                        Commission: ETB {formatMoney(s.commissionEarned)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-pink-50 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Service Categories */}
      {serviceCategories.length > 0 && (
        <Section title="Revenue by Service Category" icon={<Scissors className="h-4 w-4" />}>
          <p className="text-xs text-muted-foreground mb-3">Which categories drive the most revenue.</p>
          <div className="space-y-2">
            {serviceCategories.map((cat) => {
              const pct = totalServiceRevenue > 0 ? (cat.revenue / totalServiceRevenue) * 100 : 0;
              return (
                <div
                  key={cat.name}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-fuchsia-50/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.count} performed · {pct.toFixed(0)}% of revenue
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-fuchsia-700 shrink-0">
                    ETB {formatMoney(cat.revenue)}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* All Services */}
        <Section title={`All Services (${allServices.length})`} icon={<Scissors className="h-4 w-4" />}>
          <p className="text-xs text-muted-foreground mb-3">Every service offered, ranked by revenue.</p>
          {allServices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No service data yet.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {allServices.map((s, i) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-pink-50/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-pink-400 w-5">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.count} performed · {s.category}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-pink-700 shrink-0">
                    ETB {formatMoney(s.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* All Products */}
        <Section title={`All Products (${allProducts.length})`} icon={<Package className="h-4 w-4" />}>
          <p className="text-xs text-muted-foreground mb-3">Every product sold, ranked by revenue.</p>
          {allProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No product data yet.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {allProducts.map((p, i) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-violet-50/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-violet-400 w-5">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.count} sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-violet-700 shrink-0">
                    ETB {formatMoney(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
