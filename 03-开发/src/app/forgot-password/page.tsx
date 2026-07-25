"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card, CardContent, CardHeader } from "@/components/Card";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Step 1: enter email, Step 2: enter code + new password
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/auth/forgot-password", { email });
      setSuccess("验证码已发送到您的邮箱");
      setStep(2);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "发送失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      setSuccess("密码重置成功，即将跳转到登录页...");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "重置失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <span className="text-3xl">🔑</span>
            <h1 className="text-xl font-bold text-gray-900 mt-2">忘记密码</h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1 ? "输入邮箱以重置密码" : "输入验证码和新密码"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={handleSendCode} className="space-y-4">
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
              <Button type="submit" loading={loading} className="w-full">
                发送验证码
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-600">
                  {success}
                </div>
              )}
              <Input
                id="code"
                label="验证码"
                type="text"
                placeholder="输入6位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
              />
              <Input
                id="newPassword"
                label="新密码"
                type="password"
                placeholder="至少8位"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Input
                id="confirmPassword"
                label="确认新密码"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                error={
                  confirmPassword.length > 0 && newPassword !== confirmPassword
                    ? "密码不一致"
                    : undefined
                }
                autoComplete="new-password"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep(1);
                    setError("");
                    setSuccess("");
                  }}
                  className="flex-1"
                >
                  返回
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  重置密码
                </Button>
              </div>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-gray-500">
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              返回登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
