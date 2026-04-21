export type ReportData = {
  overview: {
    totalRevenue: number;
    totalTips: number;
    totalTax: number;
    totalDiscounts: number;
    totalExpenses: number;
    netProfit: number;
    todayRevenue: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    revenueGrowth: number;
    totalOrders: number;
    completedOrders: number;
    totalCustomers: number;
    newCustomersThisMonth: number;
    totalInvoices: number;
  };
  rangeMetrics: {
    revenue: number;
    subtotal: number;
    tips: number;
    tax: number;
    discounts: number;
    expenses: number;
    netProfit: number;
    invoiceCount: number;
    avgTransactionValue: number;
    newCustomers: number;
  };
  dailyRevenue: { date: string; revenue: number; orders: number; tips: number }[];
  busiestHours: { hour: number; label: string; count: number; revenue: number }[];
  paymentMethods: Record<string, { count: number; amount: number }>;
  staffPerformance: {
    id: string;
    name: string;
    totalOrders: number;
    completedOrders: number;
    serviceRevenue: number;
    servicesPerformed: number;
    commissionRate: number;
    commissionEarned: number;
  }[];
  allServices: { name: string; category: string; count: number; revenue: number }[];
  serviceCategories: { name: string; count: number; revenue: number }[];
  allProducts: { name: string; count: number; revenue: number }[];
  expenseByCategory: Record<string, number>;
  thisMonthExpenses: number;
  appointmentStats: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    online: number;
    manual: number;
  };
  orderStats: {
    total: number;
    completed: number;
    inProgress: number;
    sent: number;
    cancelled: number;
  };
};
