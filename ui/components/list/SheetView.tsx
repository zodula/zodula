import React, { useMemo, useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useDocList } from "../../hooks/use-doc-list";
import { useDoc } from "../../hooks/use-doc";
import { ListToolbar } from "./ListToolbar";
import type { ListColumn } from "./ListTable";
import { Button } from "../ui/button";
import { useRouter } from "../router";
import { popup } from "../ui/popit";
import { ColumnSettingsDialog } from "../dialogs/column-settings-dialog";
import { ColumnSelectDialog } from "../dialogs/column-select-dialog";
import { zodula } from "@/zodula/client";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useTranslation } from "../../hooks/use-translation";
import { Checkbox } from "../ui/checkbox";
import { cn } from "../../lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FolderPlus,
  GripVertical,
  Copy,
  X,
  MoreVertical,
  Plus,
} from "lucide-react";
import { Select } from "../ui/select";
import { toast } from "../ui/toast";
import {
  useSheetView,
  type AggregateFunction,
  type AggregationConfig,
} from "../../hooks/use-sheet-view";
import { useColumnDnd } from "../../hooks/use-column-dnd";
import { useColumnSettings } from "../../hooks/use-column-settings";
import { useColumnResize } from "../../hooks/use-column-resize";
import { useParams } from "react-router";

// Table header cell component that uses the resize hook
interface TableHeaderCellProps {
  col: ListColumn;
  index: number;
  isActive: boolean;
  columnKey: string;
  columnWidth: number;
  sort: string | null;
  order: "asc" | "desc" | null;
  onSort?: (field: string) => void;
  dragProps: any;
  dropZoneProps: any;
  dropZoneClassName: string;
  onAddColumnBefore: (columnKey: string) => void;
  onAddColumnAfter: (columnKey: string) => void;
  onRemoveColumn: (columnKey: string) => void;
  onResize: (columnKey: string, width: number) => void;
  t: (key: string) => string;
}

