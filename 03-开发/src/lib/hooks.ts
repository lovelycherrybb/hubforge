"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  tenantId: string;
  isGlobalAdmin: boolean;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: User }>("/api/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, refetch: fetchUser };
}
