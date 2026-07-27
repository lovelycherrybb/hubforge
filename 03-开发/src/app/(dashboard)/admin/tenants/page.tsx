"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
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

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  quotaUsers: number;
  quotaApps: number;
  quotaOrgLevels: number;
  _count?: { users: number; tenantApps: number };
}

interface App {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
  status: string;
}

interface TenantApp {
  id: string;
  appId: string;
  enabled: boolean;
  app: App;
}

interface TenantUser {
  id: string;
  email: string;
  name: string;
  status: string;
  isGlobalAdmin: boolean;
  department?: { id: string; name: string } | null;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 租户操作面板
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "users" | "apps" | "danger">("info");

  // 应用配置
  const [allApps, setAllApps] = useState<App[]>([]);
  const [tenantApps, setTenantApps] = useState<TenantApp[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appFilter, setAppFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [configLoading, setConfigLoading] = useState(false);

  // 用户管理
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "" });
  const [addingUser, setAddingUser] = useState(false);

  // 密码重置
  const [resetUser, setResetUser] = useState<TenantUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // 配额编辑
  const [editingQuota, setEditingQuota] = useState(false);
  const [quotaForm, setQuotaForm] = useState({ quotaUsers: 100, quotaApps: 50, quotaOrgLevels: 5 });

  const fetchTenants = async () => {
    try {
      const res = await api.get<{ success: boolean; data: Tenant[] }>("/api/tenants");
      setTenants(res.data || []);
    } catch {
      setError("没加载出来，刷新试试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  // 打开租户操作面板
  const openTenant = async (tenant: Tenant) => {
    setActiveTenant(tenant);
    setActiveTab("info");
    setEditingQuota(false);
    setQuotaForm({ quotaUsers: tenant.quotaUsers, quotaApps: tenant.quotaApps, quotaOrgLevels: tenant.quotaOrgLevels });
    setAppSearch("");
    setAppFilter("all");
    setShowAddUser(false);
    await Promise.all([loadApps(tenant.id), loadUsers(tenant.id)]);
  };

  const loadApps = async (tenantId: string) => {
    setConfigLoading(true);
    try {
      const [appsRes, tenantAppsRes] = await Promise.all([
        api.get<{ success: boolean; data: App[] }>("/api/apps"),
        api.get<{ success: boolean; data: TenantApp[] }>(`/api/tenants/${tenantId}/apps`),
      ]);
      setAllApps(appsRes.data || []);
      setTenantApps(tenantAppsRes.data || []);
    } catch {
      setError("加载应用数据失败");
    } finally {
      setConfigLoading(false);
    }
  };

  const loadUsers = async (tenantId: string) => {
    setUsersLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: TenantUser[] }>(`/api/tenants/${tenantId}/users`);
      setTenantUsers(res.data || []);
    } catch {
      setError("加载用户数据失败");
    } finally {
      setUsersLoading(false);
    }
  };

  // 保存配额
  const saveQuota = async () => {
    if (!activeTenant) return;
    try {
      await api.put(`/api/tenants/${activeTenant.id}`, quotaForm);
      const updated = { ...activeTenant, ...quotaForm };
      setActiveTenant(updated);
      setEditingQuota(false);
      fetchTenants();
    } catch {
      setError("保存配额失败");
    }
  };

  // 添加用户
  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setAddingUser(true);
    try {
      await api.post(`/api/tenants/${activeTenant.id}/users`, newUser);
      setShowAddUser(false);
      setNewUser({ email: "", name: "", password: "" });
      loadUsers(activeTenant.id);
      fetchTenants();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "添加用户失败");
    } finally {
      setAddingUser(false);
    }
  };

  // 设置/取消租户管理员
  const toggleAdmin = async (user: TenantUser) => {
    if (!activeTenant) return;
    try {
      await api.put(`/api/tenants/${activeTenant.id}/users/${user.id}`, {
        isGlobalAdmin: !user.isGlobalAdmin,
      });
      loadUsers(activeTenant.id);
    } catch {
      setError("操作失败");
    }
  };

  // 打开密码重置弹窗
  const openResetPassword = (user: TenantUser) => {
    setResetUser(user);
    setResetPassword("");
    setResetSuccess(false);
  };

  // 执行密码重置
  const handleResetPassword = async () => {
    if (!activeTenant || !resetUser) return;
    setResetting(true);
    try {
      const body: { password?: string } = {};
      if (resetPassword) body.password = resetPassword;
      await api.post(`/api/tenants/${activeTenant.id}/users/${resetUser.id}/reset-password`, body);
      setResetSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "重置失败");
    } finally {
      setResetting(false);
    }
  };

  // 应用分配/取消
  const assignApp = async (appId: string) => {
    if (!activeTenant) return;
    await api.post(`/api/tenants/${activeTenant.id}/apps`, { appId, enabled: true });
    await loadApps(activeTenant.id);
    fetchTenants();
  };

  const unassignApp = async (appId: string) => {
    if (!activeTenant) return;
    await api.delete(`/api/tenants/${activeTenant.id}/apps?appId=${appId}`);
    await loadApps(activeTenant.id);
    fetchTenants();
  };

  const toggleAppEnabled = async (tenantApp: TenantApp) => {
    if (!activeTenant) return;
    await api.post(`/api/tenants/${activeTenant.id}/apps`, {
      appId: tenantApp.appId,
      enabled: !tenantApp.enabled,
    });
    await loadApps(activeTenant.id);
  };

  // 租户停用/启用
  const toggleTenantStatus = async () => {
    if (!activeTenant) return;
    const newStatus = activeTenant.status === "active" ? "suspended" : "active";
    await api.put(`/api/tenants/${activeTenant.id}/status`, { status: newStatus });
    fetchTenants();
    setActiveTenant({ ...activeTenant, status: newStatus });
  };

  // 应用筛选
  const assignedAppIds = new Set(tenantApps.map((ta) => ta.appId));
  const filteredApps = allApps.filter((app) => {
    if (appSearch) {
      const q = appSearch.toLowerCase();
      if (!app.name.toLowerCase().includes(q) && !app.slug.toLowerCase().includes(q)) return false;
    }
    if (appFilter === "assigned") return assignedAppIds.has(app.id);
    if (appFilter === "unassigned") return !assignedAppIds.has(app.id);
    return true;
  });

  const assignedCount = tenantApps.length;
  const unassignedCount = allApps.length - assignedCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#333]">租户管理</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="underline text-xs">关闭</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg text-[#555]">还没有租户</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-gray-400 text-sm font-mono">{t.slug}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "success" : "danger"}>
                      {t.status === "active" ? "正常" : "已停用"}
                    </Badge>
                  </TableCell>
                  <TableCell>{t._count?.users ?? 0}</TableCell>
                  <TableCell>{t._count?.tenantApps ?? 0}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openTenant(t)}>
                      管理
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ===== 租户操作面板 ===== */}
      {activeTenant && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveTenant(null)} />
          <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col">
            {/* 顶栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-[#333]">{activeTenant.name}</h2>
                <span className="text-xs text-gray-400 font-mono">{activeTenant.slug}</span>
              </div>
              <button
                onClick={() => setActiveTenant(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab */}
            <div className="flex border-b border-gray-200 px-6">
              {(["info", "users", "apps", "danger"] as const).map((tab) => {
                const labels = { info: "基本信息", users: "用户管理", apps: "应用配置", danger: "危险操作" };
                const counts = { info: "", users: `${tenantUsers.length}`, apps: `${assignedCount}`, danger: "" };
                const isDanger = tab === "danger";
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? isDanger ? "border-[#e94560] text-[#e94560]" : "border-[#1a1a2e] text-[#1a1a2e]"
                        : "border-transparent text-gray-500 hover:text-[#333]"
                    }`}
                  >
                    {labels[tab]}
                    {counts[tab] && (
                      <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {counts[tab]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ===== 基本信息 ===== */}
              {activeTab === "info" && (
                <div className="space-y-6">
                  {/* 统计卡片 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-[#1a1a2e]">{activeTenant._count?.users ?? 0}</div>
                      <div className="text-sm text-gray-500">用户数</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-[#1a1a2e]">{activeTenant._count?.tenantApps ?? 0}</div>
                      <div className="text-sm text-gray-500">已分配应用</div>
                    </div>
                  </div>

                  {/* 基本信息 */}
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">租户标识</span>
                      <span className="text-sm font-mono">{activeTenant.slug}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">状态</span>
                      <Badge variant={activeTenant.status === "active" ? "success" : "danger"}>
                        {activeTenant.status === "active" ? "正常" : "已停用"}
                      </Badge>
                    </div>
                  </div>

                  {/* 配额 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-[#333]">配额设置</h3>
                      {!editingQuota && (
                        <Button size="sm" variant="ghost" onClick={() => setEditingQuota(true)}>
                          编辑
                        </Button>
                      )}
                    </div>

                    {editingQuota ? (
                      <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                        <Input
                          label="用户上限"
                          type="number"
                          value={String(quotaForm.quotaUsers)}
                          onChange={(e) => setQuotaForm({ ...quotaForm, quotaUsers: Number(e.target.value) })}
                        />
                        <Input
                          label="应用上限"
                          type="number"
                          value={String(quotaForm.quotaApps)}
                          onChange={(e) => setQuotaForm({ ...quotaForm, quotaApps: Number(e.target.value) })}
                        />
                        <Input
                          label="组织层级上限"
                          type="number"
                          value={String(quotaForm.quotaOrgLevels)}
                          onChange={(e) => setQuotaForm({ ...quotaForm, quotaOrgLevels: Number(e.target.value) })}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveQuota}>保存</Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingQuota(false)}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-500">用户上限</span>
                          <span className="text-sm">{activeTenant.quotaUsers}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-500">应用上限</span>
                          <span className="text-sm">{activeTenant.quotaApps}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-500">组织层级上限</span>
                          <span className="text-sm">{activeTenant.quotaOrgLevels}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== 用户管理 ===== */}
              {activeTab === "users" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#333]">租户用户</h3>
                    <Button size="sm" onClick={() => setShowAddUser(true)}>+ 添加用户</Button>
                  </div>

                  {usersLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
                    </div>
                  ) : tenantUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">还没有用户</p>
                      <p className="text-xs mt-1">点击上方按钮添加第一个用户</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tenantUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{user.name || user.email}</span>
                              {user.isGlobalAdmin && (
                                <Badge variant="info">管理员</Badge>
                              )}
                              <Badge variant={user.status === "active" ? "success" : "danger"}>
                                {user.status === "active" ? "正常" : user.status === "invited" ? "待激活" : "已锁定"}
                              </Badge>
                            </div>
                            {user.name && (
                              <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                            )}
                            {user.department && (
                              <p className="text-xs text-gray-400">部门：{user.department.name}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openResetPassword(user)}
                            >
                              重置密码
                            </Button>
                            <Button
                              size="sm"
                              variant={user.isGlobalAdmin ? "danger" : "ghost"}
                              onClick={() => toggleAdmin(user)}
                            >
                              {user.isGlobalAdmin ? "取消管理员" : "设为管理员"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 添加用户表单 */}
                  {showAddUser && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-[#333] mb-3">添加新用户</h4>
                      <form onSubmit={handleAddUser} className="space-y-3">
                        <Input
                          label="邮箱"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="user@company.com"
                          required
                        />
                        <Input
                          label="姓名"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          placeholder="张三"
                          required
                        />
                        <Input
                          label="初始密码"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="至少8位，含大小写和数字"
                          required
                        />
                        <div className="flex gap-2">
                          <Button size="sm" loading={addingUser} type="submit">添加</Button>
                          <Button size="sm" variant="secondary" onClick={() => setShowAddUser(false)}>取消</Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* ===== 应用配置 ===== */}
              {activeTab === "apps" && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="搜索应用名称..."
                        value={appSearch}
                        onChange={(e) => setAppSearch(e.target.value)}
                      />
                    </div>
                    <select
                      value={appFilter}
                      onChange={(e) => setAppFilter(e.target.value as "all" | "assigned" | "unassigned")}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      <option value="all">全部 ({allApps.length})</option>
                      <option value="assigned">已分配 ({assignedCount})</option>
                      <option value="unassigned">未分配 ({unassignedCount})</option>
                    </select>
                  </div>

                  {configLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
                    </div>
                  ) : filteredApps.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {allApps.length === 0 ? "还没有可分配的应用" : "没有匹配的应用"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredApps.map((app) => {
                        const isAssigned = assignedAppIds.has(app.id);
                        const tenantApp = tenantApps.find((ta) => ta.appId === app.id);
                        return (
                          <div
                            key={app.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isAssigned ? "bg-[#1a1a2e]/5 border-[#1a1a2e]/20" : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{app.name}</span>
                                <Badge variant={app.type === "h5" ? "warning" : "default"}>
                                  {app.type.toUpperCase()}
                                </Badge>
                                {isAssigned && tenantApp && (
                                  <Badge variant={tenantApp.enabled ? "success" : "danger"}>
                                    {tenantApp.enabled ? "启用" : "停用"}
                                  </Badge>
                                )}
                              </div>
                              {app.description && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{app.description}</p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0 ml-3">
                              {isAssigned ? (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => tenantApp && toggleAppEnabled(tenantApp)}>
                                    {tenantApp?.enabled ? "停用" : "启用"}
                                  </Button>
                                  <Button size="sm" variant="danger" onClick={() => unassignApp(app.id)}>
                                    移除
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" onClick={() => assignApp(app.id)}>分配</Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ===== 危险操作 ===== */}
              {activeTab === "danger" && (
                <div className="space-y-4">
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <h3 className="text-sm font-medium text-orange-800 mb-1">停用租户</h3>
                    <p className="text-sm text-orange-600 mb-3">
                      停用后该租户所有用户将无法登录，应用不可访问。数据不会删除。
                    </p>
                    <Button
                      variant={activeTenant.status === "active" ? "danger" : "primary"}
                      onClick={toggleTenantStatus}
                    >
                      {activeTenant.status === "active" ? "停用租户" : "启用租户"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ===== 密码重置弹窗 ===== */}
      {resetUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResetUser(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            {resetSuccess ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#333] mb-2">密码已重置</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {resetUser.name || resetUser.email} 的密码已重置为：
                </p>
                <div className="p-3 bg-gray-100 rounded-lg font-mono text-lg text-center mb-4">
                  {resetPassword || "1234Aa78"}
                </div>
                <Button onClick={() => setResetUser(null)}>完成</Button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-[#333] mb-1">重置密码</h3>
                <p className="text-sm text-gray-500 mb-4">
                  为 <span className="font-medium">{resetUser.name || resetUser.email}</span> 重置密码
                </p>
                <div className="space-y-4">
                  <Input
                    label="新密码（留空则使用默认密码）"
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="默认：1234Aa78"
                  />
                  <p className="text-xs text-gray-400">
                    默认密码：1234Aa78（8位，含大小写和数字）
                  </p>
                  <div className="flex gap-2">
                    <Button loading={resetting} onClick={handleResetPassword}>
                      确认重置
                    </Button>
                    <Button variant="secondary" onClick={() => setResetUser(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
