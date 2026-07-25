"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card, CardContent, CardHeader } from "@/components/Card";
import { api } from "@/lib/api";

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "弱", color: "bg-red-500", width: "w-1/5" };
  if (score <= 2) return { label: "较弱", color: "bg-orange-500", width: "w-2/5" };
  if (score <= 3) return { label: "中等", color: "bg-yellow-500", width: "w-3/5" };
  if (score <= 4) return { label: "强", color: "bg-green-500", width: "w-4/5" };
  return { label: "很强", color: "bg-green-600", width: "w-full" };
}

export default function RegisterPage() {
  const router = useRouter();

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
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/register", { email, password });
      router.push("/login");
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <span className="text-3xl">🏠</span>
            <h1 className="text-xl font-bold text-gray-900 mt-2">创建账号</h1>
            <p className="text-sm text-gray-500 mt-1">注册 HubForge 账号</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}
            <Input
              id="email"
              label="邮箱"
              type="email"
              placeholder="your@email.com"
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
                placeholder="至少8位，包含大小写字母和数字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} ${strength.width} transition-all rounded-full`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{strength.label}</span>
                  </div>
                </div>
              )}
            </div>
            <Input
              id="confirmPassword"
              label="确认密码"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              error={
                confirmPassword.length > 0 && !passwordsMatch
                  ? "密码不一致"
                  : undefined
              }
              autoComplete="new-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              注册
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            已有账号？{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
