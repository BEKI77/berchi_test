"use client";

import { Calendar, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseSchedule } from "../types";
import { catColors } from "../constants";

interface ScheduleCardProps {
  schedule: ExpenseSchedule;
  canManageSchedules: boolean;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (schedule: ExpenseSchedule) => void;
  onDelete: (id: string) => void;
}

export function ScheduleCard({
  schedule,
  canManageSchedules,
  onToggle,
  onEdit,
  onDelete,
}: ScheduleCardProps) {
  return (
    <Card
      className={`rounded-xl border transition-colors ${schedule.isActive
          ? "border-red-50 hover:border-red-100"
          : "border-gray-200 bg-gray-50"
        }`}
    >
      <CardContent className="py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${schedule.isActive
              ? "bg-linear-to-br from-red-100 to-orange-100 text-red-500"
              : "bg-gray-200 text-gray-500"
            }`}>
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-sm">{schedule.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${catColors[schedule.category] || "bg-gray-50 text-gray-600"
                }`}>
                {schedule.category}
              </span>
              <span>{schedule.frequency}</span>
              <span>Next: {new Date(schedule.nextDueDate).toLocaleDateString()}</span>
              {schedule.autoPost && (
                <span className="text-green-600">Auto-post</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-bold text-red-600 text-sm">
            ETB {Number(schedule.amount).toFixed(2)}
          </p>
          <Button
            size="sm"
            onClick={() => onToggle(schedule.id, schedule.isActive)}
            variant="outline"
            className={`h-7 px-3 text-xs rounded-lg ${schedule.isActive
                ? "hover:bg-red-50"
                : "bg-green-50 hover:bg-green-100"
              }`}
          >
            {schedule.isActive ? "Pause" : "Activate"}
          </Button>
          {canManageSchedules && (
            <Button
              size="sm"
              onClick={() => onEdit(schedule)}
              variant="ghost"
              className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {canManageSchedules && (
            <Button
              size="sm"
              onClick={() => onDelete(schedule.id)}
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
