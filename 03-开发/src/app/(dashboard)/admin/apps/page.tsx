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

interface App {
  id: string;
  name: string;
  slug: string;
  url: string;
  type: "PC" | "H5" | "both";
  status: "active" | "inactive";
  permissions?: string[];
}

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    url: "",
    type: "PC" as "PC" | "H5" | "both",
    permissions: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
      setForm({ name: "", slug: "", url: "", type: "PC", permissions: "" });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#333]">应用管理</h1>
        <Button onClick={() => setShowCreate(true)}>+ 注册新应用</Button>
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
      ) : apps.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg text-[#555]">还没有应用</p>
          <p className="text-sm mt-1">点上面的按钮注册第一个应用吧</p>
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
                <TableRow key={app.id}>
                  <TableCell className="font-medium">{app.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {app.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    {app.type === "PC" && <Badge variant="pc">PC</Badge>}
                    {app.type === "H5" && <Badge variant="h5">H5</Badge>}
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
                    <Button
                      size="sm"
                      variant={app.status === "active" ? "danger" : "primary"}
                      onClick={() => toggleStatus(app)}
                    >
                      {app.status === "active" ? "停掉" : "开起来"}
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
        title="注册新应用"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              不了
            </Button>
            <Button loading={creating} onClick={handleCreate}>
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
                setForm({ ...form, type: e.target.value as "PC" | "H5" | "both" })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] focus:border-[#1a1a2e]"
            >
              <option value="PC">PC</option>
              <option value="H5">H5</option>
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
