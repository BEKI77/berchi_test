"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Tag,
  AlertTriangle,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { customerName } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

type ProductDetail = {
  product: {
    id: string;
    name: string;
    sku: string | null;
    description: string | null;
    costPrice: number;
    usagePrice: number;
    quantityOnHand: number;
    reorderLevel: number;
    isActive: boolean;
    createdAt: string;
    category: { id: string; name: string };
  };
  stockMovements: {
    id: string;
    type: string;
    quantityChange: number;
    referenceId: string | null;
    note: string | null;
    createdAt: string;
    staff: { firstName: string; lastName: string };
  }[];
  usageHistory: {
    id: string;
    quantity: number;
    unitPrice: number;
    order: {
      orderNumber: string;
      startedAt: string;
      customer: { firstName: string; lastName: string } | null;
      server: { firstName: string; lastName: string };
    };
  }[];
  stats: {
    totalUsed: number;
    totalRevenue: number;
    movementCount: number;
  };
};

const movementTypeColors: Record<string, string> = {
  RESTOCK: "bg-emerald-50 text-emerald-600 border-emerald-200",
  USED_IN_SERVICE: "bg-blue-50 text-blue-600 border-blue-200",
  SOLD: "bg-violet-50 text-violet-600 border-violet-200",
  ADJUSTMENT: "bg-amber-50 text-amber-600 border-amber-200",
  DAMAGED: "bg-red-50 text-red-600 border-red-200",
};

const movementTypeIcons: Record<string, React.ReactNode> = {
  RESTOCK: <ArrowUpCircle className="h-4 w-4 text-emerald-500" />,
  USED_IN_SERVICE: <ArrowDownCircle className="h-4 w-4 text-blue-500" />,
  SOLD: <ArrowDownCircle className="h-4 w-4 text-violet-500" />,
  ADJUSTMENT: <Clock className="h-4 w-4 text-amber-500" />,
  DAMAGED: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"movements" | "usage">("movements");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/inventory/${productId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("Failed to load product details");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-violet-200 border-t-violet-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading product details...</p>
      </div>
    );
  }

  const { product, stats } = data;
  const isLowStock = product.quantityOnHand <= product.reorderLevel;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/inventory")} className="rounded-xl hover:bg-violet-50">
          <ArrowLeft className="h-5 w-5 text-violet-500" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{product.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px]">
                  <Tag className="h-2.5 w-2.5 mr-1" />{product.category.name}
                </Badge>
                {product.sku && <Badge variant="outline" className="text-[10px]">SKU: {product.sku}</Badge>}
                <Badge variant="outline" className={`text-[10px] ${product.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
                {isLowStock && (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Low Stock
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {product.description && (
        <p className="text-sm text-muted-foreground">{product.description}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="rounded-xl border-violet-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">On Hand</p>
            <p className={`text-xl font-bold mt-1 ${isLowStock ? "text-red-600" : ""}`}>{product.quantityOnHand}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Reorder Level</p>
            <p className="text-xl font-bold mt-1">{product.reorderLevel}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Total Used</p>
            <p className="text-xl font-bold mt-1">{stats.totalUsed}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-emerald-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Revenue</p>
            <p className="text-xl font-bold mt-1">ETB {formatMoney(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-pink-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wider">Prices</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm font-bold">Cost: {formatMoney(product.costPrice)}</span>
              <span className="text-[10px] text-muted-foreground">/ Usage: {formatMoney(product.usagePrice)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 w-fit">
        {(["movements", "usage"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-white shadow-sm text-violet-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "movements" ? "Stock Movements" : "Usage History"}
          </button>
        ))}
      </div>

      {/* Stock Movements */}
      {tab === "movements" && (
        <div className="space-y-2.5">
          {data.stockMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No stock movements recorded yet.</div>
          ) : (
            data.stockMovements.map((m) => (
              <Card key={m.id} className="rounded-xl border-violet-50 hover:border-violet-100 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">{movementTypeIcons[m.type] || <Clock className="h-4 w-4" />}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${movementTypeColors[m.type] || ""}`}>
                            {m.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>By {m.staff.firstName} {m.staff.lastName}</span>
                        </div>
                        {m.note && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{m.note}</p>}
                      </div>
                    </div>
                    <span className={`font-bold text-sm shrink-0 ${m.quantityChange > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {m.quantityChange > 0 ? "+" : ""}{m.quantityChange}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Usage History */}
      {tab === "usage" && (
        <div className="space-y-2.5">
          {data.usageHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No usage records yet.</div>
          ) : (
            data.usageHistory.map((u) => (
              <Card key={u.id} className="rounded-xl border-blue-50 hover:border-blue-100 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {customerName(u.order.customer)}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{u.order.orderNumber}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{new Date(u.order.startedAt).toLocaleDateString()}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>Server: {u.order.server.firstName}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm text-violet-700">x{u.quantity}</p>
                      <p className="text-[10px] text-muted-foreground">ETB {formatMoney((Number(u.unitPrice) * u.quantity))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
