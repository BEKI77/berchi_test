"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Scissors,
  Package,
  CheckCircle,
  User,
  Percent,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { customerName, customerInitials } from "@/lib/orders";

type OrderItem = {
  id: string;
  unitPrice: string;
  quantity: number;
  service: { id: string; name: string };
};

type OrderProduct = {
  id: string;
  unitPrice: string;
  quantity: number;
  product: { id: string; name: string };
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  server: { id: string; firstName: string; lastName: string };
  items: OrderItem[];
  products: OrderProduct[];
};

type DiscountType = "PERCENTAGE" | "FIXED" | null;

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error();
      const found: Order = await res.json();
      if (found.status === "CHECKED_OUT" || found.status === "CANCELLED") {
        throw new Error("Order already closed");
      }
      setOrder(found);
    } catch {
      toast.error("Order not found or already checked out");
      router.push("/cashier");
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Fetch salon settings for tax rate
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.taxRate) setTaxRate(Number(data.taxRate));
      })
      .catch(() => { });
  }, []);

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  const servicesSubtotal = order.items.reduce(
    (s, i) => s + Number(i.unitPrice) * i.quantity,
    0
  );
  const productsSubtotal = order.products.reduce(
    (s, p) => s + Number(p.unitPrice) * p.quantity,
    0
  );
  const subtotal = servicesSubtotal + productsSubtotal;
  const taxAmount = subtotal * (taxRate / 100);
  const discountAmount =
    discountType === "PERCENTAGE"
      ? subtotal * (discountValue / 100)
      : discountType === "FIXED"
        ? discountValue
        : 0;
  const total = subtotal + taxAmount - discountAmount + tipAmount;

  // One action: record the payment and move on. The cashier does not pick a
  // method -- the invoice records CASH by default, which is how the salon is
  // paid. The Chapa routes remain in the repo, unused, if that ever changes.
  async function confirmPayment() {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType,
          discountValue,
          tipAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Checkout failed");
      }

      const result = await res.json();
      toast.success("Payment confirmed");
      router.push(`/cashier/receipt/${result.invoice.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process checkout"
      );
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/cashier")} className="rounded-xl hover:bg-emerald-50">
          <ArrowLeft className="h-5 w-5 text-emerald-500" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{order.orderNumber}</span>
          </div>
        </div>
      </div>

      {/* Customer & Server info */}
      <Card className="rounded-xl border-emerald-100 overflow-hidden">
        <div className="h-1 bg-linear-to-r from-emerald-400 to-teal-400" />
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-emerald-100 to-teal-100 text-sm font-bold text-emerald-600 shrink-0">
                {customerInitials(order.customer)}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Customer</p>
                <p className="font-medium text-sm">{customerName(order.customer)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-pink-100 to-rose-100 text-sm font-bold text-pink-500 shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Stylist</p>
                <p className="font-medium text-sm">{order.server.firstName} {order.server.lastName}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itemized bill */}
      <Card className="rounded-xl border-emerald-100 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-emerald-600">
            Order Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Services */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              <Scissors className="h-3 w-3" />
              Services
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-0.5">
                <span>{item.service.name} {item.quantity > 1 && `x${item.quantity}`}</span>
                <span className="font-medium">ETB {(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            {order.products.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2 mb-1">
                  <Package className="h-3 w-3" />
                  Products
                </div>
                {order.products.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm py-0.5">
                    <span>{p.product.name} x{p.quantity}</span>
                    <span className="font-medium">ETB {(Number(p.unitPrice) * p.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <Separator className="border-dashed border-emerald-100" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">ETB {subtotal.toFixed(2)}</span>
            </div>

            {taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span className="font-medium">ETB {taxAmount.toFixed(2)}</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount{discountType === "PERCENTAGE" ? ` (${discountValue}%)` : ""}</span>
                <span className="font-medium">- ETB {discountAmount.toFixed(2)}</span>
              </div>
            )}

            {tipAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tip</span>
                <span className="font-medium">ETB {tipAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <Separator className="border-dashed border-emerald-100" />

          <div className="flex justify-between items-center">
            <span className="font-semibold text-base">Total</span>
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              ETB {total.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Discount & Tip */}
      <Card className="rounded-xl border-amber-100 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-300 to-orange-300" />
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-amber-600">
            <Percent className="h-4 w-4" />
            Discount & Tip
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discount Type</Label>
            <div className="flex gap-2">
              <button
                onClick={() => { setDiscountType(null); setDiscountValue(0); }}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${discountType === null
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-border hover:bg-muted"
                  }`}
              >
                None
              </button>
              <button
                onClick={() => setDiscountType("PERCENTAGE")}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${discountType === "PERCENTAGE"
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-border hover:bg-muted"
                  }`}
              >
                <Percent className="h-3.5 w-3.5" />
                %
              </button>
              <button
                onClick={() => setDiscountType("FIXED")}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${discountType === "FIXED"
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-border hover:bg-muted"
                  }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Fixed
              </button>
            </div>
          </div>

          {discountType && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {discountType === "PERCENTAGE" ? "Discount %" : "Discount Amount (ETB)"}
              </Label>
              <Input
                type="number"
                min={0}
                max={discountType === "PERCENTAGE" ? 100 : subtotal}
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                className="h-11 rounded-xl border-amber-100 focus:border-amber-300"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tip Amount (ETB)</Label>
            <Input
              type="number"
              min={0}
              value={tipAmount || ""}
              onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
              className="h-11 rounded-xl border-amber-100 focus:border-amber-300"
            />
          </div>
        </CardContent>
      </Card>

      {/* Process button */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-white/80 backdrop-blur-lg border-t border-emerald-100/50">
        <Button
          onClick={confirmPayment}
          disabled={processing}
          className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-600 shadow-lg shadow-emerald-300/30 hover:shadow-emerald-400/40 transition-all duration-300 hover:-translate-y-0.5"
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          {processing ? "Confirming..." : `Confirm Payment — ETB ${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
