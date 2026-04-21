"use client";

import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DateRangeCardProps = {
  rangeLabel: string;
  activeRange: string;
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  onPreset: (preset: string) => void;
  onChangeFrom: (value: string) => void;
  onChangeTo: (value: string) => void;
  onApplyCustom: () => void;
};

export function DateRangeCard({
  rangeLabel,
  activeRange,
  loading,
  dateFrom,
  dateTo,
  onPreset,
  onChangeFrom,
  onChangeTo,
  onApplyCustom,
}: DateRangeCardProps) {
  return (
    <Card className="rounded-xl border-indigo-100 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-400 to-purple-400" />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-700">Date Range</span>
          <span className="text-xs text-muted-foreground ml-auto block md:hidden">
            Showing: <strong>{rangeLabel}</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { key: "all", label: "All Time" },
            { key: "today", label: "Today" },
            { key: "week", label: "Last 7 Days" },
            { key: "month", label: "This Month" },
            { key: "lastMonth", label: "Last Month" },
            { key: "year", label: "This Year" },
          ].map((p) => (
            <Button
              key={p.key}
              type="button"
              onClick={() => onPreset(p.key)}
              disabled={loading}
              size="sm"
              variant={activeRange === p.key ? "default" : "outline"}
              className="rounded-full text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onChangeFrom(e.target.value)}
            className="h-8 text-xs rounded-lg flex-1"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onChangeTo(e.target.value)}
            className="h-8 text-xs rounded-lg flex-1"
          />
          <Button
            onClick={onApplyCustom}
            disabled={loading}
            size="sm"
            className="h-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-xs px-4"
          >
            {loading ? "..." : "Apply"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
