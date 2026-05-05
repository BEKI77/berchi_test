"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Expense, ExpenseForm, ScheduleForm } from "../types";
import { ExpenseSchedule } from "../types";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [schedules, setSchedules] = useState<ExpenseSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async (status?: string, type?: string, append: boolean = false) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (type) params.append("type", type);
      const res = await fetch(`/api/admin/expenses?${params}`);
      if (!res.ok) throw new Error();
      const newExpenses = await res.json();
      if (append) {
        setExpenses(prev => [...prev, ...newExpenses]);
      } else {
        setExpenses(newExpenses);
      }
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUpcomingExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/expenses/upcoming");
      if (!res.ok) throw new Error();
      setExpenses(await res.json());
    } catch {
      toast.error("Failed to load upcoming expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/expense-schedules");
      if (!res.ok) throw new Error();
      setSchedules(await res.json());
    } catch {
      toast.error("Failed to load schedules");
    }
  }, []);

  const createExpense = useCallback(async (form: ExpenseForm) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { 
        const d = await res.json(); 
        throw new Error(d.error || "Failed"); 
      }
      toast.success("Expense logged");
      await fetchExpenses();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchExpenses]);

  const updateExpense = useCallback(async (id: string, form: ExpenseForm) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Expense updated");
      await fetchExpenses();
      return true;
    } catch {
      toast.error("Failed to update expense");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchExpenses]);

  const markAsPaid = useCallback(async (expenseId: string) => {
    try {
      if (expenseId.startsWith("schedule-")) {
        const scheduleId = expenseId.replace("schedule-", "");
        const res = await fetch("/api/admin/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleId: scheduleId,
            status: "PAID",
            date: new Date().toISOString().split("T")[0]
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("Expense created and marked as paid");
        await fetchUpcomingExpenses();
        await fetchSchedules();
      } else {
        const res = await fetch(`/api/admin/expenses/${expenseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PAID", date: new Date().toISOString().split("T")[0] }),
        });
        if (!res.ok) throw new Error();
        toast.success("Marked as paid");
        await fetchExpenses();
      }
      return true;
    } catch {
      toast.error("Failed to mark as paid");
      return false;
    }
  }, [fetchExpenses, fetchUpcomingExpenses, fetchSchedules]);

  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return false;
    try {
      const res = await fetch(`/api/admin/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Expense deleted");
      await fetchExpenses();
      return true;
    } catch {
      toast.error("Failed to delete expense");
      return false;
    }
  }, [fetchExpenses]);

  const createSchedule = useCallback(async (form: ScheduleForm) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expense-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { 
        const d = await res.json(); 
        throw new Error(d.error || "Failed"); 
      }
      toast.success("Schedule created");
      await fetchSchedules();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchSchedules]);

  const updateSchedule = useCallback(async (id: string, form: ScheduleForm) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/expense-schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Schedule updated");
      await fetchSchedules();
      return true;
    } catch {
      toast.error("Failed to update schedule");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchSchedules]);

  const toggleSchedule = useCallback(async (scheduleId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/expense-schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(isActive ? "Schedule paused" : "Schedule activated");
      await fetchSchedules();
      return true;
    } catch {
      toast.error("Failed to update schedule");
      return false;
    }
  }, [fetchSchedules]);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return false;
    try {
      const res = await fetch(`/api/admin/expense-schedules/${scheduleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Schedule deleted");
      await fetchSchedules();
      return true;
    } catch {
      toast.error("Failed to delete schedule");
      return false;
    }
  }, [fetchSchedules]);

  return {
    expenses,
    schedules,
    loading,
    saving,
    fetchExpenses,
    fetchUpcomingExpenses,
    fetchSchedules,
    createExpense,
    updateExpense,
    markAsPaid,
    deleteExpense,
    createSchedule,
    updateSchedule,
    toggleSchedule,
    deleteSchedule,
  };
}
