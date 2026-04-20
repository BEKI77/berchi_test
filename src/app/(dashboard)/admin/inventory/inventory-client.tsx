"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search, Edit2, ToggleLeft, ToggleRight, X, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type Category = { id: string; name: string; description: string | null };
type Product = {
  id: string;
  name: string;
  sku: string | null;
  costPrice: string;
  sellPrice: string;
  usagePrice: string;
  quantityOnHand: number;
  reorderLevel: number;
  isActive: boolean;
  category: Category;
  isConsumable: boolean;
  portionsPerUnit: number;
  remainingPortions: number;
};

type FormData = {
  name: string;
  sku: string;
  categoryId: string;
  costPrice: number;
  sellPrice: number;
  usagePrice: number;
  quantityOnHand: number;
  reorderLevel: number;
  isConsumable: boolean;
  portionsPerUnit: number;
  remainingPortions: number;
};

const emptyForm: FormData = {
  name: "",
  sku: "",
  categoryId: "",
  costPrice: 0,
  sellPrice: 0,
  usagePrice: 0,
  quantityOnHand: 0,
  reorderLevel: 5,
  isConsumable: false,
  portionsPerUnit: 1,
  remainingPortions: 0
};

export function InventoryClient() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/categories?type=product"),
      ]);
      if (!pRes.ok || !cRes.ok) throw new Error();
      setProducts(await pRes.json());
      setCategories(await cRes.json());
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-calculate usagePrice for consumables
  useEffect(() => {
    if (form.isConsumable && form.portionsPerUnit > 0) {
      const calculatedUsage = Number((form.costPrice / form.portionsPerUnit).toFixed(2));
      // Only update if it actually changed to avoid infinite loops
      if (calculatedUsage !== form.usagePrice) {
        setForm(prev => ({ ...prev, usagePrice: calculatedUsage }));
      }
    }
  }, [form.costPrice, form.portionsPerUnit, form.isConsumable, form.usagePrice]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id || "" });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku || "",
      categoryId: p.category.id,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      usagePrice: Number(p.usagePrice),
      quantityOnHand: p.quantityOnHand,
      reorderLevel: p.reorderLevel,
      isConsumable: p.isConsumable,
      portionsPerUnit: p.portionsPerUnit,
      remainingPortions: p.remainingPortions,
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name || !form.categoryId) {
      toast.error("Name and category are required");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(editingId ? "Product updated" : "Product created");
      setShowForm(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(p.isActive ? "Product deactivated" : "Product activated");
      await fetchData();
    } catch { toast.error("Failed to update"); }
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), type: "product" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Category created");
      setNewCatName("");
      await fetchData();
    } catch { toast.error("Failed to create category"); }
  }

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  const lowStock = filtered.filter((p) => p.isActive && p.quantityOnHand <= p.reorderLevel);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-teal-200 border-t-teal-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-teal-500" />
            Inventory
          </h1>
          <p className="text-muted-foreground mt-1">{products.length} product(s)</p>
        </div>
        <Button onClick={openAdd} className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-md shadow-teal-200/40">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400" />
        <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-11 rounded-xl border-teal-100 focus:border-teal-300" />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Low Stock Alert</p>
            <p className="text-xs text-red-600">{lowStock.map((p) => p.name).join(", ")}</p>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="h-1.5 bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500" />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Package className="h-5 w-5" />
              </div>
              {editingId ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[80vh] px-6 pb-6">
            <div className="space-y-5 pt-2">
              <div className="flex items-center justify-between p-4 bg-teal-50/50 rounded-2xl border border-teal-100/50 transition-all hover:bg-teal-50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-1.5 text-teal-900">
                    Multi-Use (Consumable)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-teal-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-none rounded-xl p-3 shadow-xl">
                          <p className="w-64 text-xs leading-relaxed">Enable this for products like shampoo or hair dye that are used in small amounts across multiple clients. This enables portion tracking.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <p className="text-[11px] text-teal-600/70 font-medium tracking-tight">Track portions and yields per person</p>
                </div>
                <Switch
                  checked={form.isConsumable}
                  onCheckedChange={(val) => setForm({ ...form, isConsumable: val })}
                  className="data-[state=checked]:bg-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Product Name *</Label>
                  <Input 
                    value={form.name} 
                    onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    placeholder="e.g. Premium Silk Shampoo"
                    className="h-11 rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-400/10 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Category *</Label>
                  <select 
                    value={form.categoryId} 
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })} 
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400 transition-all appearance-none cursor-pointer"
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {form.isConsumable && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/30 animate-in fade-in zoom-in-95 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest ml-1">Portions Per Unit</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.portionsPerUnit || ""}
                      onChange={(e) => setForm({ ...form, portionsPerUnit: Number(e.target.value) || 1 })}
                      placeholder="e.g. 1000 for ml"
                      className="h-11 rounded-xl border-emerald-100 bg-white focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest ml-1">Rem. Portions</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.remainingPortions || ""}
                      onChange={(e) => setForm({ ...form, remainingPortions: Number(e.target.value) || 0 })}
                      placeholder="Remaining ml"
                      className="h-11 rounded-xl border-emerald-100 bg-white focus:border-emerald-400"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cost</Label>
                  <Input type="number" min={0} value={form.costPrice || ""} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) || 0 })} className="h-11 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Sell</Label>
                  <Input type="number" min={0} value={form.sellPrice || ""} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) || 0 })} className="h-11 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Usage</Label>
                  <Input type="number" min={0} value={form.usagePrice || ""} onChange={(e) => setForm({ ...form, usagePrice: Number(e.target.value) || 0 })} className="h-11 rounded-xl border-slate-200" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">SKU / Code</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional SKU" className="h-11 rounded-xl border-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Stock</Label>
                    <Input type="number" min={0} value={form.quantityOnHand || ""} onChange={(e) => setForm({ ...form, quantityOnHand: Number(e.target.value) || 0 })} className="h-11 rounded-xl border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Reorder</Label>
                    <Input type="number" min={0} value={form.reorderLevel || ""} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) || 5 })} className="h-11 rounded-xl border-slate-200" />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSubmit} disabled={saving} className="w-full h-12 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-lg shadow-teal-200 font-bold text-base transition-all active:scale-[0.98]">
                  {saving ? "Processing..." : editingId ? "Update Product" : "Create Product"}
                </Button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                <Input 
                  placeholder="New category..." 
                  value={newCatName} 
                  onChange={(e) => setNewCatName(e.target.value)} 
                  className="rounded-xl border-slate-200 text-xs h-9 bg-white" 
                />
                <Button size="sm" variant="ghost" onClick={addCategory} className="rounded-lg text-teal-600 text-xs font-bold hover:bg-teal-50 transition-colors">
                  Quick Add
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <div className="grid gap-2.5">
        {filtered.map((p) => (
          <Card key={p.id} className={`rounded-xl transition-all duration-200 ${p.isActive ? (p.quantityOnHand <= p.reorderLevel ? "border-red-100 shadow-sm" : "border-teal-50 hover:border-teal-100 hover:shadow-sm") : "border-gray-100 opacity-60"}`}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm cursor-pointer hover:text-teal-600 transition-colors" onClick={() => router.push(`/admin/inventory/${p.id}`)}>{p.name}</p>
                  {p.isConsumable && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">Multi-Use</span>
                  )}
                  {p.quantityOnHand <= p.reorderLevel && p.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold uppercase tracking-tight text-[9px]">Low Stock</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="text-teal-600 font-semibold">{p.category.name}</span>
                  <span>Stock: {p.quantityOnHand} unit(s)</span>
                  {p.isConsumable && (
                    <span className="text-teal-600/70">{p.remainingPortions} / {p.portionsPerUnit} portions left</span>
                  )}
                  {p.sku && <span className="text-muted-foreground/60">{p.sku}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(p)} className="p-2 rounded-xl hover:bg-teal-50 text-teal-500 transition-colors"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => toggleActive(p)} className={`p-2 rounded-xl transition-colors ${p.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-emerald-50 text-emerald-500"}`}>
                  {p.isActive ? <ToggleRight className="h-4.5 w-4.5" /> : <ToggleLeft className="h-4.5 w-4.5" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-dashed">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
