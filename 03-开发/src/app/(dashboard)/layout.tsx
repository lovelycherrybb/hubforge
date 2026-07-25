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
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  // Determine current app name from path
  const appMatch = pathname.match(/^\/app\/([^/]+)/);
  const appName = appMatch ? undefined : undefined; // Will be set by child page via context later

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        appName={appName}
        user={{
          email: user.email,
          name: user.name,
          isGlobalAdmin: user.isGlobalAdmin,
        }}
      />
      <main className="h-[calc(100vh-48px)]">{children}</main>
    </div>
  );
}
