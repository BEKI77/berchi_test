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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type ServiceOption = {
  id: string;
  name: string;
  basePrice: string;
  durationMinutes: number;
  category: { id: string; name: string };
};

type ProductOption = {
  id: string;
  name: string;
  usagePrice: string;
  quantityOnHand: number;
  category: { id: string; name: string };
};

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
  customer: { id: string; firstName: string; lastName: string; phone: string | null };
  server: { id: string; firstName: string; lastName: string };
  items: OrderItem[];
  products: OrderProduct[];
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
  const [modalType, setModalType] = useState<"services" | "products" | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedProductIds, setSelectedProductIds] = useState<Map<string, number>>(new Map());
  const [addingItems, setAddingItems] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?serverId=&status=`);
      if (!res.ok) throw new Error();
      const data: Order[] = await res.json();
      const found = data.find((o) => o.id === orderId);
      if (found) setOrder(found);
      else throw new Error("Order not found");
    } catch {
      toast.error("Failed to load order");
    }
  }, [orderId]);

  useEffect(() => {
    Promise.all([
      fetchOrder(),
      fetch("/api/services").then((r) => r.json()).then(setServices),
      fetch("/api/products").then((r) => r.json()).then(setProducts),
    ]).finally(() => setLoading(false));
  }, [fetchOrder]);

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

  async function addSelectedProducts() {
    if (selectedProductIds.size === 0) return;
    setAddingItems(true);
    let added = 0;
    let failed = 0;
    for (const [productId, quantity] of selectedProductIds) {
      try {
        const res = await fetch(`/api/orders/${orderId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity }),
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
    closeModal();
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
  const servicesTotal = order.items.reduce(
    (s, i) => s + Number(i.unitPrice) * i.quantity, 0
  );
  const productsTotal = order.products.reduce(
    (s, p) => s + Number(p.unitPrice) * p.quantity, 0
  );
  const grandTotal = servicesTotal + productsTotal;

  const elapsed = Math.round(
    (Date.now() - new Date(order.startedAt).getTime()) / 60000
  );

  // Filtered + grouped for modal
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

  const selectedServicesTotal = [...selectedServiceIds].reduce((sum, id) => {
    const svc = services.find((s) => s.id === id);
    return sum + (svc ? Number(svc.basePrice) : 0);
  }, 0);

  const selectedProductsTotal = [...selectedProductIds].reduce((sum, [id, qty]) => {
    const prod = products.find((p) => p.id === id);
    return sum + (prod ? Number(prod.usagePrice) * qty : 0);
  }, 0);

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/server")} className="rounded-xl hover:bg-pink-50">
          <ArrowLeft className="h-5 w-5 text-pink-500" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">
            {order.customer.firstName} {order.customer.lastName}
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
        {order.status === "SENT_TO_CASHIER" && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/60 text-xs font-semibold text-amber-600">
            Sent to Cashier
          </div>
        )}
      </div>

      {/* Services Section */}
      <Card className="rounded-xl overflow-hidden border-pink-100">
        <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-pink-600">
              <Scissors className="h-4 w-4" />
              Services ({order.items.length})
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
        <CardContent className="space-y-1">
          {order.items.length === 0 && (
            <div className="text-center py-6">
              <Scissors className="h-8 w-8 text-pink-200 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No services yet. Tap &quot;Add Services&quot; to begin.
              </p>
            </div>
          )}
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-pink-50/50 transition-colors">
              <div>
                <p className="text-sm font-medium">{item.service.name}</p>
                <p className="text-xs text-muted-foreground">
                  ETB {Number(item.unitPrice).toFixed(2)} x {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-pink-700">
                  ETB {(Number(item.unitPrice) * item.quantity).toFixed(2)}
                </span>
                {isEditable && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Products Section */}
      <Card className="rounded-xl overflow-hidden border-violet-100">
        <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-violet-600">
              <Package className="h-4 w-4" />
              Products ({order.products.length})
            </CardTitle>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openModal("products")}
                className="rounded-lg border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Products
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {order.products.length === 0 && (
            <div className="text-center py-5">
              <Package className="h-7 w-7 text-violet-200 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No products used yet.</p>
            </div>
          )}
          {order.products.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-violet-50/50 transition-colors">
              <div>
                <p className="text-sm font-medium">{p.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  ETB {Number(p.unitPrice).toFixed(2)} x {p.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-violet-700">
                  ETB {(Number(p.unitPrice) * p.quantity).toFixed(2)}
                </span>
                {isEditable && (
                  <button
                    onClick={() => removeProduct(p.id)}
                    className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card className="rounded-xl border-pink-100 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-pink-50/50 to-rose-50/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-pink-600">
            <StickyNote className="h-4 w-4" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Services</span>
            <span className="font-medium">ETB {servicesTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Products</span>
            <span className="font-medium">ETB {productsTotal.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base">
            <span className="font-semibold">Estimated Total</span>
            <span className="font-bold text-lg bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">ETB {grandTotal.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Send to Cashier */}
      {isEditable && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-white/80 backdrop-blur-lg border-t border-pink-100/50">
          <Button
            onClick={sendToCashier}
            disabled={sending || order.items.length === 0}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 hover:from-pink-600 hover:via-rose-600 hover:to-fuchsia-600 shadow-lg shadow-pink-300/30 hover:shadow-pink-400/40 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Send className="h-5 w-5 mr-2" />
            {sending ? "Sending..." : "Send to Cashier"}
          </Button>
        </div>
      )}

      {/* ===== MULTI-SELECT POPUP MODAL ===== */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          {/* Modal */}
          <div className="relative w-full max-w-lg mx-4 mb-0 sm:mb-0 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className={`p-4 border-b ${modalType === "services" ? "bg-gradient-to-r from-pink-50 to-rose-50 border-pink-100" : "bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {modalType === "services" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100">
                      <Scissors className="h-4 w-4 text-pink-600" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                      <Package className="h-4 w-4 text-violet-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-base">
                      {modalType === "services" ? "Select Services" : "Select Products"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Tap items to select, then confirm
                    </p>
                  </div>
                </div>
                <button onClick={closeModal} className="p-2 rounded-xl hover:bg-white/60 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={modalType === "services" ? "Search services..." : "Search products..."}
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className={`pl-9 rounded-xl ${modalType === "services" ? "border-pink-200 focus:border-pink-400" : "border-violet-200 focus:border-violet-400"}`}
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {modalType === "services" && (
                <>
                  {Object.entries(servicesByCategory).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-2 px-1">
                        {category}
                      </p>
                      <div className="space-y-1">
                        {items.map((s) => {
                          const selected = selectedServiceIds.has(s.id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => toggleService(s.id)}
                              className={`w-full flex items-center gap-3 py-3 px-3 rounded-xl text-left text-sm transition-all ${
                                selected
                                  ? "bg-pink-50 border-2 border-pink-300 shadow-sm"
                                  : "bg-white border-2 border-transparent hover:bg-pink-25 hover:border-pink-100"
                              }`}
                            >
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                selected ? "bg-pink-500" : "bg-gray-100"
                              }`}>
                                {selected && <Check className="h-4 w-4 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.durationMinutes} min</p>
                              </div>
                              <span className="font-semibold text-pink-600 shrink-0">
                                ETB {Number(s.basePrice).toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredServices.length === 0 && (
                    <div className="text-center py-8">
                      <Search className="h-8 w-8 text-pink-200 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No services found.</p>
                    </div>
                  )}
                </>
              )}

              {modalType === "products" && (
                <>
                  {Object.entries(productsByCategory).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 px-1">
                        {category}
                      </p>
                      <div className="space-y-1">
                        {items.map((p) => {
                          const selected = selectedProductIds.has(p.id);
                          const qty = selectedProductIds.get(p.id) || 1;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center gap-3 py-3 px-3 rounded-xl text-sm transition-all ${
                                selected
                                  ? "bg-violet-50 border-2 border-violet-300 shadow-sm"
                                  : "bg-white border-2 border-transparent hover:bg-violet-25 hover:border-violet-100"
                              }`}
                            >
                              <button
                                onClick={() => toggleProduct(p.id)}
                                className="shrink-0"
                              >
                                <div className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${
                                  selected ? "bg-violet-500" : "bg-gray-100"
                                }`}>
                                  {selected && <Check className="h-4 w-4 text-white" />}
                                </div>
                              </button>
                              <button onClick={() => toggleProduct(p.id)} className="flex-1 min-w-0 text-left">
                                <p className="font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.quantityOnHand} in stock</p>
                              </button>
                              {selected && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateProductQty(p.id, qty - 1); }}
                                    className="h-7 w-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center font-bold hover:bg-violet-200 transition-colors"
                                  >
                                    −
                                  </button>
                                  <span className="w-8 text-center font-semibold text-sm">{qty}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateProductQty(p.id, qty + 1); }}
                                    className="h-7 w-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center font-bold hover:bg-violet-200 transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                              <span className="font-semibold text-violet-600 shrink-0">
                                ETB {Number(p.usagePrice).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8">
                      <Search className="h-8 w-8 text-violet-200 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No products found.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer - Confirm */}
            <div className={`p-4 border-t ${modalType === "services" ? "border-pink-100 bg-pink-50/50" : "border-violet-100 bg-violet-50/50"}`}>
              {modalType === "services" ? (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedServiceIds.size} selected
                  </span>
                  <span className="text-sm font-semibold text-pink-600">
                    ETB {selectedServicesTotal.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedProductIds.size} selected
                  </span>
                  <span className="text-sm font-semibold text-violet-600">
                    ETB {selectedProductsTotal.toFixed(2)}
                  </span>
                </div>
              )}
              <Button
                onClick={modalType === "services" ? addSelectedServices : addSelectedProducts}
                disabled={
                  addingItems ||
                  (modalType === "services" ? selectedServiceIds.size === 0 : selectedProductIds.size === 0)
                }
                className={`w-full h-12 rounded-xl text-base font-semibold shadow-md transition-all ${
                  modalType === "services"
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-pink-200/40"
                    : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-violet-200/40"
                }`}
              >
                {addingItems ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Adding...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    {modalType === "services"
                      ? `Add ${selectedServiceIds.size} Service(s)`
                      : `Add ${selectedProductIds.size} Product(s)`}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
