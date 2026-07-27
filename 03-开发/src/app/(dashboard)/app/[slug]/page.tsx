"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface AppInfo {
  id: string;
  name: string;
  slug: string;
  url: string;
  type: string;
}

export default function AppViewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [app, setApp] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const entryRef = useRef<string>("/");

  // 记录进入应用前的页面（用于 × 关闭按钮）
  useEffect(() => {
    if (typeof window !== "undefined") {
      entryRef.current = document.referrer || "/";
    }
  }, []);

  useEffect(() => {
    async function fetchApp() {
      try {
        const res = await api.get<{ success: boolean; data: AppInfo[] }>("/api/apps");
        const found = res.data?.find((a) => a.slug === slug);
        if (found) {
          setApp(found);
          document.title = `${found.name} - HubForge`;
        } else {
          setError("找不到这个应用");
        }
      } catch (err: unknown) {
        const apiErr = err as { error?: string };
        setError(apiErr.error || "加载没成功，刷新试试？");
      } finally {
        setLoading(false);
      }
    }
    fetchApp();

    return () => {
      document.title = "HubForge";
    };
  }, [slug]);

  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
      }
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleClose = () => {
    // 关闭应用，退出到进入前的页面
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-lg font-medium text-[#555]">{error || "应用不存在"}</p>
        <Link href="/" className="mt-4 text-sm text-[#1a1a2e] hover:underline">
          回到首页
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* H5 顶部栏 - 仅移动端显示 */}
      <div className="lg:hidden flex items-center h-12 px-3 bg-white border-b border-gray-200 shrink-0">
        {/* ‹ 返回上一步 */}
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center text-[#333] hover:text-[#1a1a2e] transition-colors"
          aria-label="返回"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Logo + 应用名 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src="/logo.png" alt="华检科" className="w-5 h-5 rounded object-cover shrink-0" />
          <span className="text-sm font-semibold text-[#333] truncate">{app.name}</span>
        </div>

        {/* × 关闭应用 */}
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#e94560] transition-colors"
          aria-label="关闭应用"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* iframe 应用内容区 */}
      <iframe
        ref={iframeRef}
        src={app.url}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-forms"
        title={app.name}
      />
    </div>
  );
}
