"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
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
  const slug = params.slug as string;
  const [app, setApp] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function fetchApp() {
      try {
        const res = await api.get<{ success: boolean; data: AppInfo[] }>("/api/apps");
        const found = res.data?.find((a) => a.slug === slug);
        if (found) {
          setApp(found);
          // Update document title
          document.title = `${found.name} - HubForge`;
        } else {
          setError("应用不存在");
        }
      } catch (err: unknown) {
        const apiErr = err as { error?: string };
        setError(apiErr.error || "加载应用失败");
      } finally {
        setLoading(false);
      }
    }
    fetchApp();

    // Cleanup: reset title on unmount
    return () => {
      document.title = "HubForge - 企业应用管理平台";
    };
  }, [slug]);

  // Destroy iframe on unmount
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-lg font-medium">{error || "应用不存在"}</p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={app.url}
      className="w-full h-full border-0"
      sandbox="allow-same-origin allow-scripts allow-forms"
      title={app.name}
    />
  );
}