function TableHeaderCell({
  col,
  index,
  isActive,
  columnKey,
  columnWidth,
  sort,
  order,
  onSort,
  dragProps,
  dropZoneProps,
  dropZoneClassName,
  onAddColumnBefore,
  onAddColumnAfter,
  onRemoveColumn,
  onResize,
  t,
}: TableHeaderCellProps) {
  const isFirstColumn = index === 0;
  const { handleResizeStart } = useColumnResize({
    columnKey,
    currentWidth: columnWidth,
    onResize,
    minWidth: 240,
  });

  return (
    <th
      {...dragProps}
      {...dropZoneProps}
      className={cn(
        "zd:relative zd:group zd:px-2 zd:py-1.5 zd:font-medium zd:whitespace-nowrap zd:bg-muted zd:border-b zd:border-r zd:border-border zd:select-none",
        "zd:cursor-grab zd:active:cursor-grabbing",
        dropZoneClassName
      )}
      style={{
        width: columnWidth,
        minWidth: columnWidth,
        maxWidth: columnWidth,
      }}
    >
      <div className="zd:flex zd:items-center zd:gap-1">
        {col.sortable ? (
          <button
            className="zd:flex-1 zd:inline-flex zd:items-center zd:gap-1 zd:hover:text-foreground zd:text-left zd:cursor-grab zd:active:cursor-grabbing"
            onClick={() => onSort?.(columnKey)}
          >
            <span className="zd:truncate">{col.label}</span>
            <span className="zd:text-xs zd:opacity-60 zd:flex-shrink-0">
              {isActive && (
                <>
                  {order === "asc" && (
                    <ChevronUpIcon className="zd:w-3 zd:h-3" />
                  )}
                  {order === "desc" && (
                    <ChevronDownIcon className="zd:w-3 zd:h-3" />
                  )}
                </>
              )}
            </span>
          </button>
        ) : (
          <span className="zd:flex-1 zd:truncate">{col.label}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              title={t("Column Menu")}
            >
              <MoreVertical className="zd:w-3 zd:h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAddColumnBefore(columnKey)}>
              <Plus className="zd:mr-2 zd:h-4 zd:w-4" />
              {t("Add Column Before")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddColumnAfter(columnKey)}>
              <Plus className="zd:mr-2 zd:h-4 zd:w-4" />
              {t("Add Column Next To")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemoveColumn(columnKey)}
              className="zd:text-destructive"
            >
              <X className="zd:mr-2 zd:h-4 zd:w-4" />
              {t("Remove Column")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Resize handle */}
      <div
        className="zd:absolute zd:top-0 zd:right-0 zd:w-1 zd:h-full zd:cursor-col-resize zd:hover:bg-blue-500 zd:z-30"
        onMouseDown={handleResizeStart}
      />
    </th>
  );
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface SheetViewProps {
  doctype: string;
  title?: string;
  columns?: ListColumn[];
  docs: any[];
  count: number;
  loading: boolean;
  error: string | null;
  limit: number | null;
  sort: string | null;
  order: "asc" | "desc" | null;
  searchQuery: string | null;
  filters: IFilter<any, any, IOperator>[] | null;
  fields: any[];
  onLimitChange: (newLimit: number | null) => void;
  onSort: (field: string) => void;
  onSortChange: (field: string) => void;
  onOrderChange: (newOrder: "asc" | "desc" | null) => void;
  onSearch: (query: string | null) => void;
  onApplyFilters: (newFilters: IFilter<any, any, IOperator>[]) => void;
  onClearFilter: () => void;
  selected: Set<string>;
  setSelected: (selected: Set<string>) => void;
  hideDocStatus?: boolean;
}

/** Escape a value for CSV (wrap in quotes if contains comma, newline, or quote). */
function escapeCsvValue(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[,\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface SheetViewExportHandle {
  exportCSV(): void;
}

export const SheetView = forwardRef<SheetViewExportHandle | null, SheetViewProps>(function SheetView(
  {
    doctype,
    title,
    columns,
    docs,
    count,
    loading,
    error,
    limit,
    sort,
    order,
    searchQuery,
    filters,
    fields,
    onLimitChange,
    onSort,
    onSortChange,
    onOrderChange,
    onSearch,
    onApplyFilters,
    onClearFilter,
    selected,
    setSelected,
    hideDocStatus = false,
  },
  ref
) {
  const { push } = useRouter();
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const { org } = useParams();

  // Sheet view state management
  const sheetView = useSheetView(doctype);
  const [aggregationPopupOpen, setAggregationPopupOpen] = useState(false);
  // Pending aggregation config (only applied on Apply button)
  const [pendingAggregationConfig, setPendingAggregationConfig] =
    useState<AggregationConfig>(sheetView.aggregationConfig);

  // Sync pending config when popup opens
  useEffect(() => {
    if (aggregationPopupOpen) {
      setPendingAggregationConfig(sheetView.aggregationConfig);
    }
  }, [aggregationPopupOpen, sheetView.aggregationConfig]);

  // Get doctype schema to determine columns
  const { doc: doctypeDoc } = useDoc({
    doctype: "Doctype",
    id: doctype,
  });

  const [hasActiveFilter, setHasActiveFilter] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [contextMenuCellValue, setContextMenuCellValue] = useState<any>(null);

  // Cell selection state (Excel-like)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{
    rowIdx: number;
    colKey: string;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{
    rowIdx: number;
    colKey: string;
  } | null>(null);
  const justFinishedDragRef = useRef(false);

  // Update search input when searchQuery prop changes
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Update hasActiveFilter based on filters and search query
  useEffect(() => {
    setHasActiveFilter(!!searchQuery || (filters?.length ?? 0) > 0);
  }, [searchQuery, filters]);

  // Get all available columns (all fields, not just list view fields)
  const allAvailableColumns: ListColumn[] = useMemo(() => {
    if (!doctypeDoc || !fields.length) {
      // Fallback: infer columns from first doc keys
      const sample = docs[0] || {};
      return Object.keys(sample)
        .slice(0, 6)
        .map((key) => ({
          key,
          label: key,
          sortable: true,
        }));
    }

    // Create columns from ALL fields, not just list view fields
    const cols: ListColumn[] = [];

    // First column: display field or id
    const displayField = (doctypeDoc as any).display_field || "id";

    cols.push({
      key: displayField,
      label: displayField === "id" ? "ID" : displayField,
      sortable: true,
    });

    // Add ALL fields (not just in_list_view fields)
    fields.forEach((field: any) => {
      if (ClientFieldHelper.isStandardField(field.name)) return;
      if (ClientFieldHelper.isLayoutField(field)) return;
      if (field.name !== displayField) {
        cols.push({
          key: field.name,
          label: field.label || field.name,
          sortable: field.type !== "Reference Table" && field.type !== "Extend",
        });
      }
    });

    return cols;
  }, [docs, columns, doctypeDoc, fields]);

  // Get default columns (system defined - only in_list_view and required fields)
  const defaultColumns = useMemo(() => {
    if (!doctypeDoc || !fields.length) {
      return allAvailableColumns.map((col) => col.key);
    }

    const displayField = (doctypeDoc as any).display_field || "id";
    const defaultCols = [displayField];

    // Add fields that are in_list_view or required (system default behavior)
    fields.forEach((field: any) => {
      if (
        field.name !== displayField &&
        (field.in_list_view === 1 || field.required === 1) &&
        !zodula.utils.isStandardField(field.name)
      ) {
        defaultCols.push(field.name);
      }
    });

    return defaultCols;
  }, [doctypeDoc, fields, allAvailableColumns]);

  // Use shared column settings hook with validation
  const columnSettings = useColumnSettings(
    doctype,
    defaultColumns,
    allAvailableColumns
  );
  const {
    visibleColumns,
    hasCustomColumns,
    setVisibleColumns,
    setHasCustomColumns,
    resetVisibleColumns,
  } = columnSettings;

  // Initialize column order on mount or when visibleColumns changes
  useEffect(() => {
    if (!visibleColumns || visibleColumns.length === 0) return;

    // Check if any column is missing order
    const needsInitialization = visibleColumns.some((colKey) => {
      const config = sheetView.getColumnConfig(colKey);
      return !config || config.order === undefined;
    });

    if (needsInitialization) {
      // Initialize order based on visibleColumns order
      sheetView.setColumnOrder(visibleColumns);
    }
  }, [visibleColumns, sheetView]);

  // Filter and order columns based on visible columns and configs
  // When aggregating, show only necessary columns (groupBy + aggregated column)
  const derivedColumns: ListColumn[] = useMemo(() => {
    const aggregationConfig = sheetView.aggregationConfig;

    // If aggregating, show only the necessary columns
    if (aggregationConfig.groupBy) {
      const columns: ListColumn[] = [];

      // 1. Group By column
      const groupByColumn = allAvailableColumns.find(
        (col) => String(col.key) === aggregationConfig.groupBy
      );
      if (groupByColumn) {
        columns.push({
          ...groupByColumn,
          label: t(groupByColumn.label || String(groupByColumn.key) || ""),
        });
      }

      // 2. Aggregated column
      if (aggregationConfig.aggregateField) {
        // Sum or Average: show "Sum of [field]" or "Average of [field]"
        const aggregateColumn = allAvailableColumns.find(
          (col) => String(col.key) === aggregationConfig.aggregateField
        );
        if (aggregateColumn) {
          const functionLabel = t(aggregationConfig.aggregateFunction);
          const fieldLabel = t(
            aggregateColumn.label || String(aggregateColumn.key) || ""
          );
          columns.push({
            ...aggregateColumn,
            label: `${functionLabel} of ${fieldLabel}`,
          });
        }
      } else {
        // Count only: show "Count" column
        columns.push({
          key: "_count",
          label: t("Count"),
          sortable: false,
        });
      }

      return columns;
    }

    // Normal view: use visible columns
    if (!visibleColumns || visibleColumns.length === 0) return [];

    const filtered = allAvailableColumns.filter((col) =>
      visibleColumns.includes(String(col.key))
    );

    // Sort by order from column configs, ensuring order matches visibleColumns
    const sorted = [...filtered].sort((a, b) => {
      const aKey = String(a.key);
      const bKey = String(b.key);
      const aIndex = visibleColumns.indexOf(aKey);
      const bIndex = visibleColumns.indexOf(bKey);

      // If index is -1 (shouldn't happen, but handle gracefully), use a large number
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      // Primary sort: use stored order if available, otherwise use visibleColumns index
      const aConfig = sheetView.getColumnConfig(aKey);
      const bConfig = sheetView.getColumnConfig(bKey);
      const aOrder = aConfig?.order ?? aIndex;
      const bOrder = bConfig?.order ?? bIndex;

      // If orders are equal, fall back to visibleColumns index to maintain stability
      if (aOrder === bOrder) {
        return aIndex - bIndex;
      }

      return aOrder - bOrder;
    });

    return sorted.map((col) => ({
      ...col,
      label: t(col.label || col.key || ""),
    }));
  }, [allAvailableColumns, visibleColumns, sheetView, t]);

  // Keep latest data for imperative exportCSV
  const exportDataRef = useRef({
    docs: [] as any[],
    selected: new Set<string>(),
    columnKeys: [] as string[],
    aggregationConfig: null as { groupBy: string | null; aggregateField: string | null } | null,
    aggregatedData: [] as any[],
    derivedColumnKeys: [] as string[],
  });
  useEffect(() => {
    exportDataRef.current = {
      docs,
      selected,
      columnKeys: visibleColumns && visibleColumns.length > 0 ? [...visibleColumns] : [],
      aggregationConfig: sheetView.aggregationConfig,
      aggregatedData: [],
      derivedColumnKeys: [],
    };
  }, [docs, selected, visibleColumns, sheetView.aggregationConfig]);

  useImperativeHandle(
    ref,
    () => ({
      exportCSV() {
        const ref = exportDataRef.current;
        const aggConfig = ref.aggregationConfig;

        if (aggConfig?.groupBy && ref.aggregatedData.length > 0) {
          // Export aggregated view (e.g. Customer + Count), not underlying records
          const cols = ref.derivedColumnKeys;
          if (cols.length === 0) return;
          const header = cols.map((k) => escapeCsvValue(k)).join(",");
          const rows = ref.aggregatedData.map((doc: any) => {
            return cols
              .map((colKey) => {
                let cellValue: any;
                if (doc._isAggregated) {
                  if (colKey === "_count") cellValue = doc._count;
                  else if (
                    aggConfig.aggregateField &&
                    colKey === aggConfig.aggregateField
                  )
                    cellValue = doc[colKey];
                  else if (aggConfig.groupBy && colKey === aggConfig.groupBy)
                    cellValue = doc[colKey];
                  else cellValue = null;
                } else {
                  cellValue = doc[colKey];
                }
                return escapeCsvValue(cellValue);
              })
              .join(",");
          });
          const csv = [header, ...rows].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${doctype}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          toast.success(t("CSV exported"));
          return;
        }

        // No aggregation: export selected records with visible columns
        const { docs: d, selected: sel, columnKeys: cols } = ref;
        if (cols.length === 0) return;
        const selectedDocs = d.filter((doc) => sel.has(doc.id));
        if (selectedDocs.length === 0) return;
        const header = cols.map((k) => escapeCsvValue(k)).join(",");
        const dataRows = selectedDocs.map((doc) =>
          cols.map((key) => escapeCsvValue(doc[key])).join(",")
        );
        const csv = [header, ...dataRows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${doctype}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success(t("CSV exported"));
      },
    }),
    [doctype, t]
  );

  // Get available sort fields from columns - pass full field metadata for FilterPopup
  const sortFields = useMemo(() => {
    return fields.filter(
      (field: Zodula.Field) =>
        field.type !== "Reference Table" && field.type !== "Extend"
    );
  }, [fields]);

  // Get numeric fields for aggregation
  const numericFields = useMemo(() => {
    return fields.filter((field: Zodula.Field) =>
      zodula.utils.isNumericField(field)
    );
  }, [fields]);

  // Apply aggregation to data (use applied config, not pending)
  const aggregatedData = useMemo(() => {
    const aggregationConfig = sheetView.aggregationConfig;
    if (!aggregationConfig.groupBy) {
      return docs;
    }

    const grouped = docs.reduce(
      (acc, doc) => {
        const groupKey = String(doc[aggregationConfig.groupBy!] || "null");
        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(doc);
        return acc;
      },
      {} as Record<string, any[]>
    );

    const aggregatedRows = Object.entries(grouped).map(
      ([groupKey, groupDocs]) => {
        const groupDocsList = groupDocs as any[];
        const firstDoc = groupDocsList[0];
        const result: any = {
          ...firstDoc,
          _isAggregated: true,
          _groupKey: groupKey,
          _docIds: groupDocsList.map((d: any) => d.id).filter(Boolean),
        };

        if (aggregationConfig.aggregateField) {
          const values = groupDocsList
            .map((doc: any) => {
              const val = doc[aggregationConfig.aggregateField!];
              return typeof val === "number"
                ? val
                : parseFloat(String(val)) || 0;
            })
            .filter((v: number) => !isNaN(v));

          if (values.length > 0) {
            switch (aggregationConfig.aggregateFunction) {
              case "Count":
                result[aggregationConfig.aggregateField!] = groupDocsList.length;
                break;
              case "Sum":
                result[aggregationConfig.aggregateField!] = values.reduce(
                  (a: number, b: number) => a + b,
                  0
                );
                break;
              case "Average":
                result[aggregationConfig.aggregateField!] =
                  values.reduce((a: number, b: number) => a + b, 0) /
                  values.length;
                break;
            }
          }
        } else {
          // Count only - store in a special field
          result._count = groupDocsList.length;
        }

        return result;
      }
    );

    // Add Totals row (like Frappe)
    if (aggregatedRows.length > 0) {
      const totalsRow: any = { _isAggregated: true, _isTotals: true };
      const groupByField = aggregationConfig.groupBy!;

      // Set group by field to "Totals"
      totalsRow[groupByField] = t("Totals");

      if (aggregationConfig.aggregateField) {
        const totalValues = aggregatedRows
          .map((row: any) => {
            const val = row[aggregationConfig.aggregateField!];
            return typeof val === "number" ? val : parseFloat(String(val)) || 0;
          })
          .filter((v: number) => !isNaN(v));

        if (totalValues.length > 0) {
          switch (aggregationConfig.aggregateFunction) {
            case "Count":
              // For Count, sum all the counts from aggregated rows
              totalsRow[aggregationConfig.aggregateField!] =
                aggregatedRows.reduce(
                  (sum: number, row: any) =>
                    sum + (row[aggregationConfig.aggregateField!] || 0),
                  0
                );
              break;
            case "Sum":
              // For Sum, sum all the aggregated values
              totalsRow[aggregationConfig.aggregateField!] = totalValues.reduce(
                (a: number, b: number) => a + b,
                0
              );
              break;
            case "Average":
              // For Average, calculate average of all aggregated averages
              const sum = totalValues.reduce(
                (a: number, b: number) => a + b,
                0
              );
              totalsRow[aggregationConfig.aggregateField!] =
                sum / totalValues.length;
              break;
          }
        }
      } else {
        // Count totals - sum all counts from aggregated rows
        totalsRow._count = aggregatedRows.reduce(
          (sum: number, row: any) => sum + (row._count || 0),
          0
        );
      }

      return [...aggregatedRows, totalsRow];
    }

    return aggregatedRows;
  }, [docs, sheetView.aggregationConfig, t]);

  // Keep ref in sync for exportCSV when in aggregation mode
  useEffect(() => {
    exportDataRef.current.aggregatedData = aggregatedData;
    exportDataRef.current.derivedColumnKeys = derivedColumns.map((c) =>
      String(c.key)
    );
    exportDataRef.current.aggregationConfig = sheetView.aggregationConfig;
  }, [aggregatedData, derivedColumns, sheetView.aggregationConfig]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== searchQuery) {
        onSearch(searchInput);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchQuery, onSearch]);

  const handleFilterPopupOpenChange = (open: boolean) => {
    setFilterPopupOpen(open);
  };

  const handleClearFilter = () => {
    setHasActiveFilter(false);
    onClearFilter();
    setSearchInput("");
  };

  const handleRowClick = (doc: any) => {
    // Removed navigation - allow drag or click cell for actions instead
    // Navigation can be done via context menu or other actions
  };

  // Get cell key from row index and column key
  const getCellKey = (rowIdx: number, colKey: string) => `${rowIdx}-${colKey}`;

  // Handle cell selection
  const handleCellMouseDown = (
    e: React.MouseEvent,
    rowIdx: number,
    colKey: string,
    doc: any
  ) => {
    // Don't start selection on right-click (button 2) - let context menu handle it
    if (e.button === 2) {
      return;
    }

    // Don't start selection if clicking on checkbox
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('input[type="checkbox"]')
    ) {
      return;
    }

    e.preventDefault();
    const cellKey = getCellKey(rowIdx, colKey);

    // If clicking on an already selected cell, clear selection
    if (selectedCells.has(cellKey) && selectedCells.size === 1) {
      setSelectedCells(new Set());
      setIsSelecting(false);
      return;
    }

    setSelectionStart({ rowIdx, colKey });
    setSelectionEnd({ rowIdx, colKey });
    setIsSelecting(true);
    setSelectedCells(new Set([cellKey]));
  };

  const handleCellMouseEnter = (rowIdx: number, colKey: string, doc: any) => {
    if (!isSelecting || !selectionStart) return;

    setSelectionEnd({ rowIdx, colKey });

    // Calculate selected cells in range
    const startRow = Math.min(selectionStart.rowIdx, rowIdx);
    const endRow = Math.max(selectionStart.rowIdx, rowIdx);
    const startColIdx = derivedColumns.findIndex(
      (col) => String(col.key) === selectionStart.colKey
    );
    const endColIdx = derivedColumns.findIndex(
      (col) => String(col.key) === colKey
    );
    const minColIdx = Math.min(startColIdx, endColIdx);
    const maxColIdx = Math.max(startColIdx, endColIdx);

    const newSelected = new Set<string>();
    for (let r = startRow; r <= endRow; r++) {
      for (let c = minColIdx; c <= maxColIdx; c++) {
        const col = derivedColumns[c];
        if (col) {
          newSelected.add(getCellKey(r, col.key));
        }
      }
    }
    setSelectedCells(newSelected);
  };

  const handleCellMouseUp = () => {
    if (isSelecting) {
      justFinishedDragRef.current = true;
      // Reset the flag after a short delay
      setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 100);
    }
    setIsSelecting(false);
  };

  const handleCopySelectedCells = () => {
    if (selectedCells.size === 0) return;

    // Group cells by row
    const cellsByRow: Record<
      number,
      Array<{ colKey: string; value: any }>
    > = {};

    selectedCells.forEach((cellKey) => {
      const parts = cellKey.split("-");
      if (parts.length < 2) return;

      const rowIdxStr = parts[0];
      if (!rowIdxStr) return;

      const colKey = parts.slice(1).join("-"); // Handle colKeys that might contain '-'
      if (!colKey) return;

      const rowIdx = parseInt(rowIdxStr, 10);
      if (isNaN(rowIdx)) return;

      const doc = aggregatedData[rowIdx];
      const col = derivedColumns.find((c) => String(c.key) === colKey);

      if (doc && col) {
        if (!cellsByRow[rowIdx]) {
          cellsByRow[rowIdx] = [];
        }

        let cellValue: any;
        if (doc._isAggregated) {
          const aggConfig = sheetView.aggregationConfig;
          if (colKey === "_count") {
            cellValue = doc._count;
          } else if (
            aggConfig.aggregateField &&
            colKey === aggConfig.aggregateField
          ) {
            cellValue = doc[colKey];
          } else if (aggConfig.groupBy && colKey === aggConfig.groupBy) {
            cellValue = doc[colKey];
          } else {
            cellValue = null;
          }
        } else {
          // Use raw value for copying, not the rendered/formatted value
          cellValue = (doc as any)[colKey];
        }

        cellsByRow[rowIdx]!.push({ colKey, value: cellValue });
      }
    });

    // Sort rows and columns to maintain order
    const sortedRows = Object.keys(cellsByRow)
      .map(Number)
      .sort((a, b) => a - b);
    const allColKeys = Array.from(
      new Set(
        Object.values(cellsByRow)
          .flat()
          .map((c) => c.colKey)
      )
    );
    const colOrder = derivedColumns.map((c) => String(c.key));
    allColKeys.sort((a, b) => {
      const idxA = colOrder.indexOf(a);
      const idxB = colOrder.indexOf(b);
      return idxA - idxB;
    });

    // Build tab-separated text (Excel format)
    const lines = sortedRows.map((rowIdx) => {
      const rowCells = cellsByRow[rowIdx];
      if (!rowCells) return "";
      return allColKeys
        .map((colKey) => {
          const cell = rowCells.find((c) => c.colKey === colKey);
          let value = "";
          if (cell?.value != null) {
            // Convert to string, handling various types
            if (typeof cell.value === "string") {
              value = cell.value;
            } else if (typeof cell.value === "number") {
              value = String(cell.value);
            } else if (cell.value instanceof Date) {
              value = cell.value.toISOString();
            } else if (typeof cell.value === "object") {
              value = JSON.stringify(cell.value);
            } else {
              value = String(cell.value);
            }
          }
          return value;
        })
        .join("\t");
    });

    const text = lines.join("\n");
    navigator.clipboard.writeText(text);
    toast.success(t(`Copied ${selectedCells.size} cell(s) to clipboard`));
  };

  // Handle keyboard copy (Ctrl+C / Cmd+C) and global mouse up
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedCells.size > 0) {
        e.preventDefault();
        handleCopySelectedCells();
      }
    };

    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCells]);

  const handleCellContextMenu = (
    e: React.MouseEvent,
    cellValue: any,
    rowIdx: number,
    colKey: string
  ) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuCellValue(cellValue);
    setContextMenuOpen(true);

    // Excel behavior: if right-clicked cell is in selection, keep selection
    // If right-clicked cell is not in selection, select only that cell
    const cellKey = getCellKey(rowIdx, colKey);
    if (!selectedCells.has(cellKey)) {
      // Cell not in selection - select only this cell
      setSelectedCells(new Set([cellKey]));
    }
    // If cell is already in selection, keep the existing selection as is
  };

  const handleCellCopy = () => {
    if (selectedCells.size > 0) {
      handleCopySelectedCells();
    } else {
      const text =
        contextMenuCellValue != null ? String(contextMenuCellValue) : "";
      navigator.clipboard.writeText(text);
      toast.success(t("Copied to clipboard"));
    }
    setContextMenuOpen(false);
  };

  const handleAddColumnBefore = async (columnKey: string) => {
    const currentVisible = visibleColumns;
    const currentIndex = currentVisible.indexOf(columnKey);
    if (currentIndex === -1) return;

    // Get available columns to add
    const availableToAdd = allAvailableColumns
      .filter(
        (col) => !currentVisible.includes(String(col.key)) && col.sortable
      )
      .map((col) => ({ key: col.key, label: t(col.label || String(col.key)) }));

    if (availableToAdd.length === 0) {
      toast.error(t("No more columns to add"));
      return;
    }

    // Show column selection dialog
    const selectedColumnKey = await popup(
      ColumnSelectDialog,
      {
        title: t("Add Column Before"),
        description: t("Select a column to add before this column"),
      },
      {
        availableColumns: availableToAdd,
      }
    );

    if (selectedColumnKey) {
      const newVisible = [...currentVisible];
      newVisible.splice(currentIndex, 0, selectedColumnKey);
      setVisibleColumns(newVisible);
      toast.success(t("Column added"));
    }
  };

  const handleAddColumnAfter = async (columnKey: string) => {
    const currentVisible = visibleColumns;
    const currentIndex = currentVisible.indexOf(columnKey);
    if (currentIndex === -1) return;

    // Get available columns to add
    const availableToAdd = allAvailableColumns
      .filter(
        (col) => !currentVisible.includes(String(col.key)) && col.sortable
      )
      .map((col) => ({ key: col.key, label: t(col.label || String(col.key)) }));

    if (availableToAdd.length === 0) {
      toast.error(t("No more columns to add"));
      return;
    }

    // Show column selection dialog
    const selectedColumnKey = await popup(
      ColumnSelectDialog,
      {
        title: t("Add Column Next To"),
        description: t("Select a column to add after this column"),
      },
      {
        availableColumns: availableToAdd,
      }
    );

    if (selectedColumnKey) {
      const newVisible = [...currentVisible];
      newVisible.splice(currentIndex + 1, 0, selectedColumnKey);
      setVisibleColumns(newVisible);
      toast.success(t("Column added"));
    }
  };

  const handleRemoveColumn = (columnKey: string) => {
    const currentVisible = visibleColumns;
    const newVisible = currentVisible.filter((key) => key !== columnKey);
    setVisibleColumns(newVisible);
    toast.success(t("Column removed"));
  };

  const handleColumnSettings = async () => {
    const result = await popup(
      ColumnSettingsDialog,
      {
        title: `${t("Column Settings")} ${t("For")} ${t(doctype)}`,
        description: `${t("Choose which columns to display in the sheet view")}`,
      },
      {
        doctype,
        availableColumns: allAvailableColumns.filter((col) => col.sortable),
        visibleColumns,
        defaultColumns,
      }
    );

    if (result?.visibleColumns) {
      if (result.resetToDefault) {
        resetVisibleColumns();
      } else {
        setVisibleColumns(result.visibleColumns);
        setHasCustomColumns(true);
      }
    }
  };

  // Rows that can have checkboxes: normal docs or aggregated group rows (with _docIds)
  const selectableRows = useMemo(
    () =>
      aggregatedData.filter(
        (doc) => !doc._isAggregated || (doc._docIds && doc._docIds.length > 0)
      ),
    [aggregatedData]
  );

  // Calculate selectAll state: all selectable rows are "checked" (all their doc ids in selected)
  const selectAll =
    selectableRows.length > 0 &&
    selectableRows.every((doc) => {
      const ids = doc._docIds ?? (doc.id ? [doc.id] : []);
      return ids.length > 0 && ids.every((id: string) => selected.has(id));
    });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set<string>();
      selectableRows.forEach((doc) => {
        const ids = doc._docIds ?? (doc.id ? [doc.id] : []);
        ids.forEach((id: string) => allIds.add(id));
      });
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

  const handleAggregatedRowSelect = (doc: any, checked: boolean) => {
    const ids = doc._docIds ?? [];
    if (ids.length === 0) return;
    const newSelected = new Set(selected);
    if (checked) {
      ids.forEach((id: string) => newSelected.add(id));
    } else {
      ids.forEach((id: string) => newSelected.delete(id));
    }
    setSelected(newSelected);
  };

  const isAggregatedRowChecked = (doc: any) => {
    const ids = doc._docIds ?? [];
    return ids.length > 0 && ids.every((id: string) => selected.has(id));
  };

  // Column reordering with useColumnDnd
  const handleColumnReorder = (
    fromId: string,
    toId: string,
    type: "before" | "after"
  ) => {
    if (!visibleColumns) return;

    const draggedIndex = visibleColumns.indexOf(fromId);
    const targetIndex = visibleColumns.indexOf(toId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newColumns = [...visibleColumns];
    newColumns.splice(draggedIndex, 1);
    const insertIndex = type === "before" ? targetIndex : targetIndex + 1;
    newColumns.splice(insertIndex, 0, fromId);

    sheetView.setVisibleColumns(newColumns);
    sheetView.setColumnOrder(newColumns);
  };

  const columnDnd = useColumnDnd({
    columns: derivedColumns,
    onReorder: handleColumnReorder,
  });

  return (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:pb-12 zd:h-full">
      <div className="zd:flex zd:items-center zd:gap-2 zd:w-full">
        <ListToolbar
          searchPlaceholder={
            t(`Search By`) +
            " " +
            t(
              `${!doctypeDoc?.search_fields ? "ID" : doctypeDoc?.search_fields?.split("\n").join(", ")}`
            )
          }
          hasActiveFilter={hasActiveFilter}
          onClearFilter={handleClearFilter}
          searchValue={searchInput ?? ""}
          onSearchChange={setSearchInput}
          onSearch={onSearch}
          sortFields={sortFields}
          sortValue={sort ?? ""}
          onSortChange={onSortChange}
          orderValue={order ?? "asc"}
          onOrderChange={onOrderChange}
          filters={filters ?? []}
          onApplyFilters={onApplyFilters}
          filterPopupOpen={filterPopupOpen}
          onFilterPopupOpenChange={handleFilterPopupOpenChange}
          onColumnSettings={handleColumnSettings}
          hasCustomColumns={hasCustomColumns}
          allFields={fields}
          doctype={doctype as any}
        />

        {/* Aggregation - Popover (Select works inside Popover; not inside DropdownMenu) */}
        <Popover
          open={aggregationPopupOpen}
          onOpenChange={setAggregationPopupOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "zd:flex zd:items-center zd:gap-2 zd:whitespace-nowrap",
                sheetView.aggregationConfig.groupBy ? "zd:bg-muted" : ""
              )}
            >
              <FolderPlus className="zd:h-4 zd:w-4" />
              {sheetView.aggregationConfig.groupBy
                ? t(
                    `Grouped by ${t(allAvailableColumns.find((col) => String(col.key) === sheetView.aggregationConfig.groupBy)?.label || sheetView.aggregationConfig.groupBy || "")}`
                  )
                : t("Add Group")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="zd:min-w-[300px]">
            <div className="zd:space-y-3">
              <div>
                <label className="zd:text-sm zd:text-muted-foreground zd:mb-1 zd:block">
                  {t("Select Group By...")}
                </label>
                <Select
                  options={allAvailableColumns
                    .filter((col) => col.sortable)
                    .map((col) => ({
                      value: col.key,
                      label: t(col.label || String(col.key)),
                    }))}
                  value={pendingAggregationConfig.groupBy || ""}
                  onChange={(value) =>
                    setPendingAggregationConfig({
                      ...pendingAggregationConfig,
                      groupBy: value || null,
                    })
                  }
                  placeholder={t("Select Group By...") || ""}
                  clearable
                  displayMode="label"
                />
              </div>

              {pendingAggregationConfig.groupBy && (
                <>
                  <div>
                    <label className="zd:text-sm zd:text-muted-foreground zd:mb-1 zd:block">
                      {t("Aggregate Function")}
                    </label>
                    <Select
                      options={[
                        { value: "Count", label: t("Count") },
                        { value: "Sum", label: t("Sum") },
                        { value: "Average", label: t("Average") },
                      ]}
                      value={pendingAggregationConfig.aggregateFunction}
                      onChange={(value) =>
                        setPendingAggregationConfig({
                          ...pendingAggregationConfig,
                          aggregateFunction:
                            (value as AggregateFunction) || "Count",
                          aggregateField:
                            value === "Sum" || value === "Average"
                              ? pendingAggregationConfig.aggregateField
                              : null,
                        })
                      }
                      displayMode="label"
                    />
                  </div>

                  {(pendingAggregationConfig.aggregateFunction === "Sum" ||
                    pendingAggregationConfig.aggregateFunction ===
                      "Average") && (
                    <div>
                      <label className="zd:text-sm zd:text-muted-foreground zd:mb-1 zd:block">
                        {t("Aggregate Field")}
                      </label>
                      <Select
                        options={numericFields.map((field) => ({
                          value: field.name || "",
                          label: t(field.label || String(field.name || "")),
                        }))}
                        value={pendingAggregationConfig.aggregateField || ""}
                        onChange={(value) =>
                          setPendingAggregationConfig({
                            ...pendingAggregationConfig,
                            aggregateField: value || null,
                          })
                        }
                        placeholder={t("Select Field...") || ""}
                        clearable
                        displayMode="label"
                      />
                    </div>
                  )}

                  <div className="zd:flex zd:gap-2 zd:pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const clearedConfig = {
                          groupBy: null,
                          aggregateFunction: "Count" as AggregateFunction,
                          aggregateField: null,
                        };
                        setPendingAggregationConfig(clearedConfig);
                        sheetView.setAggregationConfig(clearedConfig);
                        setAggregationPopupOpen(false);
                      }}
                    >
                      {t("Clear")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        sheetView.setAggregationConfig(
                          pendingAggregationConfig
                        );
                        setAggregationPopupOpen(false);
                      }}
                    >
                      {t("Apply")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {error ? (
        <div className="zd:text-red-600 zd:text-sm zd:mb-2">{t(error)}</div>
      ) : null}

      {/* Sheet View Grid */}
      <div
        ref={scrollContainerRef}
        className="zd:flex-1 zd:overflow-auto zd:rounded-lg zd:bg-background zd:shadow zd:border"
        style={{ maxHeight: "calc(100vh - 300px)" }}
        onClick={(e) => {
          // Don't clear selection if we just finished dragging
          if (justFinishedDragRef.current) {
            return;
          }
          // Clear selection when clicking outside cells (but not on checkboxes)
          if (
            e.target === e.currentTarget ||
            (e.target instanceof HTMLElement && !e.target.closest("td"))
          ) {
            setSelectedCells(new Set());
          }
        }}
      >
        <div className="zd:inline-block  zd:min-h-[50vh]">
          <table
            ref={tableRef}
            className="zd:text-sm zd:rounded"
            style={{ width: "max-content" }}
          >
            <thead className="zd:z-20 zd:bg-muted">
              <tr className="zd:border-b zd:border-dashed zd:rounded-t">
                {/* Checkbox column */}
                <th
                  className="zd:z-30 zd:px-2 zd:py-1.5 zd:font-medium zd:bg-muted zd:border-b zd:border-r zd:border-border"
                  style={{ width: 40, minWidth: 40, maxWidth: 40 }}
                >
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                {/* Data columns */}
                {derivedColumns.map((col, index) => {
                  const isActive = sort === String(col.key);
                  const columnKey = String(col.key);
                  const columnWidth =
                    columnKey === "_count"
                      ? 100
                      : sheetView.getColumnWidth(columnKey);
                  const dragProps = columnDnd.getDragProps(columnKey);
                  const dropZoneProps = columnDnd.getDropZoneProps(columnKey);
                  const { className: dropZoneClassName, ...restDropZoneProps } =
                    dropZoneProps;

                  return (
                    <TableHeaderCell
                      key={columnKey}
                      col={col}
                      index={index}
                      isActive={isActive}
                      columnKey={columnKey}
                      columnWidth={columnWidth}
                      sort={sort}
                      order={order}
                      onSort={onSort}
                      dragProps={dragProps}
                      dropZoneProps={restDropZoneProps}
                      dropZoneClassName={dropZoneClassName}
                      onAddColumnBefore={handleAddColumnBefore}
                      onAddColumnAfter={handleAddColumnAfter}
                      onRemoveColumn={handleRemoveColumn}
                      onResize={(key, width) => sheetView.setColumnWidth(key, width)}
                      t={t}
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {aggregatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={derivedColumns.length + 1}
                    className="zd:px-3 zd:py-6 zd:text-center zd:text-muted-foreground"
                  >
                    {t("No docs")}
                  </td>
                </tr>
              ) : (
                aggregatedData.map((doc, idx) => {
                  const isAggregated = doc._isAggregated;
                  const isTotals = doc._isTotals;
                  return (
                    <tr
                      key={idx}
                      className={cn(
                        "zd:border-b zd:border-border",
                        isAggregated && "zd:bg-muted/50 zd:font-semibold",
                        isTotals && "zd:bg-muted/70",
                        !isAggregated && "zd:hover:bg-muted/30"
                      )}
                      onMouseUp={handleCellMouseUp}
                    >
                      {/* Checkbox column */}
                      <td
                        className="zd:z-10 zd:px-2 zd:py-1.5 zd:bg-background zd:border-r zd:border-border"
                        style={{ width: 40, minWidth: 40, maxWidth: 40 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isAggregated && (
                          <Checkbox
                            checked={selected.has(doc.id)}
                            onCheckedChange={(checked) =>
                              handleRowSelect(doc.id, checked as boolean)
                            }
                          />
                        )}
                        {isAggregated && !isTotals && doc._docIds?.length > 0 && (
                          <Checkbox
                            checked={isAggregatedRowChecked(doc)}
                            onCheckedChange={(checked) =>
                              handleAggregatedRowSelect(doc, checked as boolean)
                            }
                          />
                        )}
                      </td>
                      {/* Data columns */}
                      {derivedColumns.map((col, index) => {
                        const isFirstColumn = index === 0;
                        const columnKey = String(col.key);
                        const width =
                          columnKey === "_count"
                            ? 100
                            : sheetView.getColumnWidth(columnKey);
                        const aggConfig = sheetView.aggregationConfig;

                        // For aggregated rows, show the aggregated value or count
                        let cellValue: any;
                        if (isAggregated) {
                          if (columnKey === "_count") {
                            // Count column
                            cellValue = doc._count;
                          } else if (
                            aggConfig.aggregateField &&
                            columnKey === aggConfig.aggregateField
                          ) {
                            // Aggregated field column - show the aggregated value
                            cellValue = doc[columnKey];
                          } else if (columnKey === aggConfig.groupBy) {
                            // Group by column - show group value or "Totals"
                            cellValue = doc[columnKey];
                          } else {
                            // Should not happen in aggregation mode, but handle gracefully
                            cellValue = null;
                          }
                        } else {
                          cellValue = doc[columnKey];
                        }

                        const cellDisplayValue =
                          cellValue != null ? (
                            String(cellValue)
                          ) : (
                            <span className="zd:text-muted-foreground zd:italic">
                              -
                            </span>
                          );
                        const cellKey = getCellKey(idx, columnKey);
                        const isCellSelected = selectedCells.has(cellKey);

                        return (
                          <td
                            key={columnKey}
                            className={cn(
                              "zd:truncate  zd:px-2 zd:py-1.5 zd:whitespace-nowrap zd:bg-background zd:border-r zd:border-border zd:cursor-cell",
                              isAggregated && "zd:bg-muted/50",
                              isTotals && "zd:bg-muted/70",
                              isCellSelected &&
                                "zd:bg-blue-100 dark:zd:bg-blue-900/30 zd:outline zd:outline-2 zd:outline-blue-500 zd:outline-offset-[-1px]"
                            )}
                            style={{ width, minWidth: width, maxWidth: width }}
                            onMouseDown={(e) =>
                              handleCellMouseDown(e, idx, columnKey, doc)
                            }
                            onMouseEnter={() =>
                              handleCellMouseEnter(idx, columnKey, doc)
                            }
                            onContextMenu={(e) =>
                              handleCellContextMenu(
                                e,
                                cellValue,
                                idx,
                                columnKey
                              )
                            }
                          >
                            {cellDisplayValue}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count selector at bottom left */}
      <div className="zd:flex zd:items-center zd:justify-between">
        <div className="zd:flex zd:items-center zd:gap-2">
          <div className="zd:flex zd:gap-1">
            {[20, 100, 1000, 10000].map((_limit) => (
              <Button
                key={_limit}
                variant={limit === _limit ? "solid" : "outline"}
                onClick={() => onLimitChange(_limit)}
                size="sm"
              >
                {_limit}
              </Button>
            ))}
          </div>
          {count > 0 && (
            <span className="zd:text-sm zd:text-muted-foreground">
              {aggregatedData.filter((doc) => !doc._isAggregated).length} of{" "}
              {count}
            </span>
          )}
        </div>
      </div>

      {/* Context Menu for Cells - DropdownMenu positioned at cursor */}
      <DropdownMenu
        open={contextMenuOpen}
        onOpenChange={setContextMenuOpen}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="zd:fixed zd:w-px zd:h-px zd:opacity-0 zd:pointer-events-none zd:border-0"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
            aria-hidden
            tabIndex={-1}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onSelect={handleCellCopy}>
            <Copy className="zd:mr-2 zd:h-4 zd:w-4" />
            {selectedCells.size > 0
              ? t(`Copy ${selectedCells.size} cell(s)`)
              : t("Copy")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
