"use client";

import { Button } from "@/components/ui/button";

type ReportsTab = "overview" | "revenue" | "operations" | "money" | "team";

type TabNavProps = {
  activeTab: ReportsTab;
  onChange: (tab: ReportsTab) => void;
};

const TABS: { key: ReportsTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "revenue", label: "Revenue" },
  { key: "operations", label: "Appointments & Orders" },
  { key: "money", label: "Payments & Expenses" },
  { key: "team", label: "Team & Services" },
];

export function TabNav({ activeTab, onChange }: TabNavProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {TABS.map((tab) => (
        <Button
          key={tab.key}
          type="button"
          size="sm"
          variant={activeTab === tab.key ? "default" : "ghost"}
          className="rounded-full text-xs"
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
