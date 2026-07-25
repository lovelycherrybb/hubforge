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

interface User {
  id: string;
  email: string;
  name?: string;
  status: "active" | "inactive" | "locked";
  department?: { name: string };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await api.get<{ success: boolean; data: User[] }>("/api/users");
      setUsers(res.data || []);
    } catch {
      setError("没加载出来，刷新试试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/api/users", form);
      setShowCreate(false);
      setForm({ email: "", name: "", password: "" });
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "没创建成功，再试一次？");
    } finally {
      setCreating(false);
    }
  };

  const statusMap: Record<string, { label: string; variant: "success" | "danger" | "warning" }> = {
    active: { label: "正常", variant: "success" },
    inactive: { label: "未激活", variant: "warning" },
    locked: { label: "已锁定", variant: "danger" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#333]">用户管理</h1>
        <Button onClick={() => setShowCreate(true)}>+ 添加用户</Button>
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
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg text-[#555]">还没有用户</p>
          <p className="text-sm mt-1">点上面的按钮添加第一个用户</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[u.status]?.variant || "default"}>
                      {statusMap[u.status]?.label || u.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.department?.name || "-"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" disabled title="编辑功能开发中">
                      改一下
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
        title="添加用户"
        formId="create-user-form"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              不了
            </Button>
            <Button type="submit" form="create-user-form" loading={creating}>
              添加
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="邮箱"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="user@example.com"
            required
          />
          <Input
            label="姓名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="填一下就行"
          />
          <Input
            label="初始密码"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="8位以上，含大小写字母和数字"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            密码要求：至少8位，包含大写字母、小写字母和数字
          </p>
        </form>
      </Modal>
    </div>
  );
}
