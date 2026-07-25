"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  user: {
    email: string;
    name?: string;
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
        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.name || user.email}
            </p>
            {user.name && (
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              // V1: just close
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            个人信息
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
