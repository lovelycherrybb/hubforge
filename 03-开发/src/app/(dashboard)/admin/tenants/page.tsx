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
  status: "active" | "inactive";
  _count?: { users: number };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
    const newStatus = tenant.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/api/tenants/${tenant.id}/status`, { status: newStatus });
      fetchTenants();
    } catch {
      setError("操作没成功，再试一次？");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#333]">租户管理</h1>
        <Button onClick={() => setShowCreate(true)}>+ 新建租户</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
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
                <TableHead>状态</TableHead>
                <TableHead>用户数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "success" : "danger"}>
                      {t.status === "active" ? "正常" : "已停用"}
                    </Badge>
                  </TableCell>
                  <TableCell>{t._count?.users ?? 0}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={t.status === "active" ? "danger" : "primary"}
                      onClick={() => toggleStatus(t)}
                    >
                      {t.status === "active" ? "停掉" : "开起来"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="新建租户"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              不了
            </Button>
            <Button loading={creating} onClick={handleCreate}>
              创建
            </Button>
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
    </div>
  );
}
