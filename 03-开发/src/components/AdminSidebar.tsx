"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/tenants", label: "租户管理", icon: "🏢" },
  { href: "/admin/users", label: "用户管理", icon: "👥" },
  { href: "/admin/departments", label: "组织架构", icon: "🏗️" },
  { href: "/admin/permissions", label: "权限管理", icon: "🔐" },
  { href: "/admin/apps", label: "应用管理", icon: "📦" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">管理后台</h2>
      </div>
      <nav className="p-2 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
