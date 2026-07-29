import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "华检科 HubForge — 质量安全领域的AI应用门户",
  description:
    "一站式管理检测、监测、巡检、报告全流程。AI让检测更智能。",
  openGraph: {
    title: "华检科 HubForge",
    description: "质量安全领域的AI应用门户",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${inter.className} bg-[#0a0a15] text-white`}>
        {children}
      </body>
    </html>
  );
}
