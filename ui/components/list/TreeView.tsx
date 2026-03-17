import React, { useState } from "react";
import { ChevronRight, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TreeNode<T = Record<string, any>> {
  doc: T;
  children: TreeNode<T>[];
}

export interface TreeViewColumn {
  key: string;
  label: string;
}

interface TreeViewProps<T extends Record<string, any>> {
  nodes: TreeNode<T>[];
  displayField: string;
  displayLabel?: string;
  getDocId: (doc: T) => string;
  columns?: TreeViewColumn[];
  onRowClick?: (doc: T) => void;
  renderCell?: (doc: T, key: string) => React.ReactNode;
  className?: string;
}

const EXPANDED_STORAGE_KEY_PREFIX = "zodula-tree-expanded-";

export function TreeView<T extends Record<string, any>>({
  nodes,
  displayField,
  displayLabel = "ID",
  getDocId,
  columns = [],
  onRowClick,
  renderCell,
  className,
}: TreeViewProps<T>) {
  const storageKey = `${EXPANDED_STORAGE_KEY_PREFIX}${typeof window !== "undefined" ? window.location.pathname : "default"}`;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const renderNode = (node: TreeNode<T>, level: number) => {
    const doc = node.doc;
    const id = getDocId(doc);
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(id);
    const displayValue = doc[displayField] ?? doc.id ?? id;

    return (
      <div key={id} className="zd:flex zd:flex-col">
        <div
          className={cn(
            "zd:flex zd:items-center zd:gap-1 zd:py-1.5 zd:px-2 zd:hover:bg-muted/50 zd:rounded-md zd:cursor-default zd:group zd:border-l-2 zd:border-transparent hover:zd:border-primary/30",
            "zd:min-w-0"
          )}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(id);
            }
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(id);
              }}
              className="zd:p-0.5 zd:hover:bg-muted zd:rounded zd:shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
              ) : (
                <ChevronRight className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="zd:w-5 zd:inline-block zd:shrink-0" />
          )}
          <span className="zd:flex-1 zd:truncate zd:font-medium zd:min-w-0">
            {String(displayValue)}
          </span>
          {columns.map((col) => (
            <span
              key={col.key}
              className="zd:shrink-0 zd:px-3 zd:text-right zd:whitespace-nowrap zd:min-w-[100px]"
            >
              {renderCell
                ? renderCell(doc, col.key)
                : doc[col.key] != null
                  ? String(doc[col.key])
                  : "-"}
            </span>
          ))}
          {onRowClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRowClick(doc);
              }}
              className="zd:ml-1 zd:p-0.5 zd:hover:bg-muted zd:rounded zd:shrink-0 zd:cursor-pointer"
            >
              <ArrowRight className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="zd:flex zd:flex-col">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "zd:w-full zd:overflow-auto zd:rounded zd:border zd:bg-background zd:min-h-[50vh]",
        className
      )}
    >
      {nodes.length === 0 ? (
        <div className="zd:p-8 zd:text-center zd:text-muted-foreground zd:text-sm">
          No records
        </div>
      ) : (
        <div className="zd:flex zd:flex-col">
          {/* Header row - flex layout matching data rows (align with level-0 row: pl-2 + indent) */}
          <div className="zd:flex zd:items-center zd:gap-1 zd:py-2 zd:px-2 zd:border-b zd:border-dashed zd:bg-muted/30 zd:font-medium zd:text-sm">
            <span className="zd:w-5 zd:shrink-0" />
            <span className="zd:flex-1 zd:truncate zd:min-w-0">{displayLabel}</span>
            {columns.map((col) => (
              <span
                key={col.key}
                className="zd:shrink-0 zd:px-3 zd:text-right zd:whitespace-nowrap zd:min-w-[100px] zd:text-muted-foreground"
              >
                {col.label}
              </span>
            ))}
            {onRowClick && <span className="zd:w-6 zd:shrink-0" />}
          </div>
          <div className="zd:py-1">{nodes.map((node) => renderNode(node, 0))}</div>
        </div>
      )}
    </div>
  );
}
