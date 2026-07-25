"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card, CardContent, CardHeader } from "@/components/Card";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

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
      setError(apiErr.error || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
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
      <Input
        id="password"
        label="密码"
        type="password"
        placeholder="输入密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <div className="flex items-center justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-700"
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

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <span className="text-3xl">🏠</span>
            <h1 className="text-xl font-bold text-gray-900 mt-2">HubForge</h1>
            <p className="text-sm text-gray-500 mt-1">企业应用管理平台</p>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
          <p className="mt-4 text-center text-sm text-gray-500">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
