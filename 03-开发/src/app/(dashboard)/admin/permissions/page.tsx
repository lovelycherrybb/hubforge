"use client";

import { useState, useEffect } from "react";
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
  key: string;
  label: string;
  type: string;
  app?: { id: string; name: string } | null;
}

interface PermissionsResponse {
  framework: Permission[];
  app: Permission[];
  all: Permission[];
}

export default function PermissionsPage() {
  const [data, setData] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get<{ success: boolean; data: PermissionsResponse }>(
          "/api/permissions"
        );
        setData(res.data);
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

  if (error) {
    return (
      <div>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[#333]">权限管理</h1>
        <p className="text-sm text-[#555] mt-1">
          框架权限由平台控制，应用权限由租户自己管理
        </p>
      </div>

      {/* 框架权限 */}
      <div>
        <h2 className="text-lg font-semibold text-[#333] mb-3">框架权限</h2>
        {data?.framework?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权限标识</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.framework.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.key}</TableCell>
                  <TableCell>{p.label}</TableCell>
                  <TableCell>
                    <Badge variant="info">框架</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-gray-400">还没有框架权限</p>
        )}
      </div>

      {/* 应用权限 */}
      <div>
        <h2 className="text-lg font-semibold text-[#333] mb-3">应用权限</h2>
        {data?.app?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权限标识</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>所属应用</TableHead>
                <TableHead>类型</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.app.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.key}</TableCell>
                  <TableCell>{p.label}</TableCell>
                  <TableCell>{p.app?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="default">应用</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-gray-400">还没有应用权限</p>
        )}
      </div>
    </div>
  );
}
