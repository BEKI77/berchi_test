"use client";

import { BarChart3, Clock } from "lucide-react";
import type { ReportData } from "../types";
import { Section } from "./section";
import { formatMoney } from "@/lib/money";

type RevenueTabProps = {
  dailyRevenue: ReportData["dailyRevenue"];
  busiestHours: ReportData["busiestHours"];
};

export function RevenueTab({ dailyRevenue, busiestHours }: RevenueTabProps) {
  const maxDailyRevenue = Math.max(...dailyRevenue.map((d) => d.revenue), 1);
  const maxHourCount = Math.max(...busiestHours.map((h) => h.count), 1);

  return (
    <>
      {/* Daily Revenue Chart */}
      <Section title={`Daily Revenue (${dailyRevenue.length} days)`} icon={<BarChart3 className="h-4 w-4" />}>
        <div className="flex items-end gap-[3px] h-40">
          {dailyRevenue.map((d) => {
            const heightPct = maxDailyRevenue > 0 ? (d.revenue / maxDailyRevenue) * 100 : 0;
            const isToday = d.date === new Date().toISOString().split("T")[0];
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-[10px] px-2 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                    <p className="font-semibold">ETB {formatMoney(d.revenue)}</p>
                    <p className="text-gray-300">
                      {d.orders} orders 
· Tips: ETB {formatMoney(d.tips)}
                    </p>
                    <p className="text-gray-400">{d.date}</p>
                  </div>
                </div>
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isToday
                      ? "bg-gradient-to-t from-indigo-500 to-indigo-400"
                      : "bg-gradient-to-t from-indigo-200 to-indigo-300 group-hover:from-indigo-300 group-hover:to-indigo-400"
                  }`}
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-muted-foreground">
          <span>{dailyRevenue[0]?.date}</span>
          <span>{dailyRevenue[dailyRevenue.length - 1]?.date}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] text-muted-foreground">Best Day</p>
            <p className="font-bold text-sm text-indigo-700">
              ETB {formatMoney(Math.max(...dailyRevenue.map((d) => d.revenue)))}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] text-muted-foreground">Daily Average</p>
            <p className="font-bold text-sm text-indigo-700">
              ETB
              {formatMoney((
                dailyRevenue.reduce((s, d) => s + d.revenue, 0) /
                Math.max(dailyRevenue.length, 1)
              ))}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] text-muted-foreground">Total Orders</p>
            <p className="font-bold text-sm text-indigo-700">
              {dailyRevenue.reduce((s, d) => s + d.orders, 0)}
            </p>
          </div>
        </div>
      </Section>

      {/* Busiest Hours */}
      {busiestHours.length > 0 && (
        <Section title="Busiest Hours — When Customers Come" icon={<Clock className="h-4 w-4" />}>
          <p className="text-xs text-muted-foreground mb-3">
            This shows which hours your salon gets the most business. Plan staffing accordingly.
          </p>
          <div className="flex items-end gap-1 h-28">
            {busiestHours.map((h) => {
              const pct = (h.count / maxHourCount) * 100;
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                      <p className="font-semibold">{h.count} transactions</p>
                      <p className="text-gray-300">ETB {formatMoney(h.revenue)}</p>
                    </div>
                  </div>
                  <div
                    className="w-full rounded-t-sm bg-gradient-to-t from-amber-400 to-amber-300 group-hover:from-amber-500 group-hover:to-amber-400 transition-all"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-[8px] mt-1 text-muted-foreground">{h.label}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}
