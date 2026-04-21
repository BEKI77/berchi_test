"use client";

import { useEffect, useState } from "react";
import { Shield, Users, Key, Plus, Edit, Trash2, Save, X, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions?: Permission[];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export function PermissionsClient() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"permissions" | "roles" | "users">("permissions");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Permission form state
  const [permissionForm, setPermissionForm] = useState({
    name: "",
    description: "",
    resource: "",
    action: "",
  });
  const [showPermissionForm, setShowPermissionForm] = useState(false);

  // Role form state
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
  });
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  // User-specific permission editing state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserEffective, setSelectedUserEffective] = useState<Set<string>>(new Set());
  const [selectedUserOverrides, setSelectedUserOverrides] = useState<Record<string, "inherit" | "grant" | "deny">>({});
  const [loadingUserPermissions, setLoadingUserPermissions] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [permissionsRes, rolesRes, usersRes] = await Promise.all([
        fetch("/api/admin/permissions"),
        fetch("/api/admin/roles"),
        fetch("/api/admin/employees"),
      ]);

      const permissionsData = await permissionsRes.json();
      const rolesData = await rolesRes.json();
      const usersData = await usersRes.json();

      setPermissions(permissionsData.permissions || []);
      setRoles(rolesData.roles || []);
      setUsers(usersData.employees || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load permissions data");
    } finally {
      setLoading(false);
    }
  }

  async function createPermission() {
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissionForm),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create permission");
      }

      toast.success("Permission created successfully");
      setShowPermissionForm(false);
      setPermissionForm({ name: "", description: "", resource: "", action: "" });
      fetchData();
    } catch (error) {
      console.error("Error creating permission:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create permission");
    }
  }

  async function createRole() {
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...roleForm,
          permissionIds: selectedPermissions,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create role");
      }

      toast.success("Role created successfully");
      resetRoleFormState();
      fetchData();
    } catch (error) {
      console.error("Error creating role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create role");
    }
  }

  async function updateRole() {
    if (!editingRoleId) return;

    try {
      const res = await fetch(`/api/admin/roles/${editingRoleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...roleForm,
          permissionIds: selectedPermissions,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to update role");
      }

      toast.success("Role updated successfully");
      resetRoleFormState();
      fetchData();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  }

  function resetRoleFormState() {
    setEditingRoleId(null);
    setRoleForm({ name: "", description: "" });
    setSelectedPermissions([]);
    setShowRoleForm(false);
  }

  function startCreateRoleForm() {
    setEditingRoleId(null);
    setRoleForm({ name: "", description: "" });
    setSelectedPermissions([]);
    setShowRoleForm(true);
  }

  function startEditRoleForm(role: Role) {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description || "",
    });
    setSelectedPermissions((role.permissions || []).map((permission) => permission.id));
    setShowRoleForm(true);
  }

  async function updateUserPermission(userId: string, permissionId: string, action: "grant" | "deny" | "remove") {
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId, action }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user permission");
      }

      toast.success(`Permission ${action}ed successfully`);
    } catch (error) {
      console.error("Error updating user permission:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update permission");
    }
  }

  async function loadUserPermissions(user: User) {
    setSelectedUser(user);
    setLoadingUserPermissions(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/permissions`);
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to load user permissions");
      }

      const data = await res.json();

      const effective = new Set<string>((data.permissions || []).map((p: Permission) => p.id));
      setSelectedUserEffective(effective);

      const overrides: Record<string, "inherit" | "grant" | "deny"> = {};
      (data.userSpecificAssignments || []).forEach((item: { permission: Permission; isGranted: boolean }) => {
        overrides[item.permission.id] = item.isGranted ? "grant" : "deny";
      });

      setSelectedUserOverrides(overrides);
    } catch (error) {
      console.error("Error loading user permissions:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load user permissions");
    } finally {
      setLoadingUserPermissions(false);
    }
  }

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground/80" />
        <p className="text-sm text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Admin</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </span>
            <span>Permissions</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define what each role and team member can see and do inside your salon system.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Key className="h-3.5 w-3.5" />
            Access control
          </div>
          <div className="flex w-full gap-1 rounded-full bg-muted p-1 sm:w-auto">
            <Button
              type="button"
              variant={activeTab === "permissions" ? "default" : "ghost"}
              onClick={() => setActiveTab("permissions")}
              className={`h-8 flex-1 rounded-full px-3 text-xs font-medium sm:flex-none ${activeTab === "permissions" ? "shadow-sm" : "text-muted-foreground"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                <span>Permissions</span>
              </span>
            </Button>
            <Button
              type="button"
              variant={activeTab === "roles" ? "default" : "ghost"}
              onClick={() => setActiveTab("roles")}
              className={`h-8 flex-1 rounded-full px-3 text-xs font-medium sm:flex-none ${activeTab === "roles" ? "shadow-sm" : "text-muted-foreground"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>Roles</span>
              </span>
            </Button>
            <Button
              type="button"
              variant={activeTab === "users" ? "default" : "ghost"}
              onClick={() => setActiveTab("users")}
              className={`h-8 flex-1 rounded-full px-3 text-xs font-medium sm:flex-none ${activeTab === "users" ? "shadow-sm" : "text-muted-foreground"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                <span>Users</span>
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">System permissions</h3>
              <p className="text-xs text-muted-foreground">Fine-grained capabilities grouped by resource.</p>
            </div>
            <Button
              type="button"
              onClick={() => setShowPermissionForm(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              New permission
            </Button>
          </div>

          {showPermissionForm && (
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardHeader className="px-6 pb-2 pt-5">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span>Create permission</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setShowPermissionForm(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pb-6 pt-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Permission name</Label>
                    <Input
                      value={permissionForm.name}
                      onChange={(e) => setPermissionForm({ ...permissionForm, name: e.target.value })}
                      placeholder="e.g. appointments.create"
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Resource</Label>
                    <Input
                      value={permissionForm.resource}
                      onChange={(e) => setPermissionForm({ ...permissionForm, resource: e.target.value })}
                      placeholder="e.g. appointments"
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Action</Label>
                    <Input
                      value={permissionForm.action}
                      onChange={(e) => setPermissionForm({ ...permissionForm, action: e.target.value })}
                      placeholder="e.g. create"
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                    <Input
                      value={permissionForm.description}
                      onChange={(e) => setPermissionForm({ ...permissionForm, description: e.target.value })}
                      placeholder="Optional description"
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    onClick={createPermission}
                    className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-medium"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Create permission
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPermissionForm(false)}
                    className="rounded-full px-4 text-xs font-medium"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
              <Card
                key={resource}
                className="border border-border/60 bg-linear-to-b from-background to-muted/40 shadow-sm"
              >
                <CardHeader className="px-5 pb-2 pt-4">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span className="capitalize">{resource}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {resourcePermissions.length} permission{resourcePermissions.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-2">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {resourcePermissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                      >
                        <div>
                          <div className="text-sm font-medium">{permission.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {permission.description || permission.action}
                          </div>
                        </div>
                        <Badge
                          variant={permission.isActive ? "default" : "secondary"}
                          className="mt-0.5 text-[11px] uppercase tracking-wide"
                        >
                          {permission.action}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">System roles</h3>
              <p className="text-xs text-muted-foreground">High-level access profiles composed of many permissions.</p>
            </div>
            <Button
              type="button"
              onClick={startCreateRoleForm}
              className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              New role
            </Button>
          </div>

          {showRoleForm && (
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardHeader className="px-6 pb-2 pt-5">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span>{editingRoleId ? "Edit role" : "Create role"}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={resetRoleFormState}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pb-6 pt-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Role name</Label>
                    <Input
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      placeholder="e.g. MANAGER"
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                    <Input
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      placeholder="Optional description"
                      className="h-9 rounded-xl border-input bg-background/80 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Permissions</Label>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-muted/40 p-2">
                    {permissions.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg bg-background px-2 py-1.5 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{permission.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {permission.description || `${permission.resource}.${permission.action}`}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, permission.id]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter((id) => id !== permission.id));
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-input text-primary focus-visible:outline-none"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    onClick={editingRoleId ? updateRole : createRole}
                    className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-medium"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {editingRoleId ? "Save changes" : "Create role"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetRoleFormState}
                    className="rounded-full px-4 text-xs font-medium"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <Card key={role.id} className="border border-border/60 bg-card shadow-sm">
                <CardHeader className="px-5 pb-2 pt-4">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>{role.name}</span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => startEditRoleForm(role)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 pt-1">
                  {role.description && (
                    <p className="mb-2 text-xs text-muted-foreground">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {role.permissions?.map((permission) => (
                      <Badge key={permission.id} variant="secondary" className="text-[11px]">
                        {permission.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* User Permissions Tab */}
      {activeTab === "users" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">User permission overrides</h3>
              <p className="text-xs text-muted-foreground">
                Start from the user’s role, then override specific permissions only where needed.
              </p>
            </div>
          </div>

          {/* Users grid */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              return (
                <Card
                  key={user.id}
                  className={`border bg-card shadow-sm transition-colors ${isSelected ? "border-primary/60" : "border-border/60"
                    }`}
                >
                  <CardHeader className="px-5 pb-3 pt-4">
                    <CardTitle className="flex items-center justify-between text-sm font-medium">
                      <div className="flex flex-col">
                        <span>
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[11px]">{user.role}</Badge>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => loadUserPermissions(user)}
                          className="h-8 rounded-full px-3 text-xs font-medium"
                        >
                          Manage
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* Selected user detail panel */}
          {selectedUser && (
            <Card className="mt-4 border border-border/60 bg-card shadow-sm">
              <CardHeader className="px-5 pb-2 pt-4">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <div className="flex flex-col">
                    <span>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedUser.email} • Role: {selectedUser.role}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5 pt-2">
                {loadingUserPermissions ? (
                  <p className="text-sm text-muted-foreground">Loading user permissions...</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                      <div key={resource} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold capitalize">{resource}</h4>
                        </div>
                        <div className="space-y-1.5">
                          {resourcePermissions.map((permission) => {
                            const override = selectedUserOverrides[permission.id] || "inherit";
                            const isEffective = selectedUserEffective.has(permission.id);

                            return (
                              <div
                                key={permission.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 p-2.5"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{permission.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {permission.description || `${permission.resource}.${permission.action}`}
                                  </span>
                                  <span className="mt-0.5 text-[11px] font-medium">
                                    Effective: {isEffective ? (
                                      <span className="text-emerald-600">Allowed</span>
                                    ) : (
                                      <span className="text-rose-600">Denied</span>
                                    )}
                                    {override !== "inherit" && (
                                      <span className="ml-1 text-xs text-muted-foreground">(override)</span>
                                    )}
                                  </span>
                                </div>
                                <div className="ml-4 flex min-w-47.5 flex-col gap-1">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant={override === "inherit" ? "default" : "outline"}
                                      size="xs"
                                      onClick={async () => {
                                        if (override === "inherit") return;
                                        await updateUserPermission(selectedUser.id, permission.id, "remove");
                                        await loadUserPermissions(selectedUser);
                                      }}
                                      className="h-7 rounded-full px-3 text-[11px]"
                                    >
                                      Inherit
                                    </Button>
                                    <Button
                                      variant={override === "grant" ? "default" : "outline"}
                                      size="xs"
                                      onClick={async () => {
                                        if (override === "grant") return;
                                        await updateUserPermission(selectedUser.id, permission.id, "grant");
                                        await loadUserPermissions(selectedUser);
                                      }}
                                      className="h-7 rounded-full px-3 text-[11px] text-emerald-700 border-emerald-300"
                                    >
                                      Allow
                                    </Button>
                                    <Button
                                      variant={override === "deny" ? "default" : "outline"}
                                      size="xs"
                                      onClick={async () => {
                                        if (override === "deny") return;
                                        await updateUserPermission(selectedUser.id, permission.id, "deny");
                                        await loadUserPermissions(selectedUser);
                                      }}
                                      className="h-7 rounded-full px-3 text-[11px] text-rose-700 border-rose-300"
                                    >
                                      Deny
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

