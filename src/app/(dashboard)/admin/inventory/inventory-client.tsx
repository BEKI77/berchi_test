"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search, Edit2, ToggleLeft, ToggleRight, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
};

const emptyForm: FormData = { name: "", sku: "", categoryId: "", costPrice: 0, sellPrice: 0, usagePrice: 0, quantityOnHand: 0, reorderLevel: 5 };

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

      {showForm && (
        <Card className="rounded-xl border-teal-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{editingId ? "Edit Product" : "New Product"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category *</Label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full h-10 rounded-xl border border-teal-100 px-3 text-sm bg-white">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost Price</Label>
                <Input type="number" min={0} value={form.costPrice || ""} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) || 0 })} className="rounded-xl border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sell Price</Label>
                <Input type="number" min={0} value={form.sellPrice || ""} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) || 0 })} className="rounded-xl border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage Price</Label>
                <Input type="number" min={0} value={form.usagePrice || ""} onChange={(e) => setForm({ ...form, usagePrice: Number(e.target.value) || 0 })} className="rounded-xl border-teal-100" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="rounded-xl border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty on Hand</Label>
                <Input type="number" min={0} value={form.quantityOnHand || ""} onChange={(e) => setForm({ ...form, quantityOnHand: Number(e.target.value) || 0 })} className="rounded-xl border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reorder Level</Label>
                <Input type="number" min={0} value={form.reorderLevel || ""} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) || 5 })} className="rounded-xl border-teal-100" />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-md shadow-teal-200/30">
              {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
            </Button>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input placeholder="New category name..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="rounded-xl border-teal-100 text-xs h-9" />
              <Button size="sm" variant="outline" onClick={addCategory} className="rounded-lg border-teal-200 text-teal-600 text-xs shrink-0">Add Category</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2.5">
        {filtered.map((p) => (
          <Card key={p.id} className={`rounded-xl transition-colors ${p.isActive ? (p.quantityOnHand <= p.reorderLevel ? "border-red-100" : "border-teal-50 hover:border-teal-100") : "border-gray-100 opacity-50"}`}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm cursor-pointer hover:text-teal-600 transition-colors" onClick={() => router.push(`/admin/inventory/${p.id}`)}>{p.name}</p>
                  {p.quantityOnHand <= p.reorderLevel && p.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Low</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="text-teal-600 font-semibold">{p.category.name}</span>
                  <span>Stock: {p.quantityOnHand}</span>
                  <span>ETB {Number(p.usagePrice).toFixed(2)}</span>
                  {p.sku && <span className="text-muted-foreground/60">{p.sku}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-500"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => toggleActive(p)} className={`p-1.5 rounded-lg ${p.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-emerald-50 text-emerald-500"}`}>
                  {p.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">No products found.</div>
        )}
      </div>
    </div>
  );
}
