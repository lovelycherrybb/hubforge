"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppCard, type App } from "@/components/AppCard";
import { SearchInput } from "@/components/SearchInput";
import { api } from "@/lib/api";

export default function DashboardHomePage() {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [filteredApps, setFilteredApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchApps() {
      try {
        const res = await api.get<{ success: boolean; data: App[] }>("/api/apps");
        const list = res.data || [];
        setApps(list);
        setFilteredApps(list);
      } catch (err: unknown) {
        const apiErr = err as { error?: string };
        setError(apiErr.error || "加载应用失败");
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
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Mobile search */}
      <div className="md:hidden mb-4">
        <SearchInput placeholder="搜索应用..." onSearch={setSearch} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg
            className="w-16 h-16 mb-4"
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
          <p className="text-lg font-medium">暂无应用</p>
          <p className="text-sm mt-1">请联系管理员开通应用权限</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onClick={() => router.push(`/app/${app.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
