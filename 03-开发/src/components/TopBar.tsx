"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchInput } from "./SearchInput";
import { UserMenu } from "./UserMenu";

interface TopBarProps {
  appName?: string;
  onSearch?: (value: string) => void;
  user?: {
    email: string;
    name?: string;
    isGlobalAdmin?: boolean;
  };
}

export function TopBar({ appName, onSearch, user }: TopBarProps) {
  const pathname = usePathname();

  return (
    <header className="h-12 bg-white border-b border-gray-200 shadow-sm flex items-center px-4 gap-3 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <span className="text-xl">🏠</span>
        <span className="font-bold text-gray-900 hidden sm:inline">HubForge</span>
      </Link>

      {/* Nav */}
      <nav className="flex items-center gap-1 ml-2">
        <Link
          href="/"
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            pathname === "/"
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          首页
        </Link>
        {appName && (
          <span className="px-3 py-1 text-sm text-gray-500">
            / <span className="text-gray-900 font-medium ml-1">{appName}</span>
          </span>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search - hidden on mobile */}
      <div className="hidden md:block w-64">
        <SearchInput placeholder="搜索应用..." onSearch={onSearch} />
      </div>

      {/* Admin link */}
      {user?.isGlobalAdmin && (
        <Link
          href="/admin/tenants"
          className={`p-1.5 rounded-md transition-colors ${
            pathname.startsWith("/admin")
              ? "bg-blue-50 text-blue-700"
              : "text-gray-500 hover:bg-gray-100"
          }`}
          title="管理后台"
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
