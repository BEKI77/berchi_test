"use client";

import { Clock, Receipt, RefreshCw } from "lucide-react";
import { Tab } from "../types";

interface TabsNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabsNavigation({ activeTab, onTabChange }: TabsNavigationProps) {
  const tabs = [
    { id: "upcoming" as Tab, label: "Upcoming", icon: Clock },
    { id: "history" as Tab, label: "History", icon: Receipt },
    { id: "recurring" as Tab, label: "Recurring", icon: RefreshCw },
  ];

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-xl">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === id
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
