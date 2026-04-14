"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  ArrowLeft,
  Calendar,
  Scissors,
  User,
  Phone,
  Mail,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type StaffOption = { id: string; firstName: string; lastName: string };
type ServiceOption = { id: string; name: string; durationMinutes: number; basePrice: string };

export default function WalkInPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [appointment, setAppointment] = useState({
    staffId: "",
    serviceId: "",
    notes: "",
  });

  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/staff").then((r) => r.json()).then(setStaff),
      fetch("/api/services").then((r) => r.json()).then(setServices),
    ]);
  }, []);

  async function handleCreateCustomer() {
    if (!customer.firstName) {
      toast.error("First name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone || null,
          email: customer.email || null,
          notes: customer.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create customer");
      }
      const created = await res.json();
      setCreatedCustomerId(created.id);
      toast.success("Customer created!");
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAppointment() {
    if (!createdCustomerId || !appointment.staffId || !appointment.serviceId) {
      toast.error("Please select a staff member and service");
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: createdCustomerId,
          staffId: appointment.staffId,
          serviceId: appointment.serviceId,
          startTime: now.toISOString(),
          notes: appointment.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Walk-in appointment created!");
      router.push("/cashier");
    } catch {
      toast.error("Failed to create appointment");
    } finally {
      setSaving(false);
    }
  }

  function handleSkipAppointment() {
    toast.success("Customer registered! They can be assigned later.");
    router.push("/cashier");
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/cashier")} className="rounded-xl hover:bg-teal-50">
          <ArrowLeft className="h-5 w-5 text-teal-600" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-500" />
            Walk-In Registration
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Quick customer creation + optional appointment</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${step === 1 ? "bg-teal-100 text-teal-700" : "bg-emerald-100 text-emerald-700"}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold">1</span>
          Customer Info
        </div>
        <div className="h-px flex-1 bg-gray-200" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${step === 2 ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-400"}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold">2</span>
          Appointment
        </div>
      </div>

      {/* Step 1: Customer Info */}
      {step === 1 && (
        <Card className="rounded-xl border-teal-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <User className="h-3 w-3" /> First Name *
                </Label>
                <Input
                  value={customer.firstName}
                  onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })}
                  placeholder="First name"
                  className="rounded-xl border-teal-100"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name</Label>
                <Input
                  value={customer.lastName}
                  onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })}
                  placeholder="Last name"
                  className="rounded-xl border-teal-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="Optional"
                  className="rounded-xl border-teal-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <Input
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  placeholder="Optional"
                  className="rounded-xl border-teal-100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> Notes
              </Label>
              <Input
                value={customer.notes}
                onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                placeholder="Any preferences or notes..."
                className="rounded-xl border-teal-100"
              />
            </div>
            <Button
              onClick={handleCreateCustomer}
              disabled={saving || !customer.firstName}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-md shadow-teal-200/40 text-base font-semibold"
            >
              {saving ? "Creating..." : "Create Customer & Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Appointment */}
      {step === 2 && (
        <Card className="rounded-xl border-teal-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                {customer.firstName[0]}{customer.lastName[0]}
              </div>
              <div>
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <p className="text-[10px] text-muted-foreground">Customer created successfully</p>
              </div>
            </div>

            <p className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-500" />
              Schedule Immediate Appointment (Optional)
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User className="h-3 w-3" /> Assign Staff
              </Label>
              <select
                value={appointment.staffId}
                onChange={(e) => setAppointment({ ...appointment, staffId: e.target.value })}
                className="w-full h-10 rounded-xl border border-teal-100 px-3 text-sm bg-white"
              >
                <option value="">Select staff member...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Scissors className="h-3 w-3" /> Service
              </Label>
              <select
                value={appointment.serviceId}
                onChange={(e) => setAppointment({ ...appointment, serviceId: e.target.value })}
                className="w-full h-10 rounded-xl border border-teal-100 px-3 text-sm bg-white"
              >
                <option value="">Select service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — ETB {Number(s.basePrice).toFixed(0)} ({s.durationMinutes}min)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</Label>
              <Input
                value={appointment.notes}
                onChange={(e) => setAppointment({ ...appointment, notes: e.target.value })}
                placeholder="Optional appointment notes..."
                className="rounded-xl border-teal-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                variant="outline"
                onClick={handleSkipAppointment}
                className="h-11 rounded-xl border-teal-200 text-teal-600 hover:bg-teal-50"
              >
                Skip — No Appointment
              </Button>
              <Button
                onClick={handleCreateAppointment}
                disabled={saving || !appointment.staffId || !appointment.serviceId}
                className="h-11 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-md shadow-teal-200/40 font-semibold"
              >
                {saving ? "Creating..." : "Create Appointment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
