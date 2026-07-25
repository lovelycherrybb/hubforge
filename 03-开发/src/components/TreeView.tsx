"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

interface TreeViewProps {
  data: TreeNode[];
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
  className?: string;
}

function TreeNodeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm",
          isSelected
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-700 hover:bg-gray-100"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-400"
          >
            <svg
              className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 h-4" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({ data, selectedId, onSelect, className }: TreeViewProps) {
  return (
    <div className={cn("select-none", className)}>
      {data.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export type { TreeNode };
