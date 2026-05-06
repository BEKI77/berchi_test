"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpenseSchedule, ScheduleForm } from "../types";
import { categories, frequencies } from "../constants";

interface ScheduleFormProps {
  form: ScheduleForm;
  setForm: (form: ScheduleForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  saving: boolean;
  editingSchedule: ExpenseSchedule | null;
}

export function ScheduleForm({
  form,
  setForm,
  onSubmit,
  onClose,
  saving,
  editingSchedule
}: ScheduleFormProps) {
  return (
    <Card className="rounded-xl border-red-200 overflow-hidden">
      <div className="h-1 bg-linear-to-r from-red-400 to-orange-400" />
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {editingSchedule ? "Edit Schedule" : "New Recurring Expense Schedule"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Name *
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Shop Rent"
            className="rounded-xl border-red-100"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Description
          </Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
            className="rounded-xl border-red-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Category *
            </Label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full h-10 rounded-xl border border-red-100 px-3 text-sm bg-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Amount (ETB) *
            </Label>
            <Input
              type="number"
              min={0}
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
              className="rounded-xl border-red-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Frequency *
            </Label>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="w-full h-10 rounded-xl border border-red-100 px-3 text-sm bg-white"
            >
              {frequencies.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Start Date *
            </Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-xl border-red-100"
            />
          </div>
        </div>

        <Button
          onClick={onSubmit}
          disabled={saving}
          className="w-full h-11 rounded-xl bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-200/30"
        >
          {saving ? "Saving..." : (editingSchedule ? "Update Schedule" : "Create Schedule")}
        </Button>
      </CardContent>
    </Card>
  );
}
