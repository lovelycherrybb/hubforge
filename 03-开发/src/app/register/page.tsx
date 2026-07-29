"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
            <img src="/logo.png" alt="华检科" className="w-8 h-8 rounded object-cover" />
            <div className="flex flex-col">
              <span className="font-bold text-[#1a1a2e] tracking-tight">华检科 HubForge</span>
            </div>
          </Link>
        </div>

        <div className="p-6 rounded-lg border border-gray-200 bg-white mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#333] mb-2">注册功能暂未开放</h1>
          <p className="text-sm text-[#555] leading-relaxed">
            如需开通账号，请联系系统管理员。
          </p>
        </div>

        <Link
          href="/login"
          className="text-sm text-[#1a1a2e] hover:underline font-medium"
        >
          ← 回到登录
        </Link>
      </div>
    </div>
  );
}
