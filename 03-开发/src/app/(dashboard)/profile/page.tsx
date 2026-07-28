"use client";

import { useUser } from "@/lib/hooks";
import Link from "next/link";

export default function ProfilePage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-[#333] mb-6">个人信息</h1>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">邮箱</span>
          <span className="text-sm text-[#333]">{user.email}</span>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">姓名</span>
          <span className="text-sm text-[#333]">{user.name || "-"}</span>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">租户</span>
          <span className="text-sm text-[#333]">{user.tenant?.name || "-"}</span>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">部门</span>
          <span className="text-sm text-[#333]">{user.department?.name || "未分配"}</span>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">角色</span>
          <span className="text-sm text-[#333]">
            {user.role === "owner" ? "平台管理员" : user.role === "admin" ? "租户管理员" : "普通用户"}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/"
          className="text-sm text-[#1a1a2e] hover:underline"
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
