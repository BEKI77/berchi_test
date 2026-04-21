"use client";

import { Calendar, Globe, ShoppingCart } from "lucide-react";
import type { ReportData } from "../types";
import { Section } from "./section";

type OperationsTabProps = {
  appointmentStats: ReportData["appointmentStats"];
  orderStats: ReportData["orderStats"];
};

export function OperationsTab({ appointmentStats, orderStats }: OperationsTabProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Section title="Appointment Insights" icon={<Calendar className="h-4 w-4" />}>
        <p className="text-xs text-muted-foreground mb-3">
          Breakdown of all appointments — online bookings vs manual, and their final outcomes.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-pink-50 border border-pink-100 text-center">
            <p className="text-lg font-bold text-pink-700">{appointmentStats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Appointments</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <p className="text-lg font-bold text-blue-700">{appointmentStats.online}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Globe className="h-3 w-3" /> Online Bookings
            </p>
          </div>
        </div>
        <div className="mt-2 space-y-1.5">
          {[
            { label: "Confirmed", val: appointmentStats.confirmed, color: "bg-emerald-400" },
            { label: "Completed", val: appointmentStats.completed, color: "bg-indigo-400" },
            { label: "Cancelled", val: appointmentStats.cancelled, color: "bg-red-400" },
            { label: "No-Show", val: appointmentStats.noShow, color: "bg-amber-400" },
            { label: "Manual", val: appointmentStats.manual, color: "bg-gray-400" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                <span>{s.label}</span>
              </div>
              <span className="font-semibold">{s.val}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Order Status Breakdown" icon={<ShoppingCart className="h-4 w-4" />}>
        <p className="text-xs text-muted-foreground mb-3">
          Status of all service orders processed through the system.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <p className="text-lg font-bold text-blue-700">{orderStats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Orders</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-lg font-bold text-emerald-700">{orderStats.completed}</p>
            <p className="text-[10px] text-muted-foreground">Completed & Paid</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { label: "In Progress", val: orderStats.inProgress, color: "bg-amber-400" },
            { label: "Sent to Cashier", val: orderStats.sent, color: "bg-blue-400" },
            { label: "Cancelled", val: orderStats.cancelled, color: "bg-red-400" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                <span>{s.label}</span>
              </div>
              <span className="font-semibold">{s.val}</span>
            </div>
          ))}
        </div>
        {orderStats.total > 0 && (
          <div className="mt-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-[10px] text-muted-foreground">Completion Rate</p>
            <p className="font-bold text-sm">
              {((orderStats.completed / orderStats.total) * 100).toFixed(1)}%
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}
