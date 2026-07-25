"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api } from "@/lib/api";

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "太简单", color: "bg-[#e94560]", width: "w-1/5" };
  if (score <= 2) return { label: "有点弱", color: "bg-orange-500", width: "w-2/5" };
  if (score <= 3) return { label: "还行", color: "bg-amber-500", width: "w-3/5" };
  if (score <= 4) return { label: "不错", color: "bg-green-500", width: "w-4/5" };
  return { label: "很好", color: "bg-green-600", width: "w-full" };
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordsMatch) {
      setError("两次密码不一样");
      return;
    }

    setLoading(true);
    try {
      // 自动生成 tenantSlug（团队名称转 kebab-case）
      const tenantSlug = tenantName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
        || "default";

      await api.post("/api/auth/register", {
        name,
        email,
        password,
        tenantName,
        tenantSlug,
      });
      router.push("/login");
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "注册没成功，再试一次？");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Left side - brand area */}
      <div className="hidden lg:flex lg:w-2/5 bg-[#1a1a2e] flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
            <span className="text-white text-sm font-bold">H</span>
          </span>
          <span className="text-white font-bold text-lg tracking-tight">HubForge</span>
        </div>
        <div />
      </div>

      {/* Right side - register form */}
      <div className="flex-1 flex items-start justify-center pt-24 lg:pt-32 px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded bg-[#1a1a2e] flex items-center justify-center">
                <span className="text-white text-xs font-bold">H</span>
              </span>
              <span className="font-bold text-[#1a1a2e] tracking-tight">HubForge</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#333] mb-8">注册</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
                {error}
              </div>
            )}
            <Input
              id="name"
              label="姓名"
              type="text"
              placeholder="你的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <Input
              id="tenantName"
              label="团队名称"
              type="text"
              placeholder="你的团队或公司名"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
            />
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
            <div>
              <Input
                id="password"
                label="密码"
                type="password"
                placeholder="8位以上，含大小写字母和数字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1">
                密码要求：至少8位，包含大写字母、小写字母和数字
              </p>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} ${strength.width} transition-all rounded-full`}
                      />
                    </div>
                    <span className="text-xs text-[#555]">{strength.label}</span>
                  </div>
                </div>
              )}
            </div>
            <Input
              id="confirmPassword"
              label="确认密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              error={
                confirmPassword.length > 0 && !passwordsMatch
                  ? "两次不一样"
                  : undefined
              }
              autoComplete="new-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              注册
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#555]">
            已经有账号？{" "}
            <Link
              href="/login"
              className="text-[#1a1a2e] hover:underline font-medium"
            >
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
