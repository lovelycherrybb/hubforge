"use client";

import { useState, useEffect, FormEvent } from "react";
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

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  _count?: { users: number; tenantApps: number };
}

interface App {
  id: string;
  name: string;
  slug: string;
  type: string;
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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // 应用配置相关
  const [configTenant, setConfigTenant] = useState<Tenant | null>(null);
  const [allApps, setAllApps] = useState<App[]>([]);
  const [tenantApps, setTenantApps] = useState<TenantApp[]>([]);
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

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/api/tenants", { name: newName });
      setShowCreate(false);
      setNewName("");
      fetchTenants();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "没创建成功，再试一次？");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    try {
      await api.put(`/api/tenants/${tenant.id}/status`, { status: newStatus });
      fetchTenants();
    } catch {
      setError("操作没成功，再试一次？");
    }
  };

  // 打开应用配置弹窗
  const openAppConfig = async (tenant: Tenant) => {
    setConfigTenant(tenant);
    setConfigLoading(true);
    try {
      const [appsRes, tenantAppsRes] = await Promise.all([
        api.get<{ success: boolean; data: App[] }>("/api/apps"),
        api.get<{ success: boolean; data: TenantApp[] }>(`/api/tenants/${tenant.id}/apps`),
      ]);
      setAllApps(appsRes.data || []);
      setTenantApps(tenantAppsRes.data || []);
    } catch {
      setError("加载应用数据失败");
    } finally {
      setConfigLoading(false);
    }
  };

  // 分配应用给租户
  const assignApp = async (appId: string) => {
    if (!configTenant) return;
    try {
      await api.post(`/api/tenants/${configTenant.id}/apps`, { appId, enabled: true });
      // 刷新
      const res = await api.get<{ success: boolean; data: TenantApp[] }>(`/api/tenants/${configTenant.id}/apps`);
      setTenantApps(res.data || []);
      fetchTenants();
    } catch {
      setError("分配失败");
    }
  };

  // 取消分配
  const unassignApp = async (appId: string) => {
    if (!configTenant) return;
    try {
      await api.delete(`/api/tenants/${configTenant.id}/apps?appId=${appId}`);
      const res = await api.get<{ success: boolean; data: TenantApp[] }>(`/api/tenants/${configTenant.id}/apps`);
      setTenantApps(res.data || []);
      fetchTenants();
    } catch {
      setError("取消失败");
    }
  };

  // 切换启用/停用
  const toggleAppEnabled = async (tenantApp: TenantApp) => {
    if (!configTenant) return;
    try {
      await api.post(`/api/tenants/${configTenant.id}/apps`, {
        appId: tenantApp.appId,
        enabled: !tenantApp.enabled,
      });
      const res = await api.get<{ success: boolean; data: TenantApp[] }>(`/api/tenants/${configTenant.id}/apps`);
      setTenantApps(res.data || []);
    } catch {
      setError("操作失败");
    }
  };

  const assignedAppIds = new Set(tenantApps.map((ta) => ta.appId));
  const unassignedApps = allApps.filter((a) => !assignedAppIds.has(a.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#333]">租户管理</h1>
        <Button onClick={() => setShowCreate(true)}>+ 新建租户</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">关闭</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg text-[#555]">还没有租户</p>
          <p className="text-sm mt-1">点上面的按钮创建第一个租户</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>用户数</TableHead>
                <TableHead>应用数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-gray-400 text-sm">{t.slug}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "success" : "danger"}>
                      {t.status === "active" ? "正常" : "已停用"}
                    </Badge>
                  </TableCell>
                  <TableCell>{t._count?.users ?? 0}</TableCell>
                  <TableCell>{t._count?.tenantApps ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openAppConfig(t)}>
                        配置应用
                      </Button>
                      <Button
                        size="sm"
                        variant={t.status === "active" ? "danger" : "primary"}
                        onClick={() => toggleStatus(t)}
                      >
                        {t.status === "active" ? "停掉" : "开起来"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 新建租户弹窗 */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="新建租户"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
            <Button loading={creating} onClick={handleCreate}>创建</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="租户名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="给租户起个名字"
            required
          />
        </form>
      </Modal>

      {/* 配置应用弹窗 */}
      <Modal
        open={!!configTenant}
        onClose={() => setConfigTenant(null)}
        title={`配置应用 — ${configTenant?.name || ""}`}
      >
        {configLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 已分配的应用 */}
            <div>
              <h3 className="text-sm font-medium text-[#333] mb-2">已分配的应用</h3>
              {tenantApps.length === 0 ? (
                <p className="text-sm text-gray-400">还没有分配应用</p>
              ) : (
                <div className="space-y-2">
                  {tenantApps.map((ta) => (
                    <div key={ta.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{ta.app.name}</span>
                        <Badge variant={ta.app.type === "h5" ? "warning" : "default"}>
                          {ta.app.type.toUpperCase()}
                        </Badge>
                        <Badge variant={ta.enabled ? "success" : "danger"}>
                          {ta.enabled ? "启用" : "停用"}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleAppEnabled(ta)}>
                          {ta.enabled ? "停用" : "启用"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => unassignApp(ta.appId)}>
                          移除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 可分配的应用 */}
            {unassignedApps.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#333] mb-2">可分配的应用</h3>
                <div className="space-y-2">
                  {unassignedApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{app.name}</span>
                        <Badge variant={app.type === "h5" ? "warning" : "default"}>
                          {app.type.toUpperCase()}
                        </Badge>
                      </div>
                      <Button size="sm" onClick={() => assignApp(app.id)}>
                        分配
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allApps.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                还没有可分配的应用，请先在应用管理中创建
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
