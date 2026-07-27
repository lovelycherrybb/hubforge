"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useUser } from "@/lib/hooks";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const isGlobalAdmin = user?.isGlobalAdmin || false;

  // 租户管理员可访问的页面
  const tenantAdminNavItems = [
    { href: "/admin/users", label: "用户" },
    { href: "/admin/departments", label: "部门" },
    { href: "/admin/apps", label: "应用" },
    { href: "/admin/permissions", label: "权限" },
  ];

  // 主租户额外可访问
  const globalAdminNavItems = [
    { href: "/admin/tenants", label: "租户" },
    ...tenantAdminNavItems,
  ];

  const navItems = isGlobalAdmin ? globalAdminNavItems : tenantAdminNavItems;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-48px)]">
      {/* H5: 顶部横向 Tab 导航 */}
      <div className="lg:hidden flex overflow-x-auto border-b border-gray-200 bg-white shrink-0">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith(item.href)
                ? "text-[#1a1a2e] border-b-2 border-[#1a1a2e]"
                : "text-gray-500"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* PC: 左侧边栏 */}
      <AdminSidebar isGlobalAdmin={isGlobalAdmin} />

      {/* 内容区 */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4 lg:p-6">{children}</div>
    </div>
  );
}
