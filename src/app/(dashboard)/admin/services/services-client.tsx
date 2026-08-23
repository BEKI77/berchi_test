"use client";

import { useEffect, useState, useCallback } from "react";
import { Scissors, Plus, Search, Edit2, ToggleLeft, ToggleRight, X, Clock, Droplets, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMoney, fromSantim } from "@/lib/money";

type Category = { id: string; name: string; description: string | null; isActive?: boolean };
type Product = { id: string; name: string; isConsumable: boolean };
type ServiceConsumable = {
  id: string;
  productId: string;
  portionsRequired: number;
  product?: Product
};
type Service = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  durationMinutes: number;
  isActive: boolean;
  category: Category;
  consumables?: ServiceConsumable[];
};

type FormData = {
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  durationMinutes: number;
  consumables: { productId: string; portionsRequired: number }[];
};

const emptyForm: FormData = { name: "", description: "", categoryId: "", basePrice: 0, durationMinutes: 30, consumables: [] };

export function ServicesClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [consumableProducts, setConsumableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes, pRes] = await Promise.all([
        fetch("/api/admin/services"),
        fetch("/api/admin/categories?type=service"),
        fetch("/api/admin/products"),
      ]);
      if (!sRes.ok || !cRes.ok || !pRes.ok) throw new Error();

      const allProducts: Product[] = await pRes.json();
      setServices(await sRes.json());
      setCategories(await cRes.json());
      setConsumableProducts(allProducts.filter(p => p.isConsumable));
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

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      categoryId: s.category.id,
      basePrice: fromSantim(s.basePrice),
      durationMinutes: s.durationMinutes,
      consumables: s.consumables?.map(c => ({
        productId: c.productId,
        portionsRequired: c.portionsRequired
      })) || [],
    });
    setShowForm(true);
  }

  function addConsumable() {
    if (consumableProducts.length === 0) {
      toast.error("No consumable products available. Create one in Inventory first.");
      return;
    }
    setForm({
      ...form,
      consumables: [...form.consumables, { productId: consumableProducts[0].id, portionsRequired: 1 }]
    });
  }

  function removeConsumable(index: number) {
    const next = [...form.consumables];
    next.splice(index, 1);
    setForm({ ...form, consumables: next });
  }

  function updateConsumable(index: number, field: string, value: any) {
    const next = [...form.consumables];
    next[index] = { ...next[index], [field]: value };
    setForm({ ...form, consumables: next });
  }

  async function handleSubmit() {
    if (!form.name || !form.categoryId || !form.basePrice) {
      if (categories.length === 0) {
        toast.error("Please create categories first using the 'Manage Categories' button");
      } else {
        toast.error("Name, category, and price are required");
      }
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/services/${editingId}` : "/api/admin/services";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(editingId ? "Service updated" : "Service created");
      setShowForm(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      const res = await fetch(`/api/admin/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(s.isActive ? "Service deactivated" : "Service activated");
      await fetchData();
    } catch { toast.error("Failed to update"); }
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), type: "service" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Category created");
      setNewCatName("");
      await fetchData();
    } catch { toast.error("Failed to create category"); }
  }

  function openCategoryDialog(category?: Category) {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, description: category.description || "" });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
    }
    setShowCategoryDialog(true);
  }

  async function handleCategorySubmit() {
    if (!categoryForm.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editingCategory) {
        const res = await fetch(`/api/admin/categories/${editingCategory.id}?type=service`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(categoryForm),
        });
        if (!res.ok) throw new Error();
        toast.success("Category updated");
      } else {
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...categoryForm, type: "service" }),
        });
        if (!res.ok) throw new Error();
        toast.success("Category created");
      }
      setShowCategoryDialog(false);
      await fetchData();
    } catch (error) {
      toast.error(editingCategory ? "Failed to update category" : "Failed to create category");
    }
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm("Are you sure you want to delete this category? This will only work if no services are using it.")) return;
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}?type=service`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }
      toast.success("Category deleted");
      setShowCategoryDialog(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.name.toLowerCase().includes(q);
  });

  const grouped: Record<string, Service[]> = {};
  filtered.forEach((s) => {
    if (!grouped[s.category.name]) grouped[s.category.name] = [];
    grouped[s.category.name].push(s);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading services...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scissors className="h-6 w-6 text-pink-500" />
            Service Catalog
          </h1>
          <p className="text-muted-foreground mt-1">{services.length} service(s) in {categories.length} categories</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => openCategoryDialog()}
            variant="outline"
            className="rounded-xl border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 shadow-sm shadow-blue-100/40"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
          <Button onClick={openAdd} className="rounded-xl bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/40">
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-400" />
        <Input placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-11 rounded-xl border-pink-100 focus:border-pink-300" />
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-137.5 p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="h-1.5 bg-linear-to-r from-pink-400 via-rose-400 to-pink-500" />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                <Scissors className="h-5 w-5" />
              </div>
              {editingId ? "Edit Service" : "New Service"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[85vh] px-6 pb-6">
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Service Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Bridal Makeup"
                    className="h-11 rounded-xl border-slate-200 focus:border-pink-400 focus:ring-pink-400/10 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Category *</Label>
                  {categories.length === 0 ? (
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                      <p className="text-xs text-amber-700 font-medium">No categories available</p>
                      <p className="text-[10px] text-amber-600 mt-1">Please create categories first using the "Manage Categories" button</p>
                    </div>
                  ) : (
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm bg-white focus:outline-none focus:ring-4 focus:ring-pink-500/10 focus:border-pink-400 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select a category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Price (ETB) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.basePrice || ""}
                    onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) || 0 })}
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Duration (min) *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={form.durationMinutes || ""}
                      onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) || 30 })}
                      className="h-11 rounded-xl border-slate-200 pl-9"
                    />
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this service include?"
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>

              {/* Consumables Section */}
              <div className="space-y-3 p-4 bg-pink-50/30 rounded-2xl border border-pink-100/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-pink-700 flex items-center gap-1.5">
                      <Droplets className="h-4 w-4" />
                      Product Consumables
                    </Label>
                    <p className="text-[10px] text-pink-600/70 font-medium tracking-tight">Products used during this service</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addConsumable}
                    className="h-8 rounded-lg border-pink-200 bg-white text-pink-600 hover:bg-pink-50 text-[10px] font-bold"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Product
                  </Button>
                </div>

                <div className="space-y-2">
                  {form.consumables.map((c, i) => (
                    <div key={i} className="flex gap-2 items-end bg-white/60 p-2 rounded-xl border border-pink-50 animate-in fade-in slide-in-from-top-1">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 ml-1">Select Product</Label>
                        <select
                          value={c.productId}
                          onChange={(e) => updateConsumable(i, "productId", e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-100 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/10"
                        >
                          {consumableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 ml-1">Qty (ml)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={c.portionsRequired}
                          onChange={(e) => updateConsumable(i, "portionsRequired", Number(e.target.value) || 1)}
                          className="h-9 rounded-lg border-slate-100 text-xs text-center"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeConsumable(i)}
                        className="h-9 w-9 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {form.consumables.length === 0 && (
                    <div className="text-center py-6 rounded-xl border border-dashed border-pink-200 bg-white/40">
                      <Droplets className="h-8 w-8 text-pink-200 mx-auto mb-2 opacity-50" />
                      <p className="text-[11px] text-pink-400 font-medium">No products linked yet.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSubmit} disabled={saving} className="w-full h-12 rounded-2xl bg-linear-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-lg shadow-pink-200 font-bold text-base transition-all active:scale-[0.98]">
                  {saving ? "Processing..." : editingId ? "Update Service" : "Create Service"}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-125 p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="h-1.5 bg-linear-to-r from-blue-400 via-indigo-400 to-blue-500" />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Plus className="h-5 w-5" />
              </div>
              {editingCategory ? "Edit Category" : "Manage Categories"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[80vh] px-6 pb-6">
            <div className="space-y-5 pt-2">
              {/* Add/Edit Category Form */}
              <div className="space-y-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-blue-700 uppercase tracking-widest ml-1">Category Name *</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="e.g. Hair Services"
                      className="h-11 rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/10 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-blue-700 uppercase tracking-widest ml-1">Description</Label>
                    <Input
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder="What type of services are in this category?"
                      className="h-11 rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/10 transition-all"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCategorySubmit}
                  className="w-full h-11 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 font-bold text-sm transition-all active:scale-[0.98]"
                >
                  {editingCategory ? "Update Category" : "Create Category"}
                </Button>
              </div>

              {/* Existing Categories List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Existing Categories</h3>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    {categories.length} total
                  </span>
                </div>

                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-200 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-slate-800">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openCategoryDialog(cat)}
                          className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {categories.length === 0 && (
                    <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <Plus className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No categories yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Create your first category to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {Object.entries(grouped).map(([catName, items]) => (
        <div key={catName} className="space-y-2">
          <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-widest pl-1">{catName}</h3>
          <div className="grid gap-2.5">
            {items.map((s) => (
              <Card key={s.id} className={`rounded-xl transition-all duration-200 ${s.isActive ? "border-pink-50 hover:border-pink-100 hover:shadow-sm" : "border-red-50 opacity-60"}`}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{s.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold text-pink-600">ETB {formatMoney(Number(s.basePrice))}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.durationMinutes}m</span>
                      {s.consumables && s.consumables.length > 0 && (
                        <span className="flex items-center gap-1 text-teal-600"><Droplets className="h-3 w-3" /> {s.consumables.length} product(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(s)} className="p-2 rounded-xl hover:bg-pink-50 text-pink-500 transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => toggleActive(s)} className={`p-2 rounded-xl transition-colors ${s.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-emerald-50 text-emerald-500"}`}>
                      {s.isActive ? <ToggleRight className="h-4.5 w-4.5" /> : <ToggleLeft className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-dashed">
          <Scissors className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No services found matching your search.</p>
        </div>
      )}
    </div>
  );
}
