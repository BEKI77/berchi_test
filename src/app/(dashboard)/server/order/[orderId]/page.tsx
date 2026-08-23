"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Scissors,
  Package,
  StickyNote,
  Clock,
  X,
  Check,
  Search,
  Droplets,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { customerName } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

type ServiceConsumable = {
  productId: string;
  portionsRequired: number;
  product: { id: string; name: string; usagePrice: number; sellPrice: number };
};

type ConsumableUsed = {
  productId: string;
  portionsUsed: number;
  product: { id: string; name: string; usagePrice: number; sellPrice: number };
};

type OrderItem = {
  id: string;
  unitPrice: number;
  quantity: number;
  service: {
    id: string;
    name: string;
    consumables: ServiceConsumable[];
  };
  consumablesUsed: ConsumableUsed[];
};

type OrderProduct = {
  id: string;
  unitPrice: number;
  quantity: number;
  orderItemId?: string | null;
  product: { id: string; name: string; sellPrice: number; usagePrice: number };
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  notes: string | null;
  startedAt: string;
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  server: { id: string; firstName: string; lastName: string };
  items: OrderItem[];
  products: OrderProduct[];
};

type ServiceOption = {
  id: string;
  name: string;
  basePrice: number;
  durationMinutes: number;
  category: { id: string; name: string };
};

type ProductOption = {
  id: string;
  name: string;
  usagePrice: number;
  sellPrice: number;
  quantityOnHand: number;
  isConsumable: boolean;
  category: { id: string; name: string };
};

