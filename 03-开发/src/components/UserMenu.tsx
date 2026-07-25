"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  user: {
    email: string;
    name?: string;
    tenant?: { name: string };
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
  };

  const initials = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-sm font-medium hover:bg-[#16213e] transition-colors"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* 用户信息区 */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-[#333] truncate">
              {user.name || user.email}
            </p>
            {user.name && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
            )}
            {user.tenant && (
              <p className="text-xs text-gray-400 mt-1">
                租户：{user.tenant.name}
              </p>
            )}
          </div>
          {/* 操作区 */}
          <button
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
            className="w-full text-left px-4 py-2 text-sm text-[#555] hover:bg-gray-50"
          >
            个人信息
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-[#e94560] hover:bg-gray-50"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
