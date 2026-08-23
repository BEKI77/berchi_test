"use client";

import type { ReactNode } from "react";
import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import type { ReportData } from "../types";
import { Section } from "./section";
import { formatMoney } from "@/lib/money";

type MoneyTabProps = {
  paymentMethods: ReportData["paymentMethods"];
  expenseByCategory: ReportData["expenseByCategory"];
  thisMonthExpenses: ReportData["thisMonthExpenses"];
};

const methodIcons: Record<string, ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  CARD: <CreditCard className="h-4 w-4" />,
  MOBILE: <Smartphone className="h-4 w-4" />,
};

const methodColors: Record<string, string> = {
  CASH: "from-green-400 to-emerald-500",
  CARD: "from-blue-400 to-indigo-500",
  MOBILE: "from-orange-400 to-amber-500",
  UNKNOWN: "from-gray-400 to-gray-500",
};

const expenseCategoryColors: Record<string, string> = {
  SUPPLIES: "bg-blue-400",
  RENT: "bg-red-400",
  UTILITIES: "bg-amber-400",
  EQUIPMENT: "bg-violet-400",
  MARKETING: "bg-pink-400",
  SALARY: "bg-emerald-400",
  OTHER: "bg-gray-400",
};

export function MoneyTab({ paymentMethods, expenseByCategory, thisMonthExpenses }: MoneyTabProps) {
  const totalPaymentAmount = Object.values(paymentMethods).reduce((s, p) => s + p.amount, 0);
  const totalExpenseAmount = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Payment Methods */}
      <Section title="Payment Methods" icon={<CreditCard className="h-4 w-4" />}>
        <p className="text-xs text-muted-foreground mb-3">How your customers prefer to pay.</p>
        {Object.entries(paymentMethods).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No payment data yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(paymentMethods).map(([method, info]) => {
              const pct = totalPaymentAmount > 0 ? (info.amount / totalPaymentAmount) * 100 : 0;
              return (
                <div key={method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${
                          methodColors[method] || methodColors.UNKNOWN
                        } text-white`}
                      >
                        {methodIcons[method] || <CreditCard className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <span className="font-medium">{method}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">ETB {formatMoney(info.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{info.count} payments</p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${
                        methodColors[method] || methodColors.UNKNOWN
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Expenses */}
      <Section title="Expense Breakdown" icon={<Wallet className="h-4 w-4" />}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">Where your money goes.</p>
          <span className="text-xs font-medium text-red-600">
            This month: ETB {formatMoney(thisMonthExpenses)}
          </span>
        </div>
        {Object.keys(expenseByCategory).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No expense data yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(expenseByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => {
                const pct = totalExpenseAmount > 0 ? (amount / totalExpenseAmount) * 100 : 0;
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            expenseCategoryColors[category] || "bg-gray-400"
                          }`}
                        />
                        <span className="font-medium capitalize">{category.toLowerCase()}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">ETB {formatMoney(amount)}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          expenseCategoryColors[category] || "bg-gray-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Section>
    </div>
  );
}
