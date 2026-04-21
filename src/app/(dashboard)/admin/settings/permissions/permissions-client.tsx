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
      setShowRoleForm(false);
      setRoleForm({ name: "", description: "" });
      setSelectedPermissions([]);
      fetchData();
    } catch (error) {
      console.error("Error creating role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create role");
    }
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
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-gray-200 border-t-gray-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-gray-500" />
          Permission Management
        </h1>
        <p className="text-muted-foreground mt-1">Manage user roles and permissions</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <Button
          variant={activeTab === "permissions" ? "default" : "ghost"}
          onClick={() => setActiveTab("permissions")}
          className="flex items-center gap-2"
        >
          <Key className="h-4 w-4" />
          Permissions
        </Button>
        <Button
          variant={activeTab === "roles" ? "default" : "ghost"}
          onClick={() => setActiveTab("roles")}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          Roles
        </Button>
        <Button
          variant={activeTab === "users" ? "default" : "ghost"}
          onClick={() => setActiveTab("users")}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          User Permissions
        </Button>
      </div>

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Permissions</h3>
            <Button onClick={() => setShowPermissionForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Permission
            </Button>
          </div>

          {showPermissionForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Create New Permission</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowPermissionForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Permission Name</Label>
                    <Input
                      value={permissionForm.name}
                      onChange={(e) => setPermissionForm({ ...permissionForm, name: e.target.value })}
                      placeholder="e.g., appointments.create"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Resource</Label>
                    <Input
                      value={permissionForm.resource}
                      onChange={(e) => setPermissionForm({ ...permissionForm, resource: e.target.value })}
                      placeholder="e.g., appointments"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Input
                      value={permissionForm.action}
                      onChange={(e) => setPermissionForm({ ...permissionForm, action: e.target.value })}
                      placeholder="e.g., create"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={permissionForm.description}
                      onChange={(e) => setPermissionForm({ ...permissionForm, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createPermission} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Create Permission
                  </Button>
                  <Button variant="outline" onClick={() => setShowPermissionForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
              <Card key={resource}>
                <CardHeader>
                  <CardTitle className="capitalize">{resource}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {resourcePermissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-sm">{permission.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {permission.description || permission.action}
                          </div>
                        </div>
                        <Badge variant={permission.isActive ? "default" : "secondary"}>
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
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Roles</h3>
            <Button onClick={() => setShowRoleForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </div>

          {showRoleForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Create New Role</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowRoleForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role Name</Label>
                    <Input
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      placeholder="e.g., MANAGER"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                    {permissions.map((permission) => (
                      <label key={permission.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, permission.id]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(id => id !== permission.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{permission.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createRole} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Create Role
                  </Button>
                  <Button variant="outline" onClick={() => setShowRoleForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{role.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {role.permissions?.map((permission) => (
                      <Badge key={permission.id} variant="secondary" className="text-xs">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">User Permission Overrides</h3>
            <p className="text-xs text-muted-foreground">
              Select a user to fine-tune permissions on top of their role.
            </p>
          </div>

          {/* Users grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              return (
                <Card key={user.id} className={isSelected ? "border-pink-400 shadow-sm" : ""}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span>{user.firstName} {user.lastName}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{user.role}</Badge>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => loadUserPermissions(user)}
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
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span>{selectedUser.firstName} {selectedUser.lastName}</span>
                    <span className="text-xs text-muted-foreground">
                      {selectedUser.email} • Role: {selectedUser.role}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                                className="flex items-center justify-between p-2 border rounded-md bg-white/60"
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
                                <div className="flex flex-col gap-1 ml-4 min-w-[180px]">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      variant={override === "inherit" ? "default" : "outline"}
                                      size="xs"
                                      onClick={async () => {
                                        if (override === "inherit") return;
                                        await updateUserPermission(selectedUser.id, permission.id, "remove");
                                        await loadUserPermissions(selectedUser);
                                      }}
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
                                      className="text-emerald-700 border-emerald-300"
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
                                      className="text-rose-700 border-rose-300"
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
