"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Shield, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/constants";
import { openPrinterSettings, printerStatus } from "@/lib/desktop-print";

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

  /**
   * Which printers this PC prints tickets on, or null when the salon system is
   * open in an ordinary browser rather than the desktop window.
   *
   * Printers belong to the PC, not to the salon, so they are not among the
   * settings saved on this page -- a second till would answer differently. This
   * is only a way in, and it is only shown where there is something to open.
   * Read after mount, because it depends on `window`.
   */
  const [printers, setPrinters] = useState<{ slip: string | null; receipt: string | null } | null>(null);

  useEffect(() => {
    printerStatus().then(setPrinters).catch(() => {});
  }, []);

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
        <div className="h-10 w-10 rounded-full border-2 border-border border-t-foreground/80 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Admin</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Settings className="h-4 w-4" />
            </span>
            <span>Settings</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fine-tune how your salon operates across locations, hours, and finance.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="hidden h-10 items-center gap-2 rounded-full px-5 text-sm font-medium shadow-sm md:inline-flex"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        <div className="space-y-6">
          {/* Salon Info */}
          <Card className="border border-border/60 bg-gradient-to-b from-background to-muted/40 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Salon profile</h3>
                  <p className="text-xs text-muted-foreground">Details shown on invoices, receipts and client messages.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Salon name</Label>
                  <Input
                    value={form.salonName}
                    onChange={(e) => setForm({ ...form, salonName: e.target.value })}
                    className="h-9 rounded-xl border-input bg-background/80 text-sm"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Phone number</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Currency</Label>
                    <Input
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="h-9 rounded-xl border-input bg-background/80 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Hours */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Business hours</h3>
                  <p className="text-xs text-muted-foreground">Control when bookings and walk-ins are allowed.</p>
                </div>
              </div>

              <div className="space-y-2 text-[11px] text-muted-foreground">
                <p>Use the toggle to quickly set a day as closed.</p>
              </div>

              <div className="space-y-3">
                {DAY_NAMES.map((day) => {
                  const hours = form.businessHours[day] || { open: "closed", close: "closed" };
                  const isClosed = hours.open === "closed";

                  return (
                    <div
                      key={day}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{day}</span>
                        {isClosed && (
                          <span className="rounded-full bg-background px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Closed
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                        {!isClosed ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Input
                              type="time"
                              value={hours.open}
                              onChange={(e) => handleHourChange(day, "open", e.target.value)}
                              className="h-9 w-full rounded-lg border-input bg-background text-xs sm:w-28"
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={hours.close}
                              onChange={(e) => handleHourChange(day, "close", e.target.value)}
                              className="h-9 w-full rounded-lg border-input bg-background text-xs sm:w-28"
                            />
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground sm:w-[220px] sm:text-right">
                            This day is currently marked as closed.
                          </span>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleClosed(day)}
                          className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide"
                        >
                          {isClosed ? "Mark open" : "Mark closed"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Financial */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div>
                <h3 className="text-sm font-medium text-foreground">Financial settings</h3>
                <p className="text-xs text-muted-foreground">Defaults applied to invoices, services and commissions.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tax rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.taxRate || ""}
                    onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-input bg-background/80 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Default commission (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.commissionDefault || ""}
                    onChange={(e) => setForm({ ...form, commissionDefault: Number(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-input bg-background/80 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipt */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-sm font-medium text-foreground">Receipt settings</h3>
                <p className="text-xs text-muted-foreground">Automatically create receipts after successful payments.</p>
              </div>
              <label className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Enable receipts</p>
                  <p className="text-xs text-muted-foreground">Send a digital receipt to clients whenever a sale is completed.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.receiptsEnabled}
                  onChange={(e) => setForm({ ...form, receiptsEnabled: e.target.checked })}
                  className="h-5 w-9 cursor-pointer appearance-none rounded-full border border-input bg-muted outline-none transition-[background-color] checked:bg-primary"
                />
              </label>
            </CardContent>
          </Card>

          {/* Permissions Management */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Permissions
                </div>
                <h3 className="mt-3 text-sm font-medium text-foreground">Role & access management</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Control what your team can see and do inside the admin dashboard.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/admin/settings/permissions")}
                className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-medium"
              >
                <Shield className="h-4 w-4" />
                Manage roles
              </Button>
            </CardContent>
          </Card>

          {/* The receipt printer, which belongs to this PC rather than to the
              salon: only offered inside the desktop window, where there is
              something to open. */}
          {printers && (
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="flex items-start justify-between gap-4 p-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Printer className="h-3.5 w-3.5" />
                    This computer
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-foreground">Receipt printer</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {printers.slip || printers.receipt ? (
                      <>
                        Number slip: <span className="font-medium">{printers.slip ?? "through the window"}</span>
                        {" · "}
                        Receipt: <span className="font-medium">{printers.receipt ?? "through the window"}</span>
                      </>
                    ) : (
                      <>
                        No printer set up on this computer, so tickets print through the window to
                        whichever printer Windows has as its default.
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await openPrinterSettings();
                    // The setup window writes its own settings file, so pick up
                    // what changed when the admin comes back to this page.
                    printerStatus().then(setPrinters).catch(() => {});
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Printer setup
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Changes are applied to all new bookings and sales.</span>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary/80 text-sm font-semibold text-primary-foreground shadow-sm hover:from-primary hover:to-primary/90 md:w-auto md:self-end"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>

  );
}

