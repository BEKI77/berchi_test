"use client";

import { useEffect, useState, useCallback } from "react";
import { Scissors, Plus, Search, Edit2, ToggleLeft, ToggleRight, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Category = { id: string; name: string; description: string | null; isActive?: boolean };
type Service = {
  id: string;
  name: string;
  description: string | null;
  basePrice: string;
  durationMinutes: number;
  isActive: boolean;
  category: Category;
};

type FormData = {
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  durationMinutes: number;
};

const emptyForm: FormData = { name: "", description: "", categoryId: "", basePrice: 0, durationMinutes: 30 };

export function ServicesClient() {
  const [services, setServices] = useState<Service[]>([]);
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
      const [sRes, cRes] = await Promise.all([
        fetch("/api/admin/services"),
        fetch("/api/admin/categories?type=service"),
      ]);
      if (!sRes.ok || !cRes.ok) throw new Error();
      setServices(await sRes.json());
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

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      categoryId: s.category.id,
      basePrice: Number(s.basePrice),
      durationMinutes: s.durationMinutes,
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name || !form.categoryId || !form.basePrice) {
      toast.error("Name, category, and price are required");
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

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.name.toLowerCase().includes(q);
  });

  // Group by category
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
        <Button onClick={openAdd} className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/40">
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-400" />
        <Input placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-11 rounded-xl border-pink-100 focus:border-pink-300" />
      </div>

      {showForm && (
        <Card className="rounded-xl border-pink-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{editingId ? "Edit Service" : "New Service"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border-pink-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category *</Label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full h-10 rounded-xl border border-pink-100 px-3 text-sm bg-white">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price (ETB) *</Label>
                <Input type="number" min={0} value={form.basePrice || ""} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) || 0 })} className="rounded-xl border-pink-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration (min) *</Label>
                <Input type="number" min={1} value={form.durationMinutes || ""} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) || 30 })} className="rounded-xl border-pink-100" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl border-pink-100" />
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/30">
              {saving ? "Saving..." : editingId ? "Update Service" : "Create Service"}
            </Button>

            {/* Quick add category */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input placeholder="New category name..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="rounded-xl border-pink-100 text-xs h-9" />
              <Button size="sm" variant="outline" onClick={addCategory} className="rounded-lg border-pink-200 text-pink-600 text-xs shrink-0">Add Category</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([catName, items]) => (
        <div key={catName} className="space-y-2">
          <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-widest">{catName}</h3>
          {items.map((s) => (
            <Card key={s.id} className={`rounded-xl transition-colors ${s.isActive ? "border-pink-50 hover:border-pink-100" : "border-red-50 opacity-50"}`}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-pink-600">ETB {Number(s.basePrice).toFixed(2)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.durationMinutes}m</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-pink-50 text-pink-500"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleActive(s)} className={`p-1.5 rounded-lg ${s.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-emerald-50 text-emerald-500"}`}>
                    {s.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">No services found.</div>
      )}
    </div>
  );
}
