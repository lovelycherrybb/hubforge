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
      setSuccess("验证码发到你邮箱了，去看看");
      setStep(2);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "发送失败，再试一次？");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("两次密码不一样");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      setSuccess("密码改好了，马上跳转...");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || "重置没成功，再试一次？");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-start justify-center pt-24 lg:pt-32 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-xs font-bold">H</span>
            </span>
            <span className="font-bold text-[#1a1a2e] tracking-tight">HubForge</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#333] mb-1">
          {step === 1 ? "密码忘了？" : "设个新密码"}
        </h1>
        <p className="text-sm text-[#555] mb-8">
          {step === 1 ? "输入你的邮箱，我们发个验证码给你。" : "验证码和新密码填好就行。"}
        </p>

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-4">
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
            <Button type="submit" loading={loading} className="w-full">
              发验证码
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#e94560]">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                {success}
              </div>
            )}
            <Input
              id="code"
              label="验证码"
              type="text"
              placeholder="6位验证码"
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
              label="再输一次"
              type="password"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              error={
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? "两次不一样"
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

        <p className="mt-6 text-center text-sm text-[#555]">
          <Link
            href="/login"
            className="text-[#1a1a2e] hover:underline font-medium"
          >
            回到登录
          </Link>
        </p>
      </div>
    </div>
  );
}
