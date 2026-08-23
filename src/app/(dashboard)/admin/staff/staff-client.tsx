"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Edit2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPercent, fromBasisPoints } from "@/lib/money";

type Staff = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  commissionRate: number;
  isActive: boolean;
  createdAt: string;
};

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  commissionRate: number;
  password: string;
};

const emptyForm: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "SERVER",
  commissionRate: 0,
  password: "",
};

export function StaffClient() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error();
      setStaff(await res.json());
    } catch {
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(s: Staff) {
    setEditingId(s.id);
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone || "",
      role: s.role,
      commissionRate: fromBasisPoints(s.commissionRate),
      password: "",
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error("First name, last name, and email are required");
      return;
    }
    if (!editingId && !form.password) {
      toast.error("Password is required for new staff");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/staff/${editingId}` : "/api/staff";
      const method = editingId ? "PATCH" : "POST";
      const body: Record<string, unknown> = { ...form };
      if (!body.password) delete body.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }

      toast.success(editingId ? "Staff updated" : "Staff created");
      setShowForm(false);
      await fetchStaff();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Staff) {
    try {
      const res = await fetch(`/api/staff/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(s.isActive ? "Staff deactivated" : "Staff reactivated");
      await fetchStaff();
    } catch {
      toast.error("Failed to update status");
    }
  }

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  const roleColors: Record<string, string> = {
    OWNER: "bg-amber-50 text-amber-700 border-amber-200",
    SERVER: "bg-pink-50 text-pink-700 border-pink-200",
    CASHIER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-violet-200 border-t-violet-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading staff...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-500" />
            Staff Management
          </h1>
          <p className="text-muted-foreground mt-1">{staff.length} staff member(s)</p>
        </div>
        <Button onClick={openAdd} className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-md shadow-violet-200/40">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <Input
          placeholder="Search by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-11 rounded-xl border-violet-100 focus:border-violet-300"
        />
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Card className="rounded-xl border-violet-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{editingId ? "Edit Staff" : "New Staff Member"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded-xl border-violet-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded-xl border-violet-100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border-violet-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border-violet-100" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role *</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full h-10 rounded-xl border border-violet-100 px-3 text-sm bg-white focus:border-violet-300 focus:outline-none"
                >
                  <option value="SERVER">Server</option>
                  <option value="CASHIER">Cashier</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Commission %</Label>
                <Input type="number" min={0} max={100} value={form.commissionRate || ""} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) || 0 })} className="rounded-xl border-violet-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{editingId ? "New Password" : "Password *"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? "Leave blank to keep" : ""} className="rounded-xl border-violet-100" />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-md shadow-violet-200/30">
              {saving ? "Saving..." : editingId ? "Update Staff" : "Create Staff"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Staff list */}
      <div className="grid gap-2.5">
        {filtered.map((s) => (
          <Card key={s.id} className={`rounded-xl transition-colors ${s.isActive ? "border-violet-50 hover:border-violet-100" : "border-red-50 opacity-60"}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0 ${s.isActive ? "bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600" : "bg-gray-100 text-gray-400"}`}>
                    {s.firstName[0]}{s.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm cursor-pointer hover:text-violet-600 transition-colors" onClick={() => router.push(`/admin/staff/${s.id}`)}>{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${roleColors[s.role] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {s.role}
                  </span>
                  {s.commissionRate > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">{formatPercent(s.commissionRate)}</span>
                  )}
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-500 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleActive(s)} className={`p-1.5 rounded-lg transition-colors ${s.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-emerald-50 text-emerald-500"}`}>
                    {s.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">No staff members found.</div>
        )}
      </div>
    </div>
  );
}
