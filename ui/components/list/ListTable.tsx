import React, { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Heart,
  MessageCircle,
  SearchIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { zodula } from "@/zodula/client";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/use-translation";

export interface ListColumn<
  TDoc extends Record<string, any> = Record<string, any>,
> {
  key: keyof TDoc | string;
  label: string;
  render?: (doc: TDoc) => React.ReactNode;
  sortable?: boolean;
}

interface ListTableProps<
  TDoc extends Record<string, any> = Record<string, any>,
> {
  columns: ListColumn<TDoc>[];
  docs: TDoc[];
  sort?: string;
  order?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (doc: TDoc) => void;
  count?: number;
  selected: Set<string>;
  setSelected: (selected: Set<string>) => void;
}

export function ListTable<TDoc extends Record<string, any>>({
  columns,
  docs,
  sort,
  order,
  onSort,
  onRowClick,
  count,
  selected,
  setSelected,
}: ListTableProps<TDoc>) {
  const { t } = useTranslation();
  // Calculate selectAll state based on selected items
  const selectAll =
    docs.length > 0 && docs.every((doc) => selected.has(doc.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(docs.map((doc) => doc.id));
      setSelected(allIds);
    } else {
      setSelected(new Set());
    }
  };

  const handleRowSelect = (docId: string, checked: boolean) => {
    const newSelected = new Set(selected);
    if (checked) {
      newSelected.add(docId);
    } else {
      newSelected.delete(docId);
    }
    setSelected(newSelected);
  };
  return (
    <div className="zd:w-full zd:overflow-auto zd:shadow zd:rounded zd:border zd:min-h-[50vh]">
      <table className="zd:w-full zd:text-sm">
        <thead className="zd:border-b zd:border-dashed">
          <tr className="zd:text-left">
            {/* Checkbox column */}
            <th className="zd:px-3 zd:py-1 zd:font-medium zd:w-12 zd:pl-5">
              <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
            </th>
            {/* Data columns */}
            {columns.map((col, index) => {
              const isActive = sort === String(col.key);
              // const arrow = isActive ? (order === "asc" ? "▲" : "▼") : "";
              return (
                <th
                  key={String(col.key)}
                  className={cn(
                    "zd:px-2 zd:py-2 zd:font-medium zd:whitespace-nowrap zd:min-w-[100px]",
                  )}
                >
                  {col.sortable ? (
                    <button
                      className="zd:inline-flex zd:items-center zd:gap-1 zd:hover:text-foreground"
                      onClick={() => onSort?.(String(col.key))}
                    >
                      <span>{col.label}</span>
                      <span className="zd:text-xs zd:opacity-60">
                        {isActive && (
                          <>
                            {order === "asc" && (
                              <ChevronUpIcon className="zd:w-4 zd:h-4" />
                            )}
                            {order === "desc" && (
                              <ChevronDownIcon className="zd:w-4 zd:h-4" />
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </th>
              );
            })}
            {/* Count column */}
            <th
              className="zd:px-3 zd:py-1 zd:font-medium zd:text-right zd:min-w-[100px] zd:group-hover:bg-muted/30 zd:pr-5"
            >
              {count ? `${docs.length} of ${count}` : ` 0 of 0`}
            </th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="zd:px-3 zd:py-6 zd:text-center zd:text-muted-foreground"
              >
                <div className="zd:flex zd:items-center zd:justify-center zd:gap-2">
                  <SearchIcon className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                  {t("No docs")}
                </div>
              </td>
            </tr>
          ) : (
            docs.map((doc, idx) => (
              <tr
                key={idx}
                className="zd:group zd:h-10 zd:hover:bg-muted/30 zd:cursor-pointer"
                onClick={() => onRowClick?.(doc)}
              >
                {/* Checkbox column */}
                <td
                  className={cn(
                    "zd:px-3 zd:py-1 zd:pl-5",
                    "zd:group-hover:bg-muted/30"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selected.has(doc.id)}
                    onCheckedChange={(checked) =>
                      handleRowSelect(doc.id, checked as boolean)
                    }
                  />
                </td>
                {/* Data columns */}
                {columns.map((col, index) => {
                  const isDisplayField = index === 0;
                  const Render = col.render as any;
                  const isUndefined = doc[col.key] === undefined;
                  return (
                    <td
                      key={String(col.key)}
                      className={cn(
                        "zd:z-10 zd:px-2 zd:py-2 zd:whitespace-nowrap zd:max-w-[200px] zd:overflow-hidden zd:text-ellipsis",
                      )}
                    >
                      {(isUndefined || !Render) ? (
                        <span className="zd:text-muted-foreground zd:italic">{!Render ? "" : "Hidden"}</span>
                      ) : (
                        <Render {...doc} />
                      )}
                    </td>
                  );
                })}
                {/* Time column */}
                <td
                  className="zd:px-3 zd:py-1 zd:text-right zd:text-sm zd:text-muted-foreground zd:pr-5"
                >
                  <div className="zd:flex zd:items-center zd:justify-end zd:gap-1 zd:whitespace-nowrap">
                    <span>
                      {doc.updated_at
                        ? zodula.utils.formatTimeAgo(doc.updated_at)
                        : "-"}
                    </span>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
