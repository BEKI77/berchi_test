"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, Plus, X, Clock, User, Scissors, Search, Globe, UserPlus, Pencil, Phone, Check, Ban, ShieldAlert, Lock, Unlock, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Appointment = {
  id: string;
  startTime: string;
  endTime: string | null;
  status: string;
  source: string;
  notes: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string | null };
  staff: { id: string; firstName: string; lastName: string } | null;
  service: { id: string; name: string; durationMinutes: number };
};

type StaffOption = { id: string; firstName: string; lastName: string };
type CustomerOption = { id: string; firstName: string; lastName: string; phone: string | null };
type ServiceOption = { id: string; name: string; durationMinutes: number };

type SlotInfo = {
  time: string;
  label: string;
  available: boolean;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  appointment: {
    id: string;
    customerName: string;
    serviceName: string;
    status: string;
  } | null;
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-600 border-blue-200",
  CONFIRMED: "bg-indigo-50 text-indigo-600 border-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-600 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-200",
  NO_SHOW: "bg-red-50 text-red-600 border-red-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
};

const statuses = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"];
const isTerminal = (s: string) => ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(s);

export function AppointmentsClient() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    customerId: "",
    staffId: "",
    serviceId: "",
    startTime: "",
    notes: "",
  });
  const [newCust, setNewCust] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ staffId: "", serviceId: "", startTime: "", notes: "", status: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Blocking state
  const [showAvailability, setShowAvailability] = useState(false);
  const [blockingDate, setBlockingDate] = useState(new Date().toISOString().split("T")[0]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [blockingMode, setBlockingMode] = useState<"specific" | "range">("specific");
  const [blockRange, setBlockRange] = useState({ start: "09:00", end: "10:00" });
  const [blockReason, setBlockReason] = useState("");
  const [blockingSaving, setBlockingSaving] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/appointments");
      if (!res.ok) throw new Error();
      setAppointments(await res.json());
    } catch {
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/admin/appointments/slots?date=${date}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      toast.error("Failed to load availability");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (showAvailability) {
      fetchSlots(blockingDate);
    }
  }, [showAvailability, blockingDate, fetchSlots]);

  useEffect(() => {
    Promise.all([
      fetchAppointments(),
      fetch("/api/staff").then((r) => r.json()).then(setStaff),
      fetch("/api/customers").then((r) => r.json()).then(setCustomers),
      fetch("/api/services").then((r) => r.json()).then(setServices),
    ]);
  }, [fetchAppointments]);

  async function handleSubmit() {
    if (customerMode === "existing" && !form.customerId) {
      toast.error("Please select a customer or switch to 'New Customer'");
      return;
    }
    if (customerMode === "new" && (!newCust.firstName || !newCust.lastName)) {
      toast.error("New customer first and last name are required");
      return;
    }
    if (!form.serviceId || !form.startTime) {
      toast.error("Service and date/time are required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        serviceId: form.serviceId,
        startTime: form.startTime,
        notes: form.notes || null,
        staffId: form.staffId || null,
      };
      if (customerMode === "existing") {
        payload.customerId = form.customerId;
      } else {
        payload.newCustomer = {
          firstName: newCust.firstName,
          lastName: newCust.lastName,
          phone: newCust.phone || null,
          email: newCust.email || null,
        };
      }

      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast.success("Appointment created");
      setShowForm(false);
      setForm({ customerId: "", staffId: "", serviceId: "", startTime: "", notes: "" });
      setNewCust({ firstName: "", lastName: "", phone: "", email: "" });
      setCustomerMode("existing");
      // Refresh customers list too in case new customer was added
      fetch("/api/customers").then((r) => r.json()).then(setCustomers);
      await fetchAppointments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create appointment");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
      await fetchAppointments();
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function assignStaff(id: string, staffId: string) {
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Staff assigned");
      await fetchAppointments();
    } catch {
      toast.error("Failed to assign staff");
    }
  }

  function startEditing(a: Appointment) {
    const dt = new Date(a.startTime);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingId(a.id);
    setEditForm({
      staffId: a.staff?.id || "",
      serviceId: a.service.id,
      startTime: local,
      notes: a.notes || "",
      status: a.status,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: editForm.status,
        notes: editForm.notes || null,
        staffId: editForm.staffId || null,
        serviceId: editForm.serviceId,
        startTime: editForm.startTime,
      };
      const res = await fetch(`/api/admin/appointments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success("Appointment updated");
      setEditingId(null);
      await fetchAppointments();
    } catch {
      toast.error("Failed to update appointment");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleBlock() {
    if (blockingMode === "specific" && selectedSlots.length === 0) {
      toast.error("Please select at least one slot to block");
      return;
    }
    setBlockingSaving(true);
    try {
      const payload: any = {
        date: blockingDate,
        reason: blockReason || "Administrative Block",
      };
      if (blockingMode === "specific") {
        payload.slotTimes = selectedSlots;
      } else {
        payload.startTime = blockRange.start;
        payload.endTime = blockRange.end;
      }

      const res = await fetch("/api/admin/appointments/slots/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      
      toast.success("Availability updated");
      setSelectedSlots([]);
      setBlockReason("");
      await fetchSlots(blockingDate);
      await fetchAppointments();
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setBlockingSaving(false);
    }
  }

  const filtered = appointments.filter((a) => {
    const staffName = a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "";
    const matchSearch =
      `${a.customer.firstName} ${a.customer.lastName} ${staffName} ${a.service.name}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || a.status === filterStatus;
    const matchSource = filterSource === "ALL" || a.source === filterSource;
    return matchSearch && matchStatus && matchSource;
  });

  const onlineCount = appointments.filter((a) => a.source === "ONLINE").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAppointments = filtered.filter((a) => a.startTime.startsWith(todayStr));
  const upcomingAppointments = filtered.filter(
    (a) => new Date(a.startTime) > new Date() && !a.startTime.startsWith(todayStr)
  );
  const pastAppointments = filtered.filter(
    (a) => new Date(a.startTime) < new Date() && !a.startTime.startsWith(todayStr)
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-blue-200 border-t-blue-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading appointments...</p>
      </div>
    );
  }

  function renderAppointment(a: Appointment) {
    const time = new Date(a.startTime);
    const isOnline = a.source === "ONLINE";
    const needsStaff = !a.staff;
    const isEditing = editingId === a.id;

    return (
      <Card key={a.id} className={`rounded-xl transition-colors overflow-hidden ${isOnline ? "border-pink-100 hover:border-pink-200" : "border-blue-50 hover:border-blue-100"}`}>
        {isOnline && <div className="h-0.5 bg-gradient-to-r from-pink-400 to-rose-400" />}
        <CardContent className="py-3">
          {/* Normal view */}
          {!isEditing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${isOnline ? "bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600" : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600"}`}>
                  {a.customer.firstName[0]}{a.customer.lastName[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {a.customer.firstName} {a.customer.lastName}
                    </p>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${isOnline ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                      {isOnline ? <><Globe className="h-2.5 w-2.5 mr-0.5" /> Online</> : "Manual"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3" />
                      {a.service.name}
                    </span>
                    {a.staff ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {a.staff.firstName} {a.staff.lastName}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 font-medium">
                        <User className="h-3 w-3" />
                        No staff assigned
                      </span>
                    )}
                    {a.customer.phone && (
                      <a href={`tel:${a.customer.phone}`} className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
                        <Phone className="h-3 w-3" />
                        {a.customer.phone}
                      </a>
                    )}
                  </div>
                  {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">{a.notes}</p>}
                  {needsStaff && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-medium text-amber-600">Assign:</span>
                      <select
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) assignStaff(a.id, e.target.value); }}
                        className="text-[10px] border border-amber-200 rounded-lg px-1.5 py-0.5 bg-amber-50 cursor-pointer"
                      >
                        <option value="">Pick staff...</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors[a.status] || "bg-gray-50 text-gray-500"}`}>
                  {a.status.replace(/_/g, " ")}
                </span>
                {!isTerminal(a.status) ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateStatus(a.id, "CONFIRMED")}
                      className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <Check className="h-3 w-3" /> Accept
                    </button>
                    <button
                      onClick={() => updateStatus(a.id, "CANCELLED")}
                      className="flex items-center gap-1 text-[10px] font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      <Ban className="h-3 w-3" /> Deny
                    </button>
                    <button
                      onClick={() => startEditing(a)}
                      className="flex items-center gap-1 text-[10px] font-medium text-blue-500 hover:text-blue-700 px-1.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing(a)}
                    className="flex items-center gap-1 text-[10px] font-medium text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Edit form */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-semibold">Edit Appointment</h4>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200">
                    {a.customer.firstName} {a.customer.lastName}
                  </Badge>
                </div>
                <button onClick={() => setEditingId(null)} className="p-1 rounded-md hover:bg-gray-100">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              {a.customer.phone && (
                <a href={`tel:${a.customer.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                  Call Customer: {a.customer.phone}
                </a>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Date &amp; Time</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="h-8 text-xs rounded-lg border-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Service</Label>
                  <select
                    value={editForm.serviceId}
                    onChange={(e) => setEditForm({ ...editForm, serviceId: e.target.value })}
                    className="w-full h-8 rounded-lg border border-blue-100 px-2 text-xs bg-white"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes}min)</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Staff</Label>
                  <select
                    value={editForm.staffId}
                    onChange={(e) => setEditForm({ ...editForm, staffId: e.target.value })}
                    className="w-full h-8 rounded-lg border border-blue-100 px-2 text-xs bg-white"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</Label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditForm({ ...editForm, status: "CONFIRMED" })}
                      className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${editForm.status === "CONFIRMED" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setEditForm({ ...editForm, status: "CANCELLED" })}
                      className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${editForm.status === "CANCELLED" ? "bg-red-500 text-white border-red-500" : "bg-white text-red-600 border-red-200 hover:bg-red-50"}`}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Notes</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes..."
                  className="h-8 text-xs rounded-lg border-blue-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={saveEdit}
                  disabled={editSaving}
                  size="sm"
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-xs h-8 px-4"
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  onClick={() => setEditingId(null)}
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs h-8 px-4"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-500" />
            Appointments
          </h1>
          <p className="text-muted-foreground mt-1">
            {appointments.length} total
            {onlineCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-pink-600 font-medium">
                <Globe className="h-3 w-3" /> {onlineCount} online
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowAvailability(true)} 
            className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <CalendarClock className="h-4 w-4 mr-2" />
            Manage Availability
          </Button>
          <Button onClick={() => setShowForm(true)} className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md shadow-blue-200/40">
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Availability Management Modal */}
      {showAvailability && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border-blue-100 flex flex-col">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-blue-500" />
                  Manage Availability
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Block or unblock specific time slots</p>
              </div>
              <button onClick={() => setShowAvailability(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left side: Date and Mode Selection */}
                <div className="w-full md:w-64 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Select Date</Label>
                    <Input 
                      type="date" 
                      value={blockingDate} 
                      onChange={(e) => setBlockingDate(e.target.value)}
                      className="rounded-xl border-blue-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Blocking Mode</Label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
                      <button
                        onClick={() => setBlockingMode("specific")}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${blockingMode === "specific" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        Specific Slots
                      </button>
                      <button
                        onClick={() => setBlockingMode("range")}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${blockingMode === "range" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        Time Range
                      </button>
                    </div>
                  </div>

                  {blockingMode === "range" ? (
                    <div className="space-y-3 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 animate-in slide-in-from-left-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-blue-600 uppercase">Start Time</Label>
                        <Input type="time" value={blockRange.start} onChange={(e) => setBlockRange({...blockRange, start: e.target.value})} className="h-9 text-sm rounded-lg border-blue-100 bg-white" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-blue-600 uppercase">End Time</Label>
                        <Input type="time" value={blockRange.end} onChange={(e) => setBlockRange({...blockRange, end: e.target.value})} className="h-9 text-sm rounded-lg border-blue-100 bg-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 animate-in slide-in-from-left-2">
                      <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                        Click on the time slots in the grid to select specific chunks you want to block.
                      </p>
                      {selectedSlots.length > 0 && (
                        <p className="text-[10px] font-bold text-indigo-800 mt-2">
                          {selectedSlots.length} slots selected
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Reason / Note</Label>
                    <Input 
                      placeholder="e.g. Lunch break, Training..." 
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="rounded-xl border-blue-100 h-9 text-sm"
                    />
                  </div>

                  <Button 
                    onClick={handleBlock} 
                    disabled={blockingSaving || (blockingMode === "specific" && selectedSlots.length === 0)}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-sm h-10 shadow-lg shadow-blue-200"
                  >
                    {blockingSaving ? "Blocking..." : "Apply Block"}
                  </Button>
                </div>

                {/* Right side: Slots Grid */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Availability Grid</Label>
                    <div className="flex gap-3 text-[10px] font-medium">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Free</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Booked</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400" /> Blocked</span>
                    </div>
                  </div>

                  {loadingSlots ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 rounded-full border-2 border-blue-100 border-t-blue-500 animate-spin" />
                      <p className="text-xs text-muted-foreground">Refreshing slots...</p>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl bg-gray-50 text-center p-6">
                      <Calendar className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-500">No slots available or shop is closed</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                      {slots.map((slot) => {
                        const isBooked = slot.status === "BOOKED";
                        const isBlocked = slot.status === "BLOCKED";
                        const isSelected = selectedSlots.includes(slot.time);
                        
                        return (
                          <button
                            key={slot.time}
                            disabled={isBooked || (blockingMode === "range" && !isBlocked)}
                            onClick={() => {
                              if (isBlocked) {
                                // Maybe handle unblocking here later
                                toast.info("Slot already blocked");
                                return;
                              }
                              if (selectedSlots.includes(slot.time)) {
                                setSelectedSlots(selectedSlots.filter(s => s !== slot.time));
                              } else {
                                setSelectedSlots([...selectedSlots, slot.time]);
                              }
                            }}
                            className={`group relative p-2.5 rounded-xl border text-left transition-all ${
                              isBooked 
                                ? "bg-blue-50 border-blue-100 opacity-80 cursor-not-allowed" 
                                : isBlocked 
                                ? "bg-gray-100 border-gray-200 cursor-not-allowed" 
                                : isSelected 
                                ? "bg-blue-600 border-blue-600 shadow-md shadow-blue-200" 
                                : "bg-white border-gray-100 hover:border-blue-300 hover:bg-blue-50/30"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className={`text-[10px] font-bold ${isSelected ? "text-blue-100" : isBooked ? "text-blue-600" : isBlocked ? "text-gray-400" : "text-gray-400"}`}>
                                {slot.label.split(" ")[1]}
                              </span>
                              <span className={`text-sm font-black ${isSelected ? "text-white" : isBooked ? "text-blue-700" : isBlocked ? "text-gray-600" : "text-gray-900"}`}>
                                {slot.label.split(" ")[0]}
                              </span>
                            </div>
                            
                            {isBooked && (
                              <div className="absolute top-2 right-2">
                                <Lock className="h-3 w-3 text-blue-400" />
                              </div>
                            )}
                            {isBlocked && (
                              <div className="absolute top-2 right-2">
                                <ShieldAlert className="h-3 w-3 text-gray-400" />
                              </div>
                            )}

                            {/* Hover info for booked slots */}
                            {isBooked && slot.appointment && (
                              <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-900 text-white rounded-lg text-[9px] font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                                <p className="font-bold text-blue-400">{slot.appointment.serviceName}</p>
                                <p>{slot.appointment.customerName}</p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Booked by Customer</span>
                <span className="flex items-center gap-1.5"><ShieldAlert className="h-3 w-3" /> Blocked by Admin</span>
              </div>
              <p>Tip: Use range mode for bulk blocking</p>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer, staff, service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-blue-100"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-10 rounded-xl border border-blue-100 px-3 text-sm bg-white"
        >
          <option value="ALL">All Status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="h-10 rounded-xl border border-blue-100 px-3 text-sm bg-white"
        >
          <option value="ALL">All Sources</option>
          <option value="ONLINE">Online Only</option>
          <option value="MANUAL">Manual Only</option>
        </select>
      </div>

      {/* New appointment form */}
      {showForm && (
        <Card className="rounded-xl border-blue-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">New Appointment</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {/* Customer: toggle between existing and new */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer *</Label>
                <button
                  type="button"
                  onClick={() => setCustomerMode(customerMode === "existing" ? "new" : "existing")}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  <UserPlus className="h-3 w-3" />
                  {customerMode === "existing" ? "Add New Customer" : "Select Existing"}
                </button>
              </div>
              {customerMode === "existing" ? (
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full h-10 rounded-xl border border-blue-100 px-3 text-sm bg-white">
                  <option value="">Select customer...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.phone ? `(${c.phone})` : ""}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                  <Input value={newCust.firstName} onChange={(e) => setNewCust({ ...newCust, firstName: e.target.value })} placeholder="First name *" className="rounded-lg border-blue-100 bg-white text-sm h-9" />
                  <Input value={newCust.lastName} onChange={(e) => setNewCust({ ...newCust, lastName: e.target.value })} placeholder="Last name *" className="rounded-lg border-blue-100 bg-white text-sm h-9" />
                  <Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="Phone" className="rounded-lg border-blue-100 bg-white text-sm h-9" />
                  <Input value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="Email" className="rounded-lg border-blue-100 bg-white text-sm h-9" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staff (optional)</Label>
                <select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="w-full h-10 rounded-xl border border-blue-100 px-3 text-sm bg-white">
                  <option value="">Assign later...</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service *</Label>
                <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} className="w-full h-10 rounded-xl border border-blue-100 px-3 text-sm bg-white">
                  <option value="">Select service...</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes}min)</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time *</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-xl border-blue-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." className="rounded-xl border-blue-100" />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md shadow-blue-200/30">
              {saving ? "Creating..." : "Create Appointment"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today */}
      {todayAppointments.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Today</h2>
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{todayAppointments.length}</span>
          </div>
          <div className="grid gap-2.5">{todayAppointments.map(renderAppointment)}</div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingAppointments.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100">
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Upcoming</h2>
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">{upcomingAppointments.length}</span>
          </div>
          <div className="grid gap-2.5">{upcomingAppointments.map(renderAppointment)}</div>
        </div>
      )}

      {/* Past */}
      {pastAppointments.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Past</h2>
          </div>
          <div className="grid gap-2.5">{pastAppointments.map(renderAppointment)}</div>
        </div>
      )}

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-blue-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
            <Calendar className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold">No appointments</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">Create a new appointment to get started.</p>
        </div>
      )}
    </div>
  );
}
