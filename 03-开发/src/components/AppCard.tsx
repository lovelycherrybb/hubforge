"use client";

import { Badge } from "./Badge";
import { Card } from "./Card";

interface App {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  type: "PC" | "H5" | "both";
}

interface AppCardProps {
  app: App;
  onClick?: () => void;
}

export function AppCard({ app, onClick }: AppCardProps) {
  return (
    <Card hover onClick={onClick} className="p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-2xl shrink-0">
          {app.icon || "📦"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
            {app.type === "PC" && <Badge variant="pc">PC</Badge>}
            {app.type === "H5" && <Badge variant="h5">H5</Badge>}
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
