"use client";

import { useUser } from "@/lib/hooks";
import { TopBar } from "@/components/TopBar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  // Determine current app name from path
  const appMatch = pathname.match(/^\/app\/([^/]+)/);
  const appName = appMatch ? undefined : undefined;

  // Check if user is tenant admin (has tenant.admin permission or is global admin)
  const isTenantAdmin = user.isGlobalAdmin || user.permissions?.some(
    (p: { key?: string }) => p?.key === "tenant.admin"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        appName={appName}
        user={{
          email: user.email,
          name: user.name,
          isGlobalAdmin: user.isGlobalAdmin,
          isTenantAdmin,
          tenant: user.tenant,
        }}
      />
      <main className="h-[calc(100vh-48px)]">{children}</main>
    </div>
  );
}
