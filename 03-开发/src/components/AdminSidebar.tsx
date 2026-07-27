"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/tenants", label: "租户" },
  { href: "/admin/users", label: "用户" },
  { href: "/admin/departments", label: "部门" },
  { href: "/admin/permissions", label: "权限" },
  { href: "/admin/apps", label: "应用" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-56 bg-white border-r border-gray-200 shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#333]">后台管理</h2>
      </div>
      <nav className="p-2 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-[#1a1a2e]/5 text-[#1a1a2e]"
                : "text-[#555] hover:bg-gray-100"
            )}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
