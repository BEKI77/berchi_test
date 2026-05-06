export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: string;
  date: string;
  status?: string;
  type?: string;
  dueDate?: string;
  staff: { firstName: string; lastName: string };
  payeeStaff?: { firstName: string; lastName: string } | null;
  schedule?: { id: string; name: string } | null;
};

export type ExpenseSchedule = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  amount: string;
  frequency: string;
  interval: number;
  nextDueDate: string;
  isActive: boolean;
  autoPost: boolean;
  payeeStaff?: { firstName: string; lastName: string } | null;
  payeeName: string | null;
};

export type Tab = "upcoming" | "history" | "recurring";

export interface ExpensesClientProps {
  canDeleteExpenses: boolean;
  canUpdateExpenses: boolean;
  canManageSchedules: boolean;
}

export interface ExpenseForm {
  description: string;
  category: string;
  amount: number;
  date: string;
}

export interface ScheduleForm {
  name: string;
  description: string;
  category: string;
  amount: number;
  frequency: string;
  interval: number;
  startDate: string;
  autoPost: boolean;
}
