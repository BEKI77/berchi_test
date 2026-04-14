"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, Plus, X, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Expense = {
  id: string;
  description: string;
  category: string;
  amount: string;
  date: string;
  staff: { firstName: string; lastName: string };
};

const categories = [
  "SUPPLIES", "RENT", "UTILITIES", "EQUIPMENT", "MARKETING", "SALARIES", "OTHER",
];

const catColors: Record<string, string> = {
  SUPPLIES: "bg-blue-50 text-blue-600",
  RENT: "bg-red-50 text-red-600",
  UTILITIES: "bg-amber-50 text-amber-600",
  EQUIPMENT: "bg-violet-50 text-violet-600",
  MARKETING: "bg-pink-50 text-pink-600",
  SALARIES: "bg-emerald-50 text-emerald-600",
  OTHER: "bg-gray-50 text-gray-600",
};

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: "",
    category: "SUPPLIES",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/expenses");
      if (!res.ok) throw new Error();
      setExpenses(await res.json());
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function handleSubmit() {
    if (!form.description || !form.amount || !form.date) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success("Expense logged");
      setShowForm(false);
      setForm({ description: "", category: "SUPPLIES", amount: 0, date: new Date().toISOString().split("T")[0] });
      await fetchExpenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-red-200 border-t-red-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-red-500" />
            Expenses
          </h1>
          <p className="text-muted-foreground mt-1">{expenses.length} expense(s) · Total: ETB {totalExpenses.toFixed(2)}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-200/40">
          <Plus className="h-4 w-4 mr-2" />
          Log Expense
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border-red-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-400 to-orange-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">New Expense</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was purchased..." className="rounded-xl border-red-100" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category *</Label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 rounded-xl border border-red-100 px-3 text-sm bg-white">
                  {categories.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount (ETB) *</Label>
                <Input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} className="rounded-xl border-red-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl border-red-100" />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-200/30">
              {saving ? "Saving..." : "Log Expense"}
            </Button>
          </CardContent>
        </Card>
      )}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-red-200 bg-gradient-to-b from-red-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100" style={{ animation: "float 4s ease-in-out infinite" }}>
            <Receipt className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold">No expenses logged</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">Start tracking your salon expenses here.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {expenses.map((e) => (
            <Card key={e.id} className="rounded-xl border-red-50 hover:border-red-100 transition-colors">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-orange-100 text-red-500 shrink-0">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{e.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${catColors[e.category] || "bg-gray-50 text-gray-600"}`}>
                        {e.category}
                      </span>
                      <span>{new Date(e.date).toLocaleDateString()}</span>
                      <span>by {e.staff.firstName}</span>
                    </div>
                  </div>
                </div>
                <p className="font-bold text-red-600 text-sm">ETB {Number(e.amount).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
