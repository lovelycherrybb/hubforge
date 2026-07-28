// ============================================================
// GET /api/health
// 健康检查端点（无需认证）
// 返回服务状态、数据库连接、运行时间等信息
// ============================================================

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "@/lib/prisma";

interface HealthCheckResult {
  status: "ok" | "error";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    db: "ok" | "error";
  };
}

function getVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return process.env.npm_package_version ?? "unknown";
  }
}

export async function GET() {
  const checks: HealthCheckResult["checks"] = { db: "ok" };

  // 检查数据库连接
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    checks.db = "error";
  }

  const isHealthy = checks.db === "ok";

  const result: HealthCheckResult = {
    status: isHealthy ? "ok" : "error",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: getVersion(),
    checks,
  };

  return NextResponse.json(result, { status: isHealthy ? 200 : 503 });
}
