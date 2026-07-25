// ============================================================
// POST /api/auth/logout
// 登出（清除 Cookie）
// ============================================================

import { COOKIE_NAME } from "@/lib/auth";
import { success } from "@/lib/api-response";
import { cookies } from "next/headers";

export async function POST() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return success(null, "已登出");
}
