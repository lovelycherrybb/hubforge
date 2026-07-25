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
  tenant?: { id: string; name: string; slug: string };
  department?: { id: string; name: string } | null;
  permissions?: { key: string; label: string }[];
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
