export const categories = [
  "SUPPLIES", "RENT", "UTILITIES", "EQUIPMENT", "MARKETING", "SALARIES", "OTHER",
];

export const frequencies = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

export const catColors: Record<string, string> = {
  SUPPLIES: "bg-blue-50 text-blue-600",
  RENT: "bg-red-50 text-red-600",
  UTILITIES: "bg-amber-50 text-amber-600",
  EQUIPMENT: "bg-violet-50 text-violet-600",
  MARKETING: "bg-pink-50 text-pink-600",
  SALARIES: "bg-emerald-50 text-emerald-600",
  OTHER: "bg-gray-50 text-gray-600",
};

export const statusColors: Record<string, string> = {
  DUE: "bg-yellow-50 text-yellow-600",
  PAID: "bg-green-50 text-green-600",
  OVERDUE: "bg-red-50 text-red-600",
  SKIPPED: "bg-gray-50 text-gray-600",
};
