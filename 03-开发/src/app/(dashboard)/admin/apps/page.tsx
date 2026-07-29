"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/Badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/Table";
import { api } from "@/lib/api";

interface App {
  id: string;
  name: string;
  slug: string;
  url: string;
  type: "pc" | "h5" | "both";
  status: "active" | "inactive";
  description?: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  type: string;
}

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    url: "",
    type: "pc" as "pc" | "h5" | "both",
    permissions: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("");

  // 侧边面板状态
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [panelTab, setPanelTab] = useState<"users" | "info">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [frameworkPerms, setFrameworkPerms] = useState<Permission[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [panelLoading, setPanelLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      const res = await api.get<{ success: boolean; data: App[] }>("/api/apps");
      setApps(res.data || []);
    } catch {
      setError("没加载出来，刷新试试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    // 获取当前用户角色
    api.get<{ success: boolean; data: { role?: string } }>("/api/auth/me").then((res) => {
      setRole(res.data.role || "");
    }).catch(() => {});
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/api/apps", {
        ...form,
        permissions: form.permissions
          ? form.permissions.split(",").map((s) => s.trim())
          : [],
      });
      setShowCreate(false);
      setForm({ name: "", slug: "", url: "", type: "pc", permissions: "" });
      fetchApps();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "没创建成功，再试一次？");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (app: App) => {
    const newStatus = app.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/api/apps/${app.id}`, { status: newStatus });
      fetchApps();
    } catch {
      setError("操作没成功，再试一次？");
    }
  };

  // 打开应用侧边面板
  const openPanel = useCallback(async (app: App) => {
    setSelectedApp(app);
    setPanelTab("users");
    setPanelLoading(true);
    try {
      const [usersRes, permsRes] = await Promise.all([
        api.get<{ success: boolean; data: User[] }>("/api/users"),
        api.get<{ success: boolean; data: { framework: Permission[] } }>("/api/permissions"),
      ]);
      setUsers(usersRes.data || []);
      setFrameworkPerms(permsRes.data.framework || []);
    } catch {
      setError("加载面板数据失败");
    } finally {
      setPanelLoading(false);
    }
  }, []);

  // 加载已分配用户（查哪些用户有 app.<slug>.access 权限）
  const loadAssignedUsers = useCallback(
    async (app: App) => {
      const accessKey = `app.${app.slug}.access`;
      const perm = frameworkPerms.find((p) => p.key === accessKey);
      if (!perm) {
        setAssignedUserIds(new Set());
        return;
      }
      // 逐个查用户权限（效率不高但简单可靠）
      const assigned = new Set<string>();
      await Promise.all(
        users.map(async (u) => {
          try {
            const res = await api.get<{ success: boolean; data: { permissions: { permissionId?: string; key: string }[] } }>(
              `/api/users/${u.id}`
            );
            const hasAccess = res.data.permissions.some(
              (p) => p.permissionId === perm.id || p.key === accessKey
            );
            if (hasAccess) assigned.add(u.id);
          } catch {
            // skip
          }
        })
      );
      setAssignedUserIds(assigned);
    },
    [users, frameworkPerms]
  );

  // 当用户列表和权限都加载完后，查询已分配用户
  useEffect(() => {
    if (selectedApp && users.length > 0 && frameworkPerms.length > 0) {
      loadAssignedUsers(selectedApp);
    }
  }, [selectedApp, users, frameworkPerms, loadAssignedUsers]);

  // 切换用户分配
  const handleToggleUser = useCallback(
    async (userId: string) => {
      if (!selectedApp) return;
      const accessKey = `app.${selectedApp.slug}.access`;
      const perm = frameworkPerms.find((p) => p.key === accessKey);
      if (!perm) {
        setError(`找不到权限 ${accessKey}，请先注册应用`);
        return;
      }
      const isAssigned = assignedUserIds.has(userId);
      setToggling(userId);
      try {
        await api.post("/api/permissions/assign", {
          permissionId: perm.id,
          userId,
          action: isAssigned ? "revoke" : "grant",
        });
        setAssignedUserIds((prev) => {
          const next = new Set(prev);
          if (isAssigned) {
            next.delete(userId);
          } else {
            next.add(userId);
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
    [selectedApp, frameworkPerms, assignedUserIds]
  );

  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="flex gap-6">
      {/* 主内容区 */}
      <div className={`flex-1 ${selectedApp ? "pr-0" : ""}`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#333]">应用管理</h1>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)}>+ 注册新应用</Button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-[#e94560] font-bold">×</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg text-[#555]">还没有应用</p>
            <p className="text-sm mt-1">
              {isAdmin ? "点上面的按钮注册第一个应用吧" : "暂无可用应用"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow
                    key={app.id}
                    className={`cursor-pointer ${selectedApp?.id === app.id ? "bg-[#1a1a2e]/5" : ""}`}
                    onClick={() => openPanel(app)}
                  >
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {app.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      {app.type === "pc" && <Badge variant="pc">PC</Badge>}
                      {app.type === "h5" && <Badge variant="h5">H5</Badge>}
                      {app.type === "both" && (
                        <div className="flex gap-1">
                          <Badge variant="pc">PC</Badge>
                          <Badge variant="h5">H5</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-500 text-xs">
                      {app.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant={app.status === "active" ? "success" : "danger"}>
                        {app.status === "active" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant={app.status === "active" ? "danger" : "primary"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(app);
                          }}
                        >
                          {app.status === "active" ? "停掉" : "开起来"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 侧边面板 */}
      {selectedApp && (
        <div className="w-96 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#333]">{selectedApp.name}</h2>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ×
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="flex border-b border-gray-100">
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  panelTab === "users"
                    ? "text-[#1a1a2e] border-b-2 border-[#1a1a2e]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                onClick={() => setPanelTab("users")}
              >
                用户分配
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  panelTab === "info"
                    ? "text-[#1a1a2e] border-b-2 border-[#1a1a2e]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                onClick={() => setPanelTab("info")}
              >
                应用信息
              </button>
            </div>

            {panelLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
              </div>
            ) : panelTab === "users" ? (
              <div className="max-h-[60vh] overflow-y-auto">
                {users.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">暂无用户</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {users.map((u) => {
                      const isAssigned = assignedUserIds.has(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                        >
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            disabled={toggling === u.id || !isAdmin}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              isAssigned
                                ? "border-[#1a1a2e] bg-[#1a1a2e]"
                                : "border-gray-300 hover:border-gray-400"
                            } ${toggling === u.id ? "opacity-50" : ""} ${!isAdmin ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            {isAssigned && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#333] truncate">
                              {u.name || u.email}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-4 space-y-3">
                <InfoRow label="名称" value={selectedApp.name} />
                <InfoRow label="Slug" value={selectedApp.slug} mono />
                <InfoRow label="URL" value={selectedApp.url} mono />
                <InfoRow label="类型" value={selectedApp.type.toUpperCase()} />
                <InfoRow
                  label="状态"
                  value={selectedApp.status === "active" ? "启用" : "停用"}
                />
                {selectedApp.description && (
                  <InfoRow label="描述" value={selectedApp.description} />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="注册新应用"
        size="lg"
        formId="create-app-form"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              不了
            </Button>
            <Button type="submit" form="create-app-form" loading={creating}>
              注册
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="应用名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="My App"
            required
          />
          <Input
            label="Slug（URL 标识）"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="my-app"
            required
          />
          <Input
            label="应用 URL"
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://app.example.com"
            required
          />
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">
              应用类型
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as "pc" | "h5" | "both" })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] focus:border-[#1a1a2e]"
            >
              <option value="pc">PC</option>
              <option value="h5">H5</option>
              <option value="both">PC + H5</option>
            </select>
          </div>
          <Input
            label="权限声明（逗号分隔）"
            value={form.permissions}
            onChange={(e) => setForm({ ...form, permissions: e.target.value })}
            placeholder="app:read, app:write"
          />
        </form>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm text-[#333] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
