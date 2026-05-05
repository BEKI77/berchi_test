"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, Plus, Clock, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Expense, ExpenseSchedule, ExpenseForm, ScheduleForm, Tab, ExpensesClientProps } from "./types";
import { ExpenseForm as ExpenseFormComponent } from "./components/ExpenseForm";
import { ScheduleForm as ScheduleFormComponent } from "./components/ScheduleForm";
import { ExpenseCard } from "./components/ExpenseCard";
import { ScheduleCard } from "./components/ScheduleCard";
import { TabsNavigation } from "./components/TabsNavigation";
import { ExpenseHistoryTable } from "./components/ExpenseHistoryTable";
import { useExpenses } from "./hooks/useExpenses";

export function ExpensesClient({ canDeleteExpenses, canUpdateExpenses, canManageSchedules }: ExpensesClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ExpenseSchedule | null>(null);
  const [form, setForm] = useState<ExpenseForm>({
    description: "",
    category: "SUPPLIES",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    name: "",
    description: "",
    category: "RENT",
    amount: 0,
    frequency: "MONTHLY",
    interval: 1,
    startDate: new Date().toISOString().split("T")[0],
    autoPost: false,
  });

  const {
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
  } = useExpenses();

  useEffect(() => {
    if (activeTab === "recurring") {
      fetchSchedules();
    } else if (activeTab === "upcoming") {
      fetchUpcomingExpenses();
    } else {
      fetchExpenses("PAID", undefined);
    }
  }, [activeTab, fetchExpenses, fetchSchedules, fetchUpcomingExpenses]);

  async function handleExpenseSubmit() {
    if (!form.description || !form.amount || !form.date) {
      toast.error("All fields are required");
      return;
    }

    if (editingExpense) {
      const success = await updateExpense(editingExpense.id, form);
      if (success) {
        closeExpenseForm();
      }
    } else {
      const success = await createExpense(form);
      if (success) {
        closeExpenseForm();
      }
    }
  }

  async function handleScheduleSubmit() {
    if (!scheduleForm.name || !scheduleForm.amount || !scheduleForm.frequency) {
      toast.error("All required fields must be filled");
      return;
    }

    if (editingSchedule) {
      const success = await updateSchedule(editingSchedule.id, scheduleForm);
      if (success) {
        closeScheduleForm();
      }
    } else {
      const success = await createSchedule(scheduleForm);
      if (success) {
        closeScheduleForm();
      }
    }
  }


  function startEditExpense(expense: Expense) {
    setEditingExpense(expense);
    setForm({
      description: expense.description,
      category: expense.category,
      amount: Number(expense.amount),
      date: expense.date,
    });
    setShowExpenseForm(true);
  }

  function closeExpenseForm() {
    setShowExpenseForm(false);
    setEditingExpense(null);
    setForm({
      description: "",
      category: "SUPPLIES",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
    });
  }

  function startEditSchedule(schedule: ExpenseSchedule) {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      description: schedule.description || "",
      category: schedule.category,
      amount: Number(schedule.amount),
      frequency: schedule.frequency,
      interval: schedule.interval,
      startDate: schedule.nextDueDate,
      autoPost: schedule.autoPost,
    });
    setShowScheduleForm(true);
  }

  function closeScheduleForm() {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setScheduleForm({
      name: "",
      description: "",
      category: "RENT",
      amount: 0,
      frequency: "MONTHLY",
      interval: 1,
      startDate: new Date().toISOString().split("T")[0],
      autoPost: false,
    });
  }

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-red-500" />
            Expenses
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeTab === "history" && `${expenses.length} expense(s) · Total: ETB ${totalExpenses.toFixed(2)}`}
            {activeTab === "upcoming" && `${expenses.length} upcoming expense(s)`}
            {activeTab === "recurring" && `${schedules.length} schedule(s)`}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "recurring" ? (
            <Button onClick={() => setShowScheduleForm(true)} className="rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-200/40">
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          ) : (
            <Button onClick={() => setShowExpenseForm(true)} className="rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-200/40">
              <Plus className="h-4 w-4 mr-2" />
              Log Expense
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <TabsNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Expense Form */}
      {(showExpenseForm && activeTab === "history") && (
        <ExpenseFormComponent
          form={form}
          setForm={setForm}
          onSubmit={handleExpenseSubmit}
          onClose={closeExpenseForm}
          saving={saving}
          editingExpense={editingExpense}
        />
      )}

      {/* Schedule Form */}
      {(showScheduleForm && activeTab === "recurring") && (
        <ScheduleFormComponent
          form={scheduleForm}
          setForm={setScheduleForm}
          onSubmit={handleScheduleSubmit}
          onClose={closeScheduleForm}
          saving={saving}
          editingSchedule={editingSchedule}
        />
      )}

      {/* Content */}
      {activeTab === "upcoming" && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-10 w-10 rounded-full border-3 border-red-200 border-t-red-500 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading upcoming expenses...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-red-200 bg-linear-to-b from-red-50/50 to-white">
              <Clock className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold">No upcoming expenses</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">All your recurring expenses are up to date.</p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  type="upcoming"
                  canUpdateExpenses={canUpdateExpenses}
                  canDeleteExpenses={canDeleteExpenses}
                  onMarkAsPaid={markAsPaid}
                  onEdit={startEditExpense}
                  onDelete={deleteExpense}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "history" && (
        <ExpenseHistoryTable
          expenses={expenses}
          loading={loading}
          canUpdateExpenses={canUpdateExpenses}
          canDeleteExpenses={canDeleteExpenses}
          onEdit={startEditExpense}
          onDelete={deleteExpense}
        />
      )}

      {activeTab === "recurring" && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-10 w-10 rounded-full border-3 border-red-200 border-t-red-500 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading schedules...</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-red-200 bg-linear-to-b from-red-50/50 to-white">
              <RefreshCw className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold">No recurring schedules</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">Set up recurring expenses like rent and salaries.</p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  canManageSchedules={canManageSchedules}
                  onToggle={toggleSchedule}
                  onEdit={startEditSchedule}
                  onDelete={deleteSchedule}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
