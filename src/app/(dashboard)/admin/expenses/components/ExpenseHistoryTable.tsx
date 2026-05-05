"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, RefreshCw, Filter, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Expense } from "../types";
import { categories, catColors } from "../constants";

interface ExpenseHistoryTableProps {
  expenses: Expense[];
  loading: boolean;
  canUpdateExpenses: boolean;
  canDeleteExpenses: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;

export function ExpenseHistoryTable({
  expenses,
  loading,
  canUpdateExpenses,
  canDeleteExpenses,
  onEdit,
  onDelete,
}: ExpenseHistoryTableProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });
  const [amountRange, setAmountRange] = useState({
    min: "",
    max: ""
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Filter expenses based on search, category, date range, and amount range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = expense.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
        expense.staff.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.staff.lastName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;

      const expenseDate = new Date(expense.date);
      const matchesDateRange = (
        (!dateRange.start || expenseDate >= new Date(dateRange.start)) &&
        (!dateRange.end || expenseDate <= new Date(dateRange.end))
      );

      const expenseAmount = Number(expense.amount);
      const matchesAmountRange = (
        (!amountRange.min || expenseAmount >= Number(amountRange.min)) &&
        (!amountRange.max || expenseAmount <= Number(amountRange.max))
      );

      return matchesSearch && matchesCategory && matchesDateRange && matchesAmountRange;
    });
  }, [expenses, searchTerm, selectedCategory, dateRange, amountRange]);

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, dateRange, amountRange]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-red-200 border-t-red-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading expense history...</p>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-red-200 bg-linear-to-b from-red-50/50 to-white">
        <RefreshCw className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-semibold">No expense history</h3>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs">Start tracking your salon expenses here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Expense History</h2>
          <p className="text-muted-foreground">
            {filteredExpenses.length} expenses found
            {filteredExpenses.length !== expenses.length &&
              ` (filtered from ${expenses.length} total)`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            ETB {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)} total
          </Badge>
          {filteredExpenses.length !== expenses.length && (
            <Badge variant="outline" className="text-sm">
              ETB {filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)} filtered
            </Badge>
          )}
        </div>
      </div>

      {/* Basic Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses by description or staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value || "all")}>
              <SelectTrigger className="w-full lg:w-48 h-11">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0) + category.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="h-11"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvancedFilters ? "Hide" : "Show"} Advanced
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <Card className="border-0 shadow-sm bg-muted/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Range */}
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Range
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    placeholder="Start date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    placeholder="End date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amount Range (ETB)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={amountRange.min}
                    onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value }))}
                    className="flex-1"
                    min="0"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={amountRange.max}
                    onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value }))}
                    className="flex-1"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <div className=" overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Staff</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground font-medium">
                        {filteredExpenses.length === 0
                          ? "No expenses found matching your filters"
                          : "No expenses to display"
                        }
                      </p>
                      {filteredExpenses.length === 0 && expenses.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm("");
                            setSelectedCategory("all");
                            setDateRange({ start: "", end: "" });
                            setAmountRange({ min: "", max: "" });
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedExpenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {expense.description}
                        {expense.type === "RECURRING" && (
                          <RefreshCw className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`font-medium ${catColors[expense.category] || "bg-gray-50 text-gray-600"}`}>
                        {expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.staff.firstName} {expense.staff.lastName}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      ETB {Number(expense.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdateExpenses && (
                          <Button
                            size="sm"
                            onClick={() => onEdit(expense)}
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteExpenses && (
                          <Button
                            size="sm"
                            onClick={() => onDelete(expense.id)}
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)} of {filteredExpenses.length} expenses
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
