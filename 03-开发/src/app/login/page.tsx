"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/auth/login", { email, password });
      router.push(redirect);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "没登上，再试一次？");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
        </div>
      )}
      <Input
        id="email"
        label="邮箱"
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Input
        id="password"
        label="密码"
        type="password"
        placeholder="输入你的密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <div className="flex items-center justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-[#555] hover:text-[#1a1a2e]"
        >
          忘记密码？
        </Link>
      </div>
      <Button type="submit" loading={loading} className="w-full">
        登录
      </Button>
    </form>
  );
}

function CurrentTime() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      );
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Left side - brand area */}
      <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/login-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[#1a1a2e]/60" />
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="华检科" className="w-9 h-9 rounded object-cover" />
          <div className="flex flex-col">
            <span className="text-white font-bold text-lg tracking-tight">华检科 HubForge</span>
            <span className="text-white/50 text-xs">AI 重塑咨询解决方案</span>
          </div>
        </div>
        <div className="relative z-10">
          <div className="text-white/20 text-xs">
            <CurrentTime />
          </div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-start justify-center pt-24 lg:pt-32 px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="华检科" className="w-8 h-8 rounded object-cover" />
              <div className="flex flex-col">
                <span className="font-bold text-[#1a1a2e] tracking-tight">华检科 HubForge</span>
                <span className="text-xs text-gray-400">AI 重塑咨询解决方案</span>
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#333] mb-8">登录</h1>

          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-[#555]">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-[#1a1a2e] hover:underline font-medium"
            >
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
