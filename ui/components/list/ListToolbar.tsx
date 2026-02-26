import React from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { FilterPopup } from "./FilterPopup";
import { QuickFilterBar } from "./QuickFilterBar";
import { Filter, ArrowUpDown, X, ArrowUp, ArrowDown, SortDescIcon, SortAscIcon, MoreHorizontal, Settings, FilterXIcon, Columns3CogIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { useTranslation } from "../..";

interface ListToolbarProps {
    hasActiveFilter?: boolean;
    onClearFilter?: () => void;
    searchValue?: string;
    searchPlaceholder?: string;
    onSearchChange?: (value: string) => void;
    onSearch?: (query: string) => void;
    /** Quick filter bar - shown in place of search when provided; search is used as fallback when no quick filter fields */
    quickFilterBar?: React.ReactNode;
    sortFields?: Zodula.Field[];
    sortValue?: string;
    onSortChange?: (value: string) => void;
    orderValue?: "asc" | "desc";
    onOrderChange?: (value: "asc" | "desc") => void;
    // Filter popup props
    filters?: IFilter<any, any, IOperator>[];
    onApplyFilters?: (filters: IFilter<any, any, IOperator>[]) => void;
    filterPopupOpen?: boolean;
    onFilterPopupOpenChange?: (open: boolean) => void;
    // Column settings props
    onColumnSettings?: () => void;
    hasCustomColumns?: boolean;
    // Additional props for FilterPopup
    allFields?: Zodula.Field[];
    doctype?: Zodula.DoctypeName;
    /** When true, filters apply on every change (no Apply button) */
    filterApplyImmediately?: boolean;
}

export function ListToolbar({
    hasActiveFilter = false,
    onClearFilter,
    searchValue = "",
    searchPlaceholder,
    onSearchChange,
    onSearch,
    sortFields = [],
    sortValue = "",
    onSortChange,
    orderValue = "asc",
    onOrderChange,
    // Filter popup props
    filters = [],
    onApplyFilters,
    filterPopupOpen = false,
    onFilterPopupOpenChange,
    // Column settings props
    onColumnSettings,
    hasCustomColumns = false,
    // Additional props for FilterPopup
    allFields = [],
    doctype,
    filterApplyImmediately = false,
    quickFilterBar,
}: ListToolbarProps) {
    const { t } = useTranslation()
    return (
        <div className="zd:flex zd:items-center zd:justify-between zd:gap-3 zd:w-full">
            {/* Left side - QuickFilterBar (replaces search) or search input as fallback */}
            <div className="zd:flex zd:flex-1 zd:items-center zd:gap-2 zd:min-w-0">
                {quickFilterBar ?? (
                    <Input
                        placeholder={searchPlaceholder || `Search By ${t("ID")}`}
                        className="zd:w-full"
                        value={searchValue}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onSearch?.(searchValue);
                            }
                        }}
                    />
                )}
            </div>

            {/* Right side - Filter, Sort, and Last Updated controls */}
            <div className="zd:flex zd:items-center zd:gap-2">
                <FilterPopup
                    fields={allFields.length > 0 ? allFields : sortFields}
                    filters={filters}
                    onApplyFilters={onApplyFilters}
                    onClearFilters={onClearFilter}
                    open={filterPopupOpen}
                    onOpenChange={e => {
                        onFilterPopupOpenChange?.(e);
                    }}
                    doctype={doctype}
                    applyImmediately={filterApplyImmediately}
                />

                {hasActiveFilter && (
                    <Button
                        variant="ghost"
                        onClick={onClearFilter}
                    >
                        <FilterXIcon className="zd:w-4 zd:h-4 zd:text-destructive" />
                    </Button>
                )}

                {/* Sort Field Selector */}
                {sortFields && sortFields.length > 0 && (
                    <Select
                        options={sortFields.map(field => ({
                            value: field.name || "",
                            label: t(field.label || field.name || "")
                        }))}
                        value={sortValue}
                        onChange={onSortChange}
                        placeholder="Sort by..."
                        className="zd:w-32"
                        displayMode="label"
                    />
                )}
                <Button variant="outline" className="zd:w-8 zd:h-8 zd:p-0" onClick={() => onOrderChange?.(orderValue === "asc" ? "desc" : "asc")}>
                    {orderValue === "asc" ? <SortAscIcon className="zd:w-4 zd:h-4" /> : <SortDescIcon className="zd:w-4 zd:h-4" />}
                </Button>

                {/* Column Settings Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="zd:relative zd:w-8 zd:h-8 zd:p-0">
                            <Settings className="zd:w-4 zd:h-4" />
                            {hasCustomColumns && (
                                <div className="zd:absolute zd:right-0 zd:top-0 zd:w-2 zd:h-2 zd:bg-amber-500 zd:rounded-full"></div>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onColumnSettings} className="zd:flex zd:items-center zd:gap-2">
                            <Columns3CogIcon className="zd:h-4 zd:w-4" />
                            {t("Column Settings")}
                            {hasCustomColumns && (
                                <div className="zd:absolute zd:right-0 zd:top-0 zd:w-2 zd:h-2 zd:bg-amber-500 zd:rounded-full"></div>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
        </div>
    );
}


