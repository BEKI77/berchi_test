"use client";

import { DollarSign, AlertCircle, RefreshCw, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Expense } from "../types";
import { catColors, statusColors } from "../constants";

interface ExpenseCardProps {
  expense: Expense;
  type: "history" | "upcoming";
  canUpdateExpenses: boolean;
  canDeleteExpenses: boolean;
  onMarkAsPaid?: (id: string) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseCard({
  expense,
  type,
  canUpdateExpenses,
  canDeleteExpenses,
  onMarkAsPaid,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const isUpcoming = type === "upcoming";

  return (
    <Card
      className={`rounded-xl transition-colors ${isUpcoming
          ? "border-yellow-100 hover:border-yellow-200"
          : "border-red-50 hover:border-red-100"
        }`}
    >
      <CardContent className="py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${isUpcoming
              ? "bg-linear-to-br from-yellow-100 to-orange-100 text-yellow-600"
              : "bg-linear-to-br from-red-100 to-orange-100 text-red-500"
            }`}>
            {isUpcoming ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <DollarSign className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{expense.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {isUpcoming ? (
                <>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[expense.status || "DUE"] || "bg-gray-50 text-gray-600"
                    }`}>
                    {expense.status || "DUE"}
                  </span>
                  <span>
                    Due: {expense.dueDate
                      ? new Date(expense.dueDate).toLocaleDateString()
                      : new Date(expense.date).toLocaleDateString()
                    }
                  </span>
                  {expense.schedule && (
                    <span className="text-blue-600">{expense.schedule.name}</span>
                  )}
                </>
              ) : (
                <>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${catColors[expense.category] || "bg-gray-50 text-gray-600"
                    }`}>
                    {expense.category}
                  </span>
                  <span>{new Date(expense.date).toLocaleDateString()}</span>
                  <span>by {expense.staff.firstName}</span>
                  {expense.type === "RECURRING" && (
                    <RefreshCw className="h-3 w-3 text-blue-500" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-bold text-red-600 text-sm">
            ETB {Number(expense.amount).toFixed(2)}
          </p>
          {isUpcoming && onMarkAsPaid && (
            <Button
              size="sm"
              onClick={() => onMarkAsPaid(expense.id)}
              className="h-7 px-3 text-xs rounded-lg bg-green-500 hover:bg-green-600"
            >
              Mark Paid
            </Button>
          )}
          {canUpdateExpenses && (
            <Button
              size="sm"
              onClick={() => onEdit(expense)}
              variant="ghost"
              className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {canDeleteExpenses && (
            <Button
              size="sm"
              onClick={() => onDelete(expense.id)}
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
