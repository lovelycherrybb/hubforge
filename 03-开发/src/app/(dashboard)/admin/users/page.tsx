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
  role?: "owner" | "admin" | "member";
  status: "active" | "inactive" | "locked" | "invited";
  department?: { name: string };
  joinedAt?: string;
  createdAt?: string;
}

interface UserDetail extends User {
  departments?: { id: string; name: string; isPrimary: boolean }[];
  permissions?: { key: string; label: string; type: string }[];
}

const roleMap: Record<string, { label: string; variant: "info" | "warning" | "default" }> = {
  owner: { label: "平台管理员", variant: "info" },
  admin: { label: "租户管理员", variant: "warning" },
  member: { label: "成员", variant: "default" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "member" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // 用户详情面板
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editRole, setEditRole] = useState<string>("");
  const [resetPassword, setResetPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

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
      setForm({ email: "", name: "", password: "", role: "member" });
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "没创建成功，再试一次？");
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (user: User) => {
    setDetailLoading(true);
    setSelectedUser(null);
    setSaveMsg("");
    setResetPassword("");
    try {
      const res = await api.get<{ success: boolean; data: UserDetail }>(`/api/users/${user.id}`);
      setSelectedUser(res.data);
      setEditRole(res.data.role || "member");
    } catch {
      setError("加载用户详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedUser || editRole === selectedUser.role) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await api.put(`/api/users/${selectedUser.id}`, { role: editRole });
      setSaveMsg("角色已更新");
      setSelectedUser({ ...selectedUser, role: editRole as UserDetail["role"] });
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setSaveMsg(apiErr.error || "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !resetPassword) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await api.put(`/api/users/${selectedUser.id}`, { password: resetPassword });
      setSaveMsg("密码已重置");
      setResetPassword("");
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setSaveMsg(apiErr.error || "重置失败");
    } finally {
      setSaving(false);
    }
  };

  const statusMap: Record<string, { label: string; variant: "success" | "danger" | "warning" }> = {
    active: { label: "正常", variant: "success" },
    invited: { label: "待激活", variant: "warning" },
    inactive: { label: "未激活", variant: "warning" },
    locked: { label: "已锁定", variant: "danger" },
    suspended: { label: "已停用", variant: "danger" },
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
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(u)}
                >
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={roleMap[u.role || "member"]?.variant || "default"}>
                      {roleMap[u.role || "member"]?.label || u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusMap[u.status]?.variant || "default"}>
                      {statusMap[u.status]?.label || u.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.department?.name || "-"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(u);
                      }}
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 用户详情面板 */}
      <Modal
        open={!!selectedUser || detailLoading}
        onClose={() => setSelectedUser(null)}
        title="用户详情"
        size="lg"
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
          </div>
        ) : selectedUser ? (
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400">姓名</label>
                <p className="text-sm text-[#333] mt-0.5">{selectedUser.name || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400">邮箱</label>
                <p className="text-sm text-[#333] mt-0.5">{selectedUser.email}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400">部门</label>
                <p className="text-sm text-[#333] mt-0.5">
                  {selectedUser.departments?.map((d) => d.name).join("、") || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-400">加入时间</label>
                <p className="text-sm text-[#333] mt-0.5">
                  {selectedUser.joinedAt
                    ? new Date(selectedUser.joinedAt).toLocaleDateString("zh-CN")
                    : "-"}
                </p>
              </div>
            </div>

            {/* 状态操作 */}
            {selectedUser.status === "invited" && (
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-3">
                  <Badge variant="warning">待激活</Badge>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await api.put(`/api/users/${selectedUser.id}`, { status: "active" });
                      setSelectedUser({ ...selectedUser, status: "active" });
                      fetchUsers();
                    }}
                  >
                    激活
                  </Button>
                  <span className="text-xs text-gray-400">激活后用户即可正常登录</span>
                </div>
              </div>
            )}

            {/* 角色修改 */}
            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs text-gray-400 block mb-2">修改角色</label>
              <div className="flex items-center gap-3">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={selectedUser.role === "owner"}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] disabled:opacity-50"
                >
                  <option value="admin">租户管理员</option>
                  <option value="member">成员</option>
                </select>
                <Button
                  size="sm"
                  onClick={handleSaveRole}
                  disabled={selectedUser.role === "owner" || editRole === selectedUser.role || saving}
                  loading={saving}
                >
                  保存
                </Button>
                {selectedUser.role === "owner" && (
                  <span className="text-xs text-gray-400">平台管理员角色不可修改</span>
                )}
              </div>
            </div>

            {/* 密码重置 */}
            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs text-gray-400 block mb-2">重置密码</label>
              <div className="flex items-center gap-3">
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="输入新密码（8位以上，含大小写和数字）"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleResetPassword}
                  disabled={!resetPassword || saving}
                  loading={saving}
                >
                  重置
                </Button>
              </div>
            </div>

            {/* 提示信息 */}
            {saveMsg && (
              <div
                className={`text-sm p-2 rounded-lg ${
                  saveMsg.includes("失败") || saveMsg.includes("错误")
                    ? "bg-red-50 text-[#e94560]"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {saveMsg}
              </div>
            )}

            {/* 已有权限（只读展示） */}
            {selectedUser.permissions && selectedUser.permissions.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs text-gray-400 block mb-2">已有权限</label>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.permissions.map((p) => (
                    <Badge key={p.key} variant={p.type === "framework" ? "info" : "default"}>
                      {p.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 创建用户弹窗 */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="添加用户"
        formId="create-user-form"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              取消
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
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">角色</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
            >
              <option value="member">成员</option>
              <option value="admin">租户管理员</option>
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            密码要求：至少8位，包含大写字母、小写字母和数字
          </p>
        </form>
      </Modal>
    </div>
  );
}
