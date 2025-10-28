import React, { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, Heart, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { zodula } from "@/zodula/client";
import { DocStatusBadge } from "../custom/doc-status-badge";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/use-translation";

export interface ListColumn<TDoc extends Record<string, any> = Record<string, any>> {
    key: keyof TDoc | string;
    label: string;
    render?: (doc: TDoc) => React.ReactNode;
    sortable?: boolean;
}

interface ListTableProps<TDoc extends Record<string, any> = Record<string, any>> {
    columns: ListColumn<TDoc>[];
    docs: TDoc[];
    sort?: string;
    order?: "asc" | "desc";
    onSort?: (key: string) => void;
    onRowClick?: (doc: TDoc) => void;
    count?: number;
    selected: Set<string>;
    setSelected: (selected: Set<string>) => void;
    hideDocStatus?: boolean;
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
    hideDocStatus = false
}: ListTableProps<TDoc>) {
    const { t } = useTranslation();
    // Calculate selectAll state based on selected items
    const selectAll = docs.length > 0 && docs.every(doc => selected.has(doc.id));

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(docs.map(doc => doc.id));
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
        <div className="zd:w-full zd:overflow-auto">
            <table className="zd:w-full zd:text-sm">
                <thead>
                    <tr className="zd:text-left">
                        {/* Checkbox column */}
                        <th className="zd:sticky zd:left-0 zd:px-3 zd:py-1 zd:font-medium zd:w-12 zd:bg-muted zd:rounded-l-lg">
                            <Checkbox
                                checked={selectAll}
                                onCheckedChange={handleSelectAll}
                            />
                        </th>
                        {/* Data columns */}
                        {columns.map((col, index) => {
                            const isActive = sort === String(col.key);
                            const isDisplayed = index === 0;
                            // const arrow = isActive ? (order === "asc" ? "▲" : "▼") : "";
                            return (
                                <th key={String(col.key)} className={cn("zd:px-2 zd:py-2 zd:font-medium zd:whitespace-nowrap zd:bg-muted zd:min-w-[100px]", isDisplayed ? "zd:sticky zd:left-11" : "")}>
                                    {col.sortable ? (
                                        <button className="zd:inline-flex zd:items-center zd:gap-1 zd:hover:text-foreground" onClick={() => onSort?.(String(col.key))}>
                                            <span>{col.label}</span>
                                            <span className="zd:text-xs zd:opacity-60">
                                                {isActive && (
                                                    <>
                                                        {order === "asc" && <ChevronUpIcon className="zd:w-4 zd:h-4" />}
                                                        {order === "desc" && <ChevronDownIcon className="zd:w-4 zd:h-4" />}
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
                        <th className={cn(
                            "zd:sticky zd:right-18 zd:px-3 zd:py-1 zd:font-medium zd:text-right zd:bg-muted zd:min-w-[100px]",
                            hideDocStatus ? "zd:right-0" : ""
                        )}>
                            {count ? `${docs.length} of ${count}` : ``}
                        </th>
                        {/* Actions column */}
                        <th className={cn("zd:sticky zd:right-0 zd:px-3 zd:py-1 zd:font-medium zd:w-12 zd:bg-muted zd:rounded-r-lg zd:text-right", hideDocStatus ? "zd:hidden" : "")}>
                            {t("Status")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {docs.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length + 3} className="zd:px-3 zd:py-6 zd:text-center zd:text-muted-foreground">{t("No docs")}</td>
                        </tr>
                    ) : (
                        docs.map((doc, idx) => (
                            <tr key={idx} className="zd:hover:bg-muted/30 zd:cursor-pointer" onClick={() => onRowClick?.(doc)}>
                                {/* Checkbox column */}
                                <td className="zd:z-10 zd:sticky zd:left-0 zd:px-3 zd:py-1 zd:bg-background" onClick={e => e.stopPropagation()}>
                                    <Checkbox
                                        checked={selected.has(doc.id)}
                                        onCheckedChange={(checked) => handleRowSelect(doc.id, checked as boolean)}
                                    />
                                </td>
                                {/* Data columns */}
                                {columns.map((col, index) => {
                                    const isDisplayed = index === 0;
                                    return (
                                        <td key={String(col.key)} className={cn(
                                            "zd:z-10 zd:px-2 zd:py-2 zd:whitespace-nowrap zd:max-w-[200px] zd:bg-background zd:overflow-hidden zd:text-ellipsis",
                                            isDisplayed ? "zd:sticky zd:left-11 zd:bg-background" : ""
                                        )}>
                                            {col.render ? col.render(doc) : (doc as any)[col.key] || <span className="zd:text-muted-foreground zd:italic">-</span>}
                                        </td>
                                    )
                                })}
                                {/* Time/Status column */}
                                <td className={cn(
                                    "zd:sticky zd:right-18 zd:px-2 zd:py-1 zd:bg-background zd:text-right zd:text-sm zd:text-muted-foreground",
                                    hideDocStatus ? "zd:right-0" : ""
                                )}>
                                    <div className="zd:flex zd:items-center zd:justify-end zd:gap-1 zd:whitespace-nowrap">
                                        <span>{doc.updated_at ? zodula.utils.formatTimeAgo(doc.updated_at) : '-'}</span>
                                    </div>
                                </td>
                                {/* Actions column */}
                                <td className={cn("zd:sticky zd:w-12 zd:right-0 zd:px-3 zd:py-3 zd:bg-background", hideDocStatus ? "zd:hidden" : "")}>
                                    <DocStatusBadge status={doc.doc_status || 0} />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}


