"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./UserMenu";

interface TopBarProps {
  appName?: string;
  user?: {
    email: string;
    name?: string;
    isGlobalAdmin?: boolean;
    isTenantAdmin?: boolean;
    tenant?: { name: string };
  };
}

export function TopBar({ appName, user }: TopBarProps) {
  const pathname = usePathname();
  const showAdmin = user?.isGlobalAdmin || user?.isTenantAdmin;

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0 group">
        <img src="/logo.png" alt="华检科" className="w-7 h-7 rounded object-cover" />
        <div className="hidden sm:flex flex-col leading-tight">
          <span className="text-sm font-bold text-[#1a1a2e] tracking-tight">华检科 HubForge</span>
          <span className="text-[10px] text-gray-400">AI 重塑咨询解决方案</span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="hidden lg:flex items-center gap-1 ml-3">
        <Link
          href="/"
          className={`px-3 py-1 rounded-md text-sm transition-colors ${
            pathname === "/"
              ? "bg-[#1a1a2e]/5 text-[#1a1a2e] font-medium"
              : "text-[#555] hover:bg-gray-100"
          }`}
        >
          全部应用
        </Link>
        {appName && (
          <span className="px-2 py-1 text-sm text-gray-400">
            / <span className="text-[#333] font-medium ml-1">{appName}</span>
          </span>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Admin link */}
      {showAdmin && (
        <Link
          href="/admin/users"
          className={`hidden lg:inline-flex p-1.5 rounded-md transition-colors ${
            pathname.startsWith("/admin")
              ? "bg-[#1a1a2e]/5 text-[#1a1a2e]"
              : "text-gray-400 hover:bg-gray-100 hover:text-[#333]"
          }`}
          title="后台管理"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>
      )}

      {/* User menu */}
      {user && <UserMenu user={user} />}
    </header>
  );
}
