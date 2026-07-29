"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ParticleBackground } from "@/components/ParticleBackground";
import { api } from "@/lib/api";

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: string;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirect =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  // 步骤状态: 'email' | 'tenant' | 'password'
  const [step, setStep] = useState<"email" | "tenant" | "password">("email");

  const [email, setEmail] = useState("");
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");

  // 步骤1: 查询租户列表
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/login", { email, step: 1 });
      const payload = res as { data: { tenants: TenantInfo[]; singleTenant: boolean; name: string } };
      const data = payload.data;

      setUserName(data.name);
      setTenants(data.tenants);

      if (data.singleTenant) {
        setSelectedTenant(data.tenants[0]);
        setStep("password");
      } else {
        setStep("tenant");
      }
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "查询失败，请检查邮箱");
    } finally {
      setLoading(false);
    }
  };

  // 步骤2: 选择租户
  const handleTenantSelect = (tenant: TenantInfo) => {
    setSelectedTenant(tenant);
    setStep("password");
    setError("");
  };

  // 步骤3: 验证密码
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setError("");
    setLoading(true);

    try {
      await api.post("/api/auth/login", {
        email,
        tenantId: selectedTenant.id,
        password,
        step: 2,
        remember,
      });
      router.push(redirect);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "密码错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 返回上一步
  const goBack = () => {
    if (step === "password") {
      if (tenants.length > 1) {
        setStep("tenant");
      } else {
        setStep("email");
      }
      setPassword("");
      setError("");
    } else if (step === "tenant") {
      setStep("email");
      setTenants([]);
      setSelectedTenant(null);
      setError("");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="underline text-xs ml-2 shrink-0">知道了</button>
        </div>
      )}

      {/* 步骤1: 输入邮箱 */}
      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
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
          <Button type="submit" loading={loading} className="w-full">
            下一步
          </Button>
        </form>
      )}

      {/* 步骤2: 选择租户 */}
      {step === "tenant" && (
        <div className="space-y-4">
          <div className="text-sm text-[#555]">
            <span className="font-medium">{userName}</span>，请选择要访问的租户：
          </div>
          <div className="space-y-2">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleTenantSelect(tenant)}
                className="w-full p-4 rounded-lg border border-gray-200 hover:border-[#1a1a2e] hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-[#1a1a2e] flex items-center justify-center text-white font-bold">
                  {tenant.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#333]">{tenant.name}</div>
                  <div className="text-xs text-[#999]">
                    {tenant.role === "admin" ? "管理员" : "成员"}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={goBack}
            className="text-sm text-[#555] hover:text-[#1a1a2e]"
          >
            ← 使用其他邮箱
          </button>
        </div>
      )}

      {/* 步骤3: 输入密码 */}
      {step === "password" && selectedTenant && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="w-8 h-8 rounded bg-[#1a1a2e] flex items-center justify-center text-white text-sm font-bold">
              {selectedTenant.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-[#333]">
                {selectedTenant.name}
              </div>
              <div className="text-xs text-[#999]">{email}</div>
            </div>
            <button
              type="button"
              onClick={goBack}
              className="text-xs text-[#555] hover:text-[#1a1a2e]"
            >
              切换
            </button>
          </div>

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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[#555]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-gray-300"
              />
              记住我的选择
            </label>
            <button
              type="button"
              onClick={() => setNotice("密码重置功能暂未开放，请联系系统管理员。")}
              className="text-sm text-[#555] hover:text-[#1a1a2e]"
            >
              忘记密码？
            </button>
          </div>

          <Button type="submit" loading={loading} className="w-full">
            登录
          </Button>
        </form>
      )}
    </div>
  );
}

function CurrentTime() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}

export default function LoginPage() {
  const [notice, setNotice] = useState("");

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Left side - brand area with particle animation */}
      <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-10 bg-[#1a1a2e]">
        <ParticleBackground />
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="华检科"
              className="w-9 h-9 rounded object-cover"
            />
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg tracking-tight">
                华检科 HubForge
              </span>
            </div>
          </Link>
        </div>
        <div className="relative z-10">
          <div className="text-white/20 text-xs">
            <CurrentTime />
          </div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="华检科"
                className="w-8 h-8 rounded object-cover"
              />
              <div className="flex flex-col">
                <span className="font-bold text-[#1a1a2e] tracking-tight">
                  华检科 HubForge
                </span>
              </div>
            </Link>
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

          {notice && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-center justify-between">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} className="underline text-xs ml-2 shrink-0">知道了</button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-[#555]">
            还没有账号？{" "}
            <button
              type="button"
              onClick={() => setNotice("注册功能暂未开放，请联系系统管理员开通账号。")}
              className="text-[#1a1a2e] hover:underline font-medium"
            >
              注册
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
