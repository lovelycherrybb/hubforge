"use client";

import { useUser } from "@/lib/hooks";
import { TopBar } from "@/components/TopBar";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  const isInApp = pathname.startsWith("/app/");
  const isTenantAdmin = user.isGlobalAdmin || user.permissions?.some(
    (p: { key?: string }) => p?.key === "tenant.admin"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PC 端始终显示 TopBar；H5 端在应用内隐藏 TopBar（应用视图有自己的顶部栏） */}
      <div className={isInApp ? "hidden lg:block" : ""}>
        <TopBar
          user={{
            email: user.email,
            name: user.name,
            isGlobalAdmin: user.isGlobalAdmin,
            isTenantAdmin,
            tenant: user.tenant,
          }}
        />
      </div>

      {/* 内容区 */}
      <main
        className={isInApp
          ? "h-screen lg:h-[calc(100vh-48px)]"  // 应用内：H5 全屏，PC 减去 TopBar
          : "h-[calc(100vh-48px)] pb-14 lg:pb-0"  // 非应用：H5 减去底栏
        }
      >
        {children}
      </main>

      {/* H5 底部导航栏 - 应用内隐藏 */}
      {!isInApp && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-center justify-around h-14 lg:hidden">
          <BottomNavItem href="/" icon="home" label="首页" active={pathname === "/"} />
          <BottomNavItem href="/" icon="apps" label="应用" active={false} />
          <BottomNavItem href="/admin/users" icon="user" label="我的" active={pathname.startsWith("/admin")} />
        </nav>
      )}
    </div>
  );
}

function BottomNavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: "home" | "apps" | "user";
  label: string;
  active: boolean;
}) {
  const color = active ? "text-[#1a1a2e]" : "text-gray-400";
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 ${color} transition-colors`}
    >
      {icon === "home" && (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )}
      {icon === "apps" && (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )}
      {icon === "user" && (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )}
      <span className="text-[10px] leading-none">{label}</span>
    </Link>
  );
}
