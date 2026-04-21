"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SectionProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
};

export function Section({ title, icon, children }: SectionProps) {
  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
