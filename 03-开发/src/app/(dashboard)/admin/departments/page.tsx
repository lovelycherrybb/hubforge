"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { TreeView, type TreeNode } from "@/components/TreeView";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/Table";
import { api } from "@/lib/api";

interface Department {
  id: string;
  name: string;
  parentId?: string | null;
  children?: Department[];
  users?: { id: string; name?: string; email: string }[];
}

export default function DepartmentsPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchTree = async () => {
    try {
      const res = await api.get<{ success: boolean; data: Department[] }>(
        "/api/departments/tree"
      );
      setTree(res.data || []);
    } catch {
      setError("加载部门树失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDept(null);
      return;
    }
    async function fetchDept() {
      try {
        const res = await api.get<{ success: boolean; data: Department }>(
          `/api/departments/${selectedId}`
        );
        setSelectedDept(res.data);
      } catch {
        setError("加载部门详情失败");
      }
    }
    fetchDept();
  }, [selectedId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/api/departments", {
        name: newName,
        parentId: selectedId || null,
      });
      setShowCreate(false);
      setNewName("");
      fetchTree();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除此部门？")) return;
    try {
      await api.delete(`/api/departments/${id}`);
      setSelectedId(null);
      fetchTree();
    } catch {
      setError("删除失败");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">组织架构</h1>
        <Button onClick={() => setShowCreate(true)}>+ 新增部门</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-220px)]">
          {/* Left: tree */}
          <div className="w-72 bg-white rounded-lg border border-gray-200 shadow-sm overflow-y-auto shrink-0">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">部门结构</h3>
            </div>
            <div className="p-2">
              {tree.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无部门</p>
              ) : (
                <TreeView
                  data={tree}
                  selectedId={selectedId || undefined}
                  onSelect={(node) => setSelectedId(node.id)}
                />
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm overflow-auto">
            {selectedDept ? (
              <div>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedDept.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedDept.users?.length || 0} 名成员
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
                      新增子部门
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(selectedDept.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>邮箱</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDept.users && selectedDept.users.length > 0 ? (
                      selectedDept.users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.name || "-"}</TableCell>
                          <TableCell>{u.email}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-400 py-8">
                          暂无成员
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <svg
                  className="w-12 h-12 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <p>选择左侧部门查看详情</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={selectedId ? "新增子部门" : "新增部门"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button loading={creating} onClick={handleCreate}>
              创建
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="部门名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入部门名称"
            required
          />
        </form>
      </Modal>
    </div>
  );
}
