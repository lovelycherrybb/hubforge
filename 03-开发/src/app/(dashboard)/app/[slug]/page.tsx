"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface AppTokenData {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
  };
  permissions: string[];
  config: Record<string, string>;
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
  const tokenCache = useRef<AppTokenData | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      entryRef.current = document.referrer || "/";
    }
  }, []);

  // 获取应用 Token（带缓存）
  const fetchAppToken = useCallback(
    async (appId: string): Promise<AppTokenData | null> => {
      if (tokenCache.current) return tokenCache.current;
      try {
        const res = await api.get<{ success: boolean; data: AppTokenData }>(
          `/api/apps/${appId}/token`
        );
        tokenCache.current = res.data;
        return res.data;
      } catch {
        return null;
      }
    },
    []
  );

  // 计算 iframe 目标源（安全：限定 postMessage 目标）
  const targetOrigin = app?.url?.startsWith("/")
    ? window.location.origin
    : app?.url
    ? new URL(app.url).origin
    : "*";

  // 监听 iframe 的 postMessage 请求
  useEffect(() => {
    if (!app) {
      console.log("[HubForge Bridge] app is null, skipping");
      return;
    }
    console.log("[HubForge Bridge] Setting up message listener for app:", app.slug);

    async function handleMessage(event: MessageEvent) {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      // 安全检查：消息必须来自 iframe
      // 注意：event.source 在 sandbox 模式下可能为 null
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (!data.type || !data.type.startsWith("hubforge:")) return;

      console.log("[HubForge Bridge] Received message:", data.type);

      switch (data.type) {
        case "hubforge:ready": {
          // 应用已加载，请求认证信息
          console.log("[HubForge Bridge] App ready, fetching token for:", app!.id);
          const tokenData = await fetchAppToken(app!.id);
          console.log("[HubForge Bridge] Token data:", tokenData ? "success" : "failed");
          if (tokenData) {
            console.log("[HubForge Bridge] Sending auth to iframe, targetOrigin:", targetOrigin, "iframe:", !!iframe.contentWindow);
            iframe.contentWindow.postMessage(
              {
                type: "hubforge:auth",
                token: tokenData.token,
                user: tokenData.user,
                permissions: tokenData.permissions,
                config: tokenData.config,
                appSlug: app!.slug,
              },
              targetOrigin
            );
            console.log("[HubForge Bridge] Auth message sent!");
          } else {
            iframe.contentWindow.postMessage(
              {
                type: "hubforge:auth-error",
                error: "获取认证信息失败",
              },
              targetOrigin
            );
          }
          break;
        }

        case "hubforge:request-auth": {
          // 应用重新请求认证（Token 可能过期）
          tokenCache.current = null; // 清除缓存
          const freshToken = await fetchAppToken(app!.id);
          if (freshToken && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              {
                type: "hubforge:auth",
                token: freshToken.token,
                user: freshToken.user,
                permissions: freshToken.permissions,
                config: freshToken.config,
                appSlug: app!.slug,
              },
              targetOrigin
            );
          }
          break;
        }

        case "hubforge:navigate": {
          // 应用请求页面跳转
          if (data.url && typeof data.url === "string") {
            router.push(data.url);
          }
          break;
        }

        case "hubforge:close": {
          // 应用请求关闭
          router.push("/");
          break;
        }

        case "hubforge:resize": {
          // 应用请求调整 iframe 高度
          if (data.height && typeof data.height === "number") {
            iframe.style.height = `${data.height}px`;
          }
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [app, fetchAppToken, router]);

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

  const handleBack = () => router.back();
  const handleClose = () => router.push("/");

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
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center text-[#333] hover:text-[#1a1a2e] transition-colors"
          aria-label="返回"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src="/logo.png" alt="华检科" className="w-5 h-5 rounded object-cover shrink-0" />
          <span className="text-sm font-semibold text-[#333] truncate">{app.name}</span>
        </div>

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
