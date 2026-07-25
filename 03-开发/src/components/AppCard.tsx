"use client";

import { Badge } from "./Badge";
import { Card } from "./Card";

interface App {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  type: "pc" | "h5" | "both";
}

interface AppCardProps {
  app: App;
  onClick?: () => void;
  tintIndex?: number;
}

const tints = [
  "hover:border-[#1a1a2e]/30",
  "hover:border-[#0f3460]/30",
  "hover:border-[#e94560]/20",
  "hover:border-[#533483]/20",
  "hover:border-[#2b9348]/20",
  "hover:border-[#e76f51]/20",
];

const iconBgs = [
  "bg-[#1a1a2e]/5",
  "bg-[#0f3460]/5",
  "bg-[#e94560]/5",
  "bg-[#533483]/5",
  "bg-[#2b9348]/5",
  "bg-[#e76f51]/5",
];

export function AppCard({ app, onClick, tintIndex = 0 }: AppCardProps) {
  const tint = tints[tintIndex % tints.length];
  const iconBg = iconBgs[tintIndex % iconBgs.length];

  return (
    <Card hover onClick={onClick} className={`p-5 border transition-all duration-200 ${tint}`}>
      <div className="flex items-start gap-4">
        <div
          className={`w-11 h-11 rounded-lg ${iconBg} flex items-center justify-center text-xl shrink-0`}
        >
          {app.icon || "📦"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[#333] truncate">{app.name}</h3>
            {app.type === "pc" && <Badge variant="pc">PC</Badge>}
            {app.type === "h5" && <Badge variant="h5">H5</Badge>}
            {app.type === "both" && (
              <>
                <Badge variant="pc">PC</Badge>
                <Badge variant="h5">H5</Badge>
              </>
            )}
          </div>
          {app.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{app.description}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export type { App };
