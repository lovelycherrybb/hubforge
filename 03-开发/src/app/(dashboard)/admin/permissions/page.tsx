"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/Table";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  role?: "owner" | "admin" | "member";
  status?: string;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  type: string;
  app?: { id: string; name: string } | null;
}

interface PermissionsResponse {
  framework: Permission[];
  app: Permission[];
  all: Permission[];
}

interface UserPermission {
  key: string;
  label: string;
  type: string;
  permissionId?: string;
}

const roleMap: Record<string, { label: string; variant: "info" | "warning" | "default" }> = {
  owner: { label: "平台管理员", variant: "info" },
  admin: { label: "租户管理员", variant: "warning" },
  member: { label: "成员", variant: "default" },
};

export default function PermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userPermissionIds, setUserPermissionIds] = useState<Set<string>>(new Set());
  const [permLoading, setPermLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      const [usersRes, permsRes] = await Promise.all([
        api.get<{ success: boolean; data: User[] }>("/api/users"),
        api.get<{ success: boolean; data: PermissionsResponse }>("/api/permissions"),
      ]);
      setUsers(usersRes.data || []);
      setAllPermissions(permsRes.data);
    } catch {
      setError("没加载出来，刷新试试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const loadUserPermissions = useCallback(async (userId: string) => {
    setPermLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: { permissions: UserPermission[] } }>(
        `/api/users/${userId}`
      );
      // 用 permissionId 做匹配（如果有的话），否则用 key
      const permIds = new Set((res.data.permissions || []).map((p) => p.permissionId || p.key));
      setUserPermissionIds(permIds);
    } catch {
      setUserPermissionIds(new Set());
    } finally {
      setPermLoading(false);
    }
  }, []);

  const handleSelectUser = useCallback(
    (userId: string) => {
      setSelectedUserId(userId);
      loadUserPermissions(userId);
    },
    [loadUserPermissions]
  );

  const handleTogglePermission = useCallback(
    async (perm: Permission) => {
      if (!selectedUserId) return;
      const hasPermission = userPermissionIds.has(perm.id);
      setToggling(perm.id);
      try {
        await api.post("/api/permissions/assign", {
          permissionId: perm.id,
          userId: selectedUserId,
          action: hasPermission ? "revoke" : "grant",
        });
        setUserPermissionIds((prev) => {
          const next = new Set(prev);
          if (hasPermission) {
            next.delete(perm.id);
          } else {
            next.add(perm.id);
          }
          return next;
        });
      } catch (err: unknown) {
        const apiErr = err as { error?: string };
        setError(apiErr.error || "操作失败");
      } finally {
        setToggling(null);
      }
    },
    [selectedUserId, userPermissionIds]
  );

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const frameworkPermissions = allPermissions?.framework || [];
  const appPermissions = allPermissions?.app || [];

  // 按应用分组应用权限
  const appPermGroups = new Map<string, Permission[]>();
  for (const p of appPermissions) {
    const appName = p.app?.name || "未分类";
    if (!appPermGroups.has(appName)) appPermGroups.set(appName, []);
    appPermGroups.get(appName)!.push(p);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#333]">权限管理</h1>
        <p className="text-sm text-gray-400 mt-1">选择用户，管理其框架权限和应用权限</p>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#333]">用户列表</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>邮箱</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead className="w-16">选择</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow
                key={u.id}
                className={`cursor-pointer ${selectedUserId === u.id ? "bg-[#1a1a2e]/5" : ""}`}
                onClick={() => handleSelectUser(u.id)}
              >
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant={roleMap[u.role || "member"]?.variant || "default"}>
                    {roleMap[u.role || "member"]?.label || u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedUserId === u.id
                        ? "border-[#1a1a2e] bg-[#1a1a2e]"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedUserId === u.id && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 权限分配面板 */}
      {selectedUserId && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#333]">
              {selectedUser?.name || selectedUser?.email} 的权限
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedUserId(null)}
            >
              关闭
            </Button>
          </div>

          {permLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* 框架权限 */}
              <PermGroup
                title="框架权限"
                permissions={frameworkPermissions}
                userPermissionIds={userPermissionIds}
                toggling={toggling}
                onToggle={handleTogglePermission}
                emptyText="当前租户没有可用的框架权限"
              />

              {/* 应用权限 — 按应用分组 */}
              {appPermGroups.size > 0 ? (
                Array.from(appPermGroups.entries()).map(([appName, perms]) => (
                  <PermGroup
                    key={appName}
                    title={`${appName} — 应用权限`}
                    permissions={perms}
                    userPermissionIds={userPermissionIds}
                    toggling={toggling}
                    onToggle={handleTogglePermission}
                  />
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 text-sm">还没有应用权限</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 权限分组组件 */
function PermGroup({
  title,
  permissions,
  userPermissionIds,
  toggling,
  onToggle,
  emptyText,
}: {
  title: string;
  permissions: Permission[];
  userPermissionIds: Set<string>;
  toggling: string | null;
  onToggle: (perm: Permission) => void;
  emptyText?: string;
}) {
  if (permissions.length === 0) {
    return (
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</h3>
        <p className="text-sm text-gray-400">{emptyText || "暂无权限"}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">勾选</TableHead>
            <TableHead>权限标识</TableHead>
            <TableHead>名称</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissions.map((perm) => {
            const hasPermission = userPermissionIds.has(perm.id);
            return (
              <TableRow key={perm.id}>
                <TableCell>
                  <button
                    onClick={() => onToggle(perm)}
                    disabled={toggling === perm.id}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      hasPermission
                        ? "border-[#1a1a2e] bg-[#1a1a2e]"
                        : "border-gray-300 hover:border-gray-400"
                    } ${toggling === perm.id ? "opacity-50" : ""}`}
                  >
                    {hasPermission && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </TableCell>
                <TableCell className="font-mono text-sm">{perm.key}</TableCell>
                <TableCell>{perm.label}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