export default function ActiveOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Modal state
  const [modalType, setModalType] = useState<"services" | "products" | "manage-service" | null>(null);
  const [modalTab, setModalTab] = useState<"usage" | "purchase">("usage");
  const [modalSearch, setModalSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedProductIds, setSelectedProductIds] = useState<Map<string, number>>(new Map());
  const [activeItemForConsumables, setActiveItemForConsumables] = useState<OrderItem | null>(null);
  const [tempConsumables, setTempConsumables] = useState<{ productId: string, portionsUsed: number }[]>([]);
  const [addingItems, setAddingItems] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error();
      setOrder(await res.json());
    } catch {
      toast.error("Failed to load order");
    }
  }, [orderId]);

  useEffect(() => {
    Promise.all([
      fetchOrder(),
      fetch("/api/admin/services").then((r) => r.json()).then(setServices),
      fetch("/api/admin/products").then((r) => r.json()).then(setProducts),
    ]).finally(() => setLoading(false));
  }, [fetchOrder]);

  function toggleExpand(itemId: string) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function openManageModal(item: OrderItem) {
    setActiveItemForConsumables(item);
    const existing = item.consumablesUsed.length > 0
      ? item.consumablesUsed.map(c => ({ productId: c.productId, portionsUsed: c.portionsUsed }))
      : item.service.consumables.map(c => ({ productId: c.productId, portionsUsed: c.portionsRequired }));

    setTempConsumables(existing);
    setModalTab("usage");
    setModalType("manage-service");
  }

  async function saveConsumables() {
    if (!activeItemForConsumables) return;
    setAddingItems(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${activeItemForConsumables.id}/consumables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumables: tempConsumables }),
      });
      if (!res.ok) throw new Error();
      toast.success("Usage recorded");
      await fetchOrder();
      closeModal();
    } catch {
      toast.error("Failed to save usage");
    } finally {
      setAddingItems(false);
    }
  }

  function addTempConsumable() {
    const consumableProds = products.filter(p => p.isConsumable);
    if (consumableProds.length === 0) return;
    setTempConsumables([...tempConsumables, { productId: consumableProds[0].id, portionsUsed: 1 }]);
  }

  function updateTempConsumable(index: number, field: string, value: any) {
    const next = [...tempConsumables];
    next[index] = { ...next[index], [field]: value };
    setTempConsumables(next);
  }

  function removeTempConsumable(index: number) {
    const next = [...tempConsumables];
    next.splice(index, 1);
    setTempConsumables(next);
  }

  function openModal(type: "services" | "products") {
    setModalType(type);
    setModalSearch("");
    setSelectedServiceIds(new Set());
    setSelectedProductIds(new Map());
  }

  function closeModal() {
    setModalType(null);
    setModalSearch("");
    setSelectedServiceIds(new Set());
    setSelectedProductIds(new Map());
    setActiveItemForConsumables(null);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, 1);
      return next;
    });
  }

  function updateProductQty(id: string, qty: number) {
    if (qty < 1) return;
    setSelectedProductIds((prev) => {
      const next = new Map(prev);
      next.set(id, qty);
      return next;
    });
  }

  async function addSelectedServices() {
    if (selectedServiceIds.size === 0) return;
    setAddingItems(true);
    let added = 0;
    let failed = 0;
    for (const serviceId of selectedServiceIds) {
      try {
        const res = await fetch(`/api/orders/${orderId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId }),
        });
        if (!res.ok) throw new Error();
        added++;
      } catch {
        failed++;
      }
    }
    if (added > 0) toast.success(`${added} service(s) added`);
    if (failed > 0) toast.error(`${failed} service(s) failed to add`);
    await fetchOrder();
    setAddingItems(false);
    closeModal();
  }

  async function addSelectedProducts(targetOrderItemId?: string) {
    if (selectedProductIds.size === 0) return;
    setAddingItems(true);
    let added = 0;
    let failed = 0;
    for (const [productId, quantity] of selectedProductIds) {
      try {
        const res = await fetch(`/api/orders/${orderId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity, orderItemId: targetOrderItemId }),
        });
        if (!res.ok) throw new Error();
        added++;
      } catch {
        failed++;
      }
    }
    if (added > 0) toast.success(`${added} product(s) added`);
    if (failed > 0) toast.error(`${failed} product(s) failed to add`);
    await fetchOrder();
    setAddingItems(false);
    if (!targetOrderItemId) closeModal(); // Only close if added from global modal
    else {
      // If added from service modal, maybe clear selection but stay in modal?
      // Or close it. Let's close for now to be safe.
      closeModal();
    }
  }

  async function removeItem(itemId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}/items?itemId=${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Service removed");
      await fetchOrder();
    } catch {
      toast.error("Failed to remove service");
    }
  }

  async function removeProduct(productItemId: string) {
    try {
      const res = await fetch(
        `/api/orders/${orderId}/products?productItemId=${productItemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success("Product removed");
      await fetchOrder();
    } catch {
      toast.error("Failed to remove product");
    }
  }

  async function sendToCashier() {
    if (!order || order.items.length === 0) {
      toast.error("Add at least one service before sending");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/send`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Order sent to cashier!");
      router.push("/server");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send order");
      setSending(false);
    }
  }

  if (loading || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  const isEditable = order.status === "IN_PROGRESS";
  const servicesTotal = (order.items || []).reduce(
    (s, i) => s + Number(i.unitPrice) * i.quantity, 0
  );
  const productsTotal = (order.products || []).reduce(
    (s, p) => s + Number(p.unitPrice) * p.quantity, 0
  );
  const grandTotal = servicesTotal + productsTotal;

  const elapsed = Math.round(
    (Date.now() - new Date(order.startedAt).getTime()) / 60000
  );

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
    s.category.name.toLowerCase().includes(modalSearch.toLowerCase())
  );
  const servicesByCategory: Record<string, ServiceOption[]> = {};
  filteredServices.forEach((s) => {
    if (!servicesByCategory[s.category.name]) servicesByCategory[s.category.name] = [];
    servicesByCategory[s.category.name].push(s);
  });

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
    p.category.name.toLowerCase().includes(modalSearch.toLowerCase())
  );
  const productsByCategory: Record<string, ProductOption[]> = {};
  filteredProducts.forEach((p) => {
    if (!productsByCategory[p.category.name]) productsByCategory[p.category.name] = [];
    productsByCategory[p.category.name].push(p);
  });

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/server")} className="rounded-xl hover:bg-pink-50">
          <ArrowLeft className="h-5 w-5 text-pink-500" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">
            {customerName(order.customer)}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">{order.orderNumber}</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-semibold">
              <Clock className="h-3 w-3" />
              {elapsed}m
            </span>
          </div>
        </div>
        {isEditable && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-semibold text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            In Progress
          </div>
        )}
      </div>

      {/* Services Section */}
      <Card className="rounded-xl overflow-hidden border-pink-100 shadow-sm">
        <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-pink-600">
              <Scissors className="h-4 w-4" />
              Services ({(order.items || []).length})
            </CardTitle>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openModal("services")}
                className="rounded-lg border-pink-200 text-pink-600 hover:bg-pink-50 hover:border-pink-300"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Services
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(order.items || []).length === 0 && (
            <div className="text-center py-6">
              <Scissors className="h-8 w-8 text-pink-200 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No services yet.</p>
            </div>
          )}
          {(order.items || []).map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const consumables = item.consumablesUsed.length > 0 ? item.consumablesUsed : item.service.consumables;
            const hasCustomUsage = item.consumablesUsed.length > 0;

            return (
              <div key={item.id} className="rounded-xl border border-pink-50 overflow-hidden bg-white">
                <div className="flex items-center justify-between p-3">
                  <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.service.name}</p>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-pink-300" /> : <ChevronDown className="h-3.5 w-3.5 text-pink-300" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                        ETB {formatMoney(Number(item.unitPrice))} x {item.quantity}
                      </p>
                      {consumables.length > 0 && (
                        <Badge variant="secondary" className="bg-teal-50 text-teal-600 border-teal-100 text-[9px] h-4 py-0">
                          {hasCustomUsage ? "Custom Usage" : `${consumables.length} product(s)`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-pink-700">
                      ETB {formatMoney((Number(item.unitPrice) * item.quantity))}
                    </span>
                    {isEditable && (
                      <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg text-rose-300 hover:text-rose-500 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-pink-50/30 p-3 border-t border-pink-50/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        Products Used
                      </p>
                      {isEditable && (
                        <button
                          onClick={() => openManageModal(item)}
                          className="text-[10px] text-pink-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Manage Products
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {consumables.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground">{c.product.name}</span>
                            <span className="text-[10px] text-pink-400 font-medium">
                              ETB {formatMoney(Number(c.product.usagePrice))} / portion
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-pink-600">
                              {'portionsUsed' in c ? c.portionsUsed : c.portionsRequired} portion(s)
                            </p>
                            <p className="text-[10px] font-bold text-pink-700">
                              ETB {formatMoney((Number(c.product.usagePrice) * ('portionsUsed' in c ? c.portionsUsed : c.portionsRequired)))}
                            </p>
                          </div>
                        </div>
                      ))}
                      {consumables.length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">No products recorded for usage.</p>
                      )}
                    </div>

                    {/* Linked Retail Products */}
                    {order.products.filter(p => p.orderItemId === item.id).length > 0 && (
                      <div className="pt-2 border-t border-pink-100/30 space-y-2">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Purchased with Service
                        </p>
                        {order.products.filter(p => p.orderItemId === item.id).map(p => (
                          <div key={p.id} className="flex justify-between items-center text-xs bg-violet-50/40 p-1.5 rounded-lg border border-violet-100/30">
                            <div>
                              <p className="font-medium text-violet-700">{p.product.name}</p>
                              <p className="text-[9px] text-violet-500">ETB {formatMoney(Number(p.unitPrice))} x {p.quantity}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-violet-700">ETB {formatMoney((Number(p.unitPrice) * p.quantity))}</span>
                              {isEditable && (
                                <button onClick={() => removeProduct(p.id)} className="p-1 text-rose-300 hover:text-rose-500">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Products Section (Retail/Extra) */}
      <Card className="rounded-xl overflow-hidden border-violet-100 shadow-sm">
        <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-violet-600">
              <Package className="h-4 w-4" />
              Extra Products ({(order.products || []).filter(p => !p.orderItemId).length})
            </CardTitle>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openModal("products")}
                className="rounded-lg border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {(order.products || []).filter(p => !p.orderItemId).length === 0 && (
            <div className="text-center py-5">
              <p className="text-[11px] text-muted-foreground italic">No extra products sold.</p>
            </div>
          )}
          {(order.products || []).filter(p => !p.orderItemId).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-violet-50/30 border border-violet-50/50">
              <div>
                <p className="text-sm font-medium">{p.product.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  ETB {formatMoney(Number(p.unitPrice))} x {p.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-violet-700">
                  ETB {formatMoney((Number(p.unitPrice) * p.quantity))}
                </span>
                {isEditable && (
                  <button onClick={() => removeProduct(p.id)} className="p-1.5 rounded-lg text-rose-300 hover:text-rose-500 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card className="rounded-xl border-pink-100 overflow-hidden shadow-sm">
        <CardContent className="space-y-2 pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-tight">Services Total</span>
            <span className="font-semibold text-pink-700">ETB {formatMoney(servicesTotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-tight">Products Total</span>
            <span className="font-semibold text-pink-700">ETB {formatMoney(productsTotal)}</span>
          </div>
          <Separator className="my-2 bg-pink-100/50" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold uppercase tracking-wider">Estimated Total</span>
            <span className="text-2xl font-black bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 bg-clip-text text-transparent">
              ETB {formatMoney(grandTotal)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Send to Cashier */}
      {isEditable && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-white/80 backdrop-blur-lg border-t border-pink-100/50 z-40">
          <Button
            onClick={sendToCashier}
            disabled={sending || (order.items || []).length === 0}
            className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 hover:shadow-xl hover:shadow-pink-300/40 active:scale-[0.98] transition-all"
          >
            <Send className="h-5 w-5 mr-2" />
            {sending ? "Processing..." : "Finish & Send to Cashier"}
          </Button>
        </div>
      )}

      {/* ===== MODAL POPUPS ===== */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          <Card className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className={`p-4 border-b flex items-center justify-between ${modalType === "manage-service" ? "bg-slate-50 border-slate-100" :
                modalType === "services" ? "bg-pink-50 border-pink-100" : "bg-violet-50 border-violet-100"
              }`}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  {modalType === "manage-service" ? `Manage Products: ${activeItemForConsumables?.service.name}` :
                    modalType === "services" ? "Add Services" : "Add Extra Products"}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {modalType === "manage-service" && activeItemForConsumables && (
                <div className="space-y-4">
                  {/* Tabs */}
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setModalTab("usage")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${modalTab === "usage" ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      <Droplets className="h-3.5 w-3.5" /> Usage Details
                    </button>
                    <button
                      onClick={() => setModalTab("purchase")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${modalTab === "purchase" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      <Package className="h-3.5 w-3.5" /> Customer Purchase
                    </button>
                  </div>

                  {modalTab === "usage" ? (
                    <div className="space-y-4">
                      <p className="text-[11px] text-muted-foreground bg-pink-50/50 p-2 rounded-lg border border-pink-100/50">
                        Record products used during the service. Prices shown are internal <strong>usage costs</strong>.
                      </p>
                      <div className="space-y-3">
                        {tempConsumables.map((c, i) => {
                          const prod = products.find(p => p.id === c.productId);
                          return (
                            <div key={i} className="flex gap-2 items-end p-3 rounded-xl border border-pink-100/40 bg-pink-50/10">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[10px] text-muted-foreground ml-1">Product</Label>
                                <select
                                  value={c.productId}
                                  onChange={(e) => updateTempConsumable(i, "productId", e.target.value)}
                                  className="w-full h-10 rounded-xl border border-pink-100 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                                >
                                  {products.filter(p => p.isConsumable).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              </div>
                              <div className="w-24 space-y-1">
                                <div className="flex justify-between px-1">
                                  <Label className="text-[10px] text-muted-foreground">Portions</Label>
                                  {prod && <span className="text-[9px] font-bold text-pink-500">ETB {formatMoney(prod.usagePrice)}</span>}
                                </div>
                                <Input
                                  type="number"
                                  min={1}
                                  value={c.portionsUsed}
                                  onChange={(e) => updateTempConsumable(i, "portionsUsed", Number(e.target.value) || 1)}
                                  className="h-10 rounded-xl border-pink-100 focus-visible:ring-pink-500/20"
                                />
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => removeTempConsumable(i)} className="h-10 w-10 text-rose-400 hover:bg-rose-50 rounded-xl">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                        <Button variant="outline" size="sm" onClick={addTempConsumable} className="w-full border-dashed border-pink-300 text-pink-600 hover:bg-pink-50 rounded-xl h-10">
                          <Plus className="h-4 w-4 mr-2" /> Add Another Product
                        </Button>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Total Usage Cost:</span>
                          <span className="ml-2 font-bold text-pink-600">
                            ETB {formatMoney(tempConsumables.reduce((acc, c) => {
                              const p = products.find(prod => prod.id === c.productId);
                              return acc + ((p?.usagePrice ?? 0) * c.portionsUsed);
                            }, 0))}
                          </span>
                        </div>
                        <Button onClick={saveConsumables} disabled={addingItems} className="bg-pink-600 hover:bg-pink-700 text-white rounded-xl px-6 h-11">
                          {addingItems ? "Saving..." : "Save Usage"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[11px] text-muted-foreground bg-violet-50/50 p-2 rounded-lg border border-violet-100/50">
                        Select retail products the customer is <strong>buying</strong> alongside this service.
                      </p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search retail products..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} className="pl-9 rounded-xl border-violet-100" />
                      </div>
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                        {filteredProducts.filter(p => !p.isConsumable || p.sellPrice > 0).map(p => (
                          <div key={p.id} className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedProductIds.has(p.id) ? "bg-violet-50 border-violet-300" : "bg-white border-transparent hover:bg-violet-50/50"}`}>
                            <button onClick={() => toggleProduct(p.id)} className="flex-1 text-left">
                              <span className="text-sm font-medium">{p.name}</span>
                              <p className="text-[10px] text-violet-500 font-bold">ETB {formatMoney(Number(p.sellPrice))} retail price</p>
                            </button>
                            {selectedProductIds.has(p.id) ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateProductQty(p.id, (selectedProductIds.get(p.id) || 1) - 1)} className="h-7 w-7 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center font-bold transition-colors hover:bg-violet-200">−</button>
                                <span className="w-5 text-center text-xs font-bold">{selectedProductIds.get(p.id)}</span>
                                <button onClick={() => updateProductQty(p.id, (selectedProductIds.get(p.id) || 1) + 1)} className="h-7 w-7 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center font-bold transition-colors hover:bg-violet-200">+</button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => toggleProduct(p.id)} className="text-violet-600 hover:bg-violet-100 rounded-lg h-8">
                                Add
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={() => addSelectedProducts(activeItemForConsumables.id)}
                        disabled={addingItems || selectedProductIds.size === 0}
                        className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg shadow-violet-200 font-bold"
                      >
                        {addingItems ? "Adding..." : `Add ${selectedProductIds.size} Items to Purchase`}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {modalType === "services" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search services..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} className="pl-9 rounded-xl border-pink-100" />
                  </div>
                  <div className="overflow-y-auto max-h-[400px] space-y-4 pr-1">
                    {Object.entries(servicesByCategory).map(([category, items]) => (
                      <div key={category} className="space-y-1.5">
                        <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest px-1">{category}</p>
                        {items.map(s => (
                          <button key={s.id} onClick={() => toggleService(s.id)} className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedServiceIds.has(s.id) ? "bg-pink-50 border-pink-300" : "bg-white border-transparent hover:bg-pink-25"}`}>
                            <span className="text-sm font-medium">{s.name}</span>
                            <span className="text-xs font-bold text-pink-600">ETB {formatMoney(Number(s.basePrice))}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <Button onClick={addSelectedServices} disabled={addingItems || selectedServiceIds.size === 0} className="w-full h-12 bg-pink-600 hover:bg-pink-700 text-white rounded-xl shadow-lg shadow-pink-200 font-bold">
                    {addingItems ? "Adding..." : `Add ${selectedServiceIds.size} Services`}
                  </Button>
                </div>
              )}

              {modalType === "products" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search products..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} className="pl-9 rounded-xl border-violet-100" />
                  </div>
                  <div className="overflow-y-auto max-h-[400px] space-y-4 pr-1">
                    {Object.entries(productsByCategory).map(([category, items]) => (
                      <div key={category} className="space-y-1.5">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest px-1">{category}</p>
                        {items.map(p => (
                          <div key={p.id} className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedProductIds.has(p.id) ? "bg-violet-50 border-violet-300" : "bg-white border-transparent hover:bg-violet-25"}`}>
                            <button onClick={() => toggleProduct(p.id)} className="flex-1 text-left">
                              <span className="text-sm font-medium">{p.name}</span>
                              <p className="text-[10px] text-violet-500 font-bold">ETB {formatMoney(Number(p.sellPrice))}</p>
                            </button>
                            {selectedProductIds.has(p.id) ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateProductQty(p.id, (selectedProductIds.get(p.id) || 1) - 1)} className="h-7 w-7 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center font-bold">−</button>
                                <span className="w-5 text-center text-xs font-bold">{selectedProductIds.get(p.id)}</span>
                                <button onClick={() => updateProductQty(p.id, (selectedProductIds.get(p.id) || 1) + 1)} className="h-7 w-7 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center font-bold">+</button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => toggleProduct(p.id)} className="text-violet-600 hover:bg-violet-100 rounded-lg h-8">
                                Add
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => addSelectedProducts()} disabled={addingItems || selectedProductIds.size === 0} className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg shadow-violet-200 font-bold">
                    {addingItems ? "Adding..." : `Add ${selectedProductIds.size} Products`}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
