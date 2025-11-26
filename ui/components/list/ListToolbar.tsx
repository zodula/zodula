import React from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { FilterPopup } from "./FilterPopup";
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
    hasCustomColumns = false
}: ListToolbarProps) {
    const { t } = useTranslation()
    return (
        <div className="zd:flex zd:items-center zd:justify-between zd:gap-3">
            {/* Left side - ID search field */}
            <div className="zd:flex zd:items-center zd:gap-2">
                <Input
                    // placeholder is search from display fields
                    placeholder={searchPlaceholder || "Search By ID"}
                    className="zd:w-full"
                    value={searchValue}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onSearch?.(searchValue);
                        }
                    }}
                />
            </div>

            {/* Right side - Filter, Sort, and Last Updated controls */}
            <div className="zd:flex zd:items-center zd:gap-2">
                <FilterPopup
                    fields={sortFields}
                    filters={filters}
                    onApplyFilters={onApplyFilters}
                    onClearFilters={onClearFilter}
                    open={filterPopupOpen}
                    onOpenChange={e => {
                        onFilterPopupOpenChange?.(e);
                    }}
                />

                {hasActiveFilter && (
                    <Button
                        variant="destructive"
                        onClick={onClearFilter}
                    >
                        <FilterXIcon className="zd:w-4 zd:h-4" />
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
                        <Button variant="outline" className="zd:w-8 zd:h-8 zd:p-0">
                            <Settings className="zd:w-4 zd:h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onColumnSettings} className="zd:flex zd:items-center zd:gap-2">
                            <Columns3CogIcon className="zd:h-4 zd:w-4" />
                            {t("Column Settings")}
                            {hasCustomColumns && (
                                <div className="zd:ml-auto zd:w-2 zd:h-2 zd:bg-amber-500 zd:rounded-full"></div>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
        </div>
    );
}


