"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/constants";

export function SettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    salonName: "",
    address: "",
    phone: "",
    taxRate: 0,
    currency: "ETB",
    commissionDefault: 0,
    receiptsEnabled: true,
    businessHours: {} as Record<string, { open: string; close: string }>,
  });

  const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setForm({
            salonName: data.salonName || "",
            address: data.address || "",
            phone: data.phone || "",
            taxRate: Number(data.taxRate) || 0,
            currency: data.currency || "ETB",
            commissionDefault: Number(data.commissionDefault) || 0,
            receiptsEnabled: data.receiptsEnabled ?? true,
            businessHours: data.businessHours ? JSON.parse(data.businessHours) : DEFAULT_BUSINESS_HOURS,
          });
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        businessHours: JSON.stringify(form.businessHours),
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success("Settings saved!");
      await res.json();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const handleHourChange = (day: string, field: "open" | "close", value: string) => {
    setForm(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: {
          ...prev.businessHours[day],
          [field]: value
        }
      }
    }));
  };

  const toggleClosed = (day: string) => {
    const isClosed = form.businessHours[day]?.open === "closed";
    setForm(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: isClosed
          ? { open: "09:00", close: "18:00" }
          : { open: "closed", close: "closed" }
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-gray-200 border-t-gray-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-500" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure your salon system</p>
      </div>

      {/* Salon Info */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
        <CardContent className="pt-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-600">Salon Profile</h3>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Salon Name</Label>
            <Input value={form.salonName} onChange={(e) => setForm({ ...form, salonName: e.target.value })} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
        <CardContent className="pt-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-600">Business Hours</h3>
          <div className="space-y-3">
            {DAY_NAMES.map((day) => {
              const hours = form.businessHours[day] || { open: "closed", close: "closed" };
              const isClosed = hours.open === "closed";

              return (
                <div key={day} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="w-24">
                    <span className="text-sm font-medium capitalize">{day}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {!isClosed ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) => handleHourChange(day, "open", e.target.value)}
                          className="w-32 h-9 rounded-lg"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) => handleHourChange(day, "close", e.target.value)}
                          className="w-32 h-9 rounded-lg"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic w-[280px] text-center">Closed</span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleClosed(day)}
                      className={`h-9 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider ${isClosed ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        }`}
                    >
                      {isClosed ? "Open" : "Close"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Financial */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
        <CardContent className="pt-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600">Financial Settings</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Rate (%)</Label>
              <Input type="number" min={0} max={100} value={form.taxRate || ""} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) || 0 })} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default Commission (%)</Label>
              <Input type="number" min={0} max={100} value={form.commissionDefault || ""} onChange={(e) => setForm({ ...form, commissionDefault: Number(e.target.value) || 0 })} className="rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
        <CardContent className="pt-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600">Receipt Settings</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.receiptsEnabled}
              onChange={(e) => setForm({ ...form, receiptsEnabled: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm font-medium">Enable receipt generation after payment</span>
          </label>
        </CardContent>
      </Card>

      {/* Permissions Management */}
      <Card className="rounded-xl border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-purple-400 to-indigo-400" />
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-600">Permission Management</h3>
              <p className="text-xs text-muted-foreground mt-1">Manage user roles and access permissions</p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/admin/settings/permissions"}
              className="flex items-center gap-2 rounded-lg"
            >
              <Shield className="h-4 w-4" />
              Manage Permissions
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/30 text-base font-semibold">
        <Save className="h-5 w-5 mr-2" />
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>

  );
}
