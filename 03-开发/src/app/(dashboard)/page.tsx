"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppCard, type App } from "@/components/AppCard";
import { SearchInput } from "@/components/SearchInput";
import { api } from "@/lib/api";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，还在忙？";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜深了，还在忙？";
}

export default function DashboardHomePage() {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [filteredApps, setFilteredApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const greeting = getGreeting();

  useEffect(() => {
    async function fetchApps() {
      try {
        const res = await api.get<{ success: boolean; data: App[] }>("/api/apps");
        const list = res.data || [];
        setApps(list);
        setFilteredApps(list);
      } catch (err: unknown) {
        const apiErr = err as { error?: string };
        setError(apiErr.error || "出了点问题，刷新试试？");
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredApps(apps);
    } else {
      const q = search.toLowerCase();
      setFilteredApps(
        apps.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.slug.toLowerCase().includes(q)
        )
      );
    }
  }, [search, apps]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#333]">{greeting}</h1>
        <p className="text-sm text-[#555] mt-0.5">你的应用都在这了</p>
      </div>

      {/* Mobile search */}
      <div className="md:hidden mb-4">
        <SearchInput placeholder="找点什么？" onSearch={setSearch} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
        </div>
      )}

      {filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg
            className="w-16 h-16 mb-4 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="text-lg font-medium text-[#555]">
            {search ? "没找到匹配的应用" : "还没有应用"}
          </p>
          <p className="text-sm mt-1 text-gray-400">
            {search ? "换个关键词试试？" : "等管理员添加应用后就会出现在这里"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app, index) => (
            <AppCard
              key={app.id}
              app={app}
              tintIndex={index}
              onClick={() => router.push(`/app/${app.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
