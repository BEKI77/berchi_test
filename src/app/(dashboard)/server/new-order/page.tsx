"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export default function NewOrderPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then(setCustomers)
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    );
  });

  async function startOrder(customerId: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const order = await res.json();
      toast.success("Order created!");
      router.push(`/server/order/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create order");
      setCreating(false);
    }
  }

  async function createCustomerAndOrder() {
    if (!newFirst.trim() || !newLast.trim()) {
      toast.error("First and last name are required");
      return;
    }

    setCreating(true);
    try {
      const customerRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: newFirst.trim(),
          lastName: newLast.trim(),
          phone: newPhone.trim() || null,
        }),
      });

      if (!customerRes.ok) throw new Error("Failed to create customer");
      const customer = await customerRes.json();

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });

      if (!orderRes.ok) throw new Error("Failed to create order");
      const order = await orderRes.json();

      toast.success("Customer created & order started!");
      router.push(`/server/order/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl hover:bg-pink-50">
          <ArrowLeft className="h-5 w-5 text-pink-500" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Order</h1>
          <p className="text-sm text-muted-foreground">Select or create a customer to begin their session</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-400" />
        <Input
          placeholder="Search customers by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-12 text-base rounded-xl border-pink-100 bg-white focus:border-pink-300 focus:ring-pink-200 transition-all"
        />
      </div>

      {/* New customer quick form */}
      <button
        className={`w-full flex items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
          showNewCustomer
            ? "border-pink-300 bg-pink-50/50"
            : "border-pink-200/60 hover:border-pink-300 hover:bg-pink-50/30"
        }`}
        onClick={() => setShowNewCustomer(!showNewCustomer)}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-rose-100">
          <UserPlus className="h-5 w-5 text-pink-500" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground">
            {showNewCustomer ? "Hide Form" : "New Walk-in Customer"}
          </p>
          <p className="text-xs text-muted-foreground">Quick-add a customer and start their order</p>
        </div>
      </button>

      {showNewCustomer && (
        <Card className="rounded-xl border-pink-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Name *</Label>
                <Input
                  value={newFirst}
                  onChange={(e) => setNewFirst(e.target.value)}
                  placeholder="First name"
                  className="rounded-xl border-pink-100 focus:border-pink-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name *</Label>
                <Input
                  value={newLast}
                  onChange={(e) => setNewLast(e.target.value)}
                  placeholder="Last name"
                  className="rounded-xl border-pink-100 focus:border-pink-300"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone (optional)</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone number"
                className="rounded-xl border-pink-100 focus:border-pink-300"
              />
            </div>
            <Button
              onClick={createCustomerAndOrder}
              disabled={creating || !newFirst.trim() || !newLast.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/30 transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "Creating..." : "Create & Start Order"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="h-8 w-8 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading customers...</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((customer) => (
            <Card
              key={customer.id}
              className="card-hover cursor-pointer rounded-xl border-pink-50 hover:border-pink-200"
              onClick={() => !creating && startOrder(customer.id)}
            >
              <CardContent className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-sm font-bold text-pink-500 shrink-0">
                    {customer.firstName[0]}{customer.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {customer.firstName} {customer.lastName}
                    </p>
                    {customer.phone && (
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={creating}
                  className="rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-xs shadow-sm"
                >
                  Start
                </Button>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm">No customers found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search or add a new customer above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
