"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Scissors,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { customerName } from "@/lib/orders";

type ReceiptData = {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountType: string | null;
  discountValue: string;
  discountAmount: string;
  tipAmount: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  order: {
    orderNumber: string;
    startedAt: string;
    customer: { firstName: string; lastName: string; phone: string | null } | null;
    server: { firstName: string; lastName: string };
    items: { unitPrice: string; quantity: number; service: { name: string } }[];
    products: { unitPrice: string; quantity: number; product: { name: string } }[];
  };
  payment: { method: string; amount: string; reference: string | null; createdAt: string } | null;
};

const methodIcons: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  CARD: <CreditCard className="h-4 w-4" />,
  MOBILE: <Smartphone className="h-4 w-4" />,
};

export default function ReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReceipt = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) throw new Error();
      setReceipt(await res.json());
    } catch {
      toast.error("Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  if (loading || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-emerald-200 border-t-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  const date = new Date(receipt.createdAt);

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Top Nav */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl hover:bg-emerald-50">
          <ArrowLeft className="h-5 w-5 text-emerald-600" />
        </Button>
        <Button
          onClick={() => window.print()}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200/40"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Receipt
        </Button>
      </div>

      {/* Receipt Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden print:shadow-none print:border-none print:rounded-none">
        {/* Header */}
        <div className="text-center pt-8 pb-5 px-6 bg-gradient-to-b from-emerald-50/80 to-white">
          <h1 className="text-2xl font-black tracking-tight text-emerald-700">BERCHI SALON</h1>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Beauty & Wellness</p>
          <Separator className="mt-4" />
        </div>

        {/* Invoice Info */}
        <div className="px-6 py-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Invoice #</span>
            <span className="font-semibold">{receipt.invoiceNumber}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Date</span>
            <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Order</span>
            <span>{receipt.order.orderNumber}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{customerName(receipt.order.customer)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Server</span>
            <span>{receipt.order.server.firstName} {receipt.order.server.lastName}</span>
          </div>
        </div>

        <div className="px-6">
          <Separator />
        </div>

        {/* Services */}
        {receipt.order.items.length > 0 && (
          <div className="px-6 py-3">
            <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest flex items-center gap-1 mb-2">
              <Scissors className="h-3 w-3" /> Services
            </p>
            {receipt.order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs py-1">
                <span>
                  {item.service.name}
                  {item.quantity > 1 && <span className="text-muted-foreground"> x{item.quantity}</span>}
                </span>
                <span className="font-medium">ETB {(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Products */}
        {receipt.order.products.length > 0 && (
          <div className="px-6 py-3">
            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest flex items-center gap-1 mb-2">
              <Package className="h-3 w-3" /> Products
            </p>
            {receipt.order.products.map((p, i) => (
              <div key={i} className="flex justify-between text-xs py-1">
                <span>
                  {p.product.name}
                  {p.quantity > 1 && <span className="text-muted-foreground"> x{p.quantity}</span>}
                </span>
                <span className="font-medium">ETB {(Number(p.unitPrice) * p.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="px-6">
          <Separator />
        </div>

        {/* Totals */}
        <div className="px-6 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span>ETB {Number(receipt.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tax ({Number(receipt.taxRate).toFixed(1)}%)</span>
            <span>ETB {Number(receipt.taxAmount).toFixed(2)}</span>
          </div>
          {Number(receipt.discountAmount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Discount {receipt.discountType === "PERCENTAGE" ? `(${Number(receipt.discountValue)}%)` : ""}
              </span>
              <span className="text-red-500">-ETB {Number(receipt.discountAmount).toFixed(2)}</span>
            </div>
          )}
          {Number(receipt.tipAmount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tip</span>
              <span className="text-emerald-600">+ETB {Number(receipt.tipAmount).toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-1.5" />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-emerald-700">ETB {Number(receipt.totalAmount).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment */}
        {receipt.payment && (
          <>
            <div className="px-6"><Separator /></div>
            <div className="px-6 py-3">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  {methodIcons[receipt.payment.method] || <CreditCard className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <span className="font-medium">Paid via {receipt.payment.method}</span>
                  {receipt.payment.reference && (
                    <span className="text-muted-foreground ml-2">Ref: {receipt.payment.reference}</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Status */}
        <div className="px-6 py-4 bg-emerald-50/50 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold text-sm uppercase tracking-wider">{receipt.status}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-5 px-6 border-t border-dashed border-gray-200">
          <p className="text-[10px] text-muted-foreground">Thank you for visiting Berchi Salon!</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">We look forward to seeing you again.</p>
        </div>
      </div>
    </div>
  );
}
