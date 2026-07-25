"use client";

import { AdminSidebar } from "@/components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-48px)]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-gray-50 p-6">{children}</div>
    </div>
  );
}
