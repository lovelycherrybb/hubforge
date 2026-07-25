"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/Button";
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

interface Permission {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface Assignment {
  id: string;
  userId?: string;
  departmentId?: string;
  permissionId: string;
  user?: { email: string; name?: string };
  department?: { name: string };
  permission?: { name: string; code: string };
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [permRes, assignRes] = await Promise.all([
          api.get<{ success: boolean; data: Permission[] }>("/api/permissions"),
          api.get<{ success: boolean; data: Assignment[] }>("/api/permissions?include=assignments"),
        ]);
        setPermissions(permRes.data || []);
        setAssignments(assignRes.data || []);
      } catch {
        setError("没加载出来，刷新试试");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#333]">权限管理</h1>
        <Button>+ 分配权限</Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
        </div>
      )}

      {/* Permissions list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#555]">权限定义</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>编码</TableHead>
              <TableHead>描述</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                  还没有定义权限
                </TableCell>
              </TableRow>
            ) : (
              permissions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {p.code}
                    </code>
                  </TableCell>
                  <TableCell className="text-gray-500">{p.description || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assignments */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#555]">已分配的权限</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>权限</TableHead>
              <TableHead>分配给谁</TableHead>
              <TableHead>类型</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                  还没有分配权限
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.permission?.name || a.permissionId}
                  </TableCell>
                  <TableCell>
                    {a.user
                      ? `${a.user.name || a.user.email}`
                      : a.department?.name || a.departmentId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.user ? "info" : "default"}>
                      {a.user ? "用户" : "部门"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
