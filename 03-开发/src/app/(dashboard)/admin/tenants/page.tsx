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

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 租户操作面板
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "apps" | "danger">("info");

  // 应用配置
  const [allApps, setAllApps] = useState<App[]>([]);
  const [tenantApps, setTenantApps] = useState<TenantApp[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appFilter, setAppFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [configLoading, setConfigLoading] = useState(false);

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
    setAppSearch("");
    setAppFilter("all");
    await loadApps(tenant.id);
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

  // 分配/取消/切换
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

  // 停用/启用租户
  const toggleTenantStatus = async () => {
    if (!activeTenant) return;
    const newStatus = activeTenant.status === "active" ? "suspended" : "active";
    await api.put(`/api/tenants/${activeTenant.id}/status`, { status: newStatus });
    fetchTenants();
    setActiveTenant({ ...activeTenant, status: newStatus });
  };

  // 应用筛选逻辑
  const assignedAppIds = new Set(tenantApps.map((ta) => ta.appId));
  const filteredApps = allApps.filter((app) => {
    // 搜索
    if (appSearch) {
      const q = appSearch.toLowerCase();
      if (!app.name.toLowerCase().includes(q) && !app.slug.toLowerCase().includes(q)) {
        return false;
      }
    }
    // 筛选
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
                      管理 →
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ===== 租户操作面板（全屏大框） ===== */}
      {activeTenant && (
        <div className="fixed inset-0 z-50 flex">
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveTenant(null)} />
          {/* 面板 */}
          <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in">
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

            {/* Tab 导航 */}
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setActiveTab("info")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "info"
                    ? "border-[#1a1a2e] text-[#1a1a2e]"
                    : "border-transparent text-gray-500 hover:text-[#333]"
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setActiveTab("apps")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "apps"
                    ? "border-[#1a1a2e] text-[#1a1a2e]"
                    : "border-transparent text-gray-500 hover:text-[#333]"
                }`}
              >
                应用配置
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {assignedCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("danger")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "danger"
                    ? "border-[#e94560] text-[#e94560]"
                    : "border-transparent text-gray-500 hover:text-[#333]"
                }`}
              >
                危险操作
              </button>
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 基本信息 */}
              {activeTab === "info" && (
                <div className="space-y-4">
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
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">用户配额</span>
                      <span className="text-sm">{activeTenant.quotaUsers}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">应用配额</span>
                      <span className="text-sm">{activeTenant.quotaApps}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 应用配置 */}
              {activeTab === "apps" && (
                <div className="space-y-4">
                  {/* 搜索和筛选 */}
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
                            <div className="flex items-center gap-3 min-w-0">
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
                                <Button size="sm" onClick={() => assignApp(app.id)}>
                                  分配
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 危险操作 */}
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

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
