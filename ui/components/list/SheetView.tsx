import React, { useMemo, useState, useEffect, useRef } from "react";
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
import { plugins } from "../form/plugins";
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
        isFirstColumn && "zd:sticky zd:left-10 zd:z-20",
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

export function SheetView({
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
}: SheetViewProps) {
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
    doctype: "zodula__Doctype",
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
    const displayFieldInfo = fields.find(
      (field: any) => field.name === displayField
    );
    const displayPlugin = displayFieldInfo
      ? plugins.find((plugin) => plugin.types.includes(displayFieldInfo.type))
      : null;

    cols.push({
      key: displayField,
      label: displayField === "id" ? "ID" : displayField,
      sortable: true,
      render:
        displayPlugin && displayFieldInfo
          ? (doc: any) =>
              displayPlugin.cellRender({
                fieldOptions: displayFieldInfo,
                value: doc[displayField],
                doc: doc,
              })
          : undefined,
    });

    // Add ALL fields (not just in_list_view fields)
    fields.forEach((field: any) => {
      if (ClientFieldHelper.isStandardField(field.name)) return;
      if (ClientFieldHelper.isLayoutField(field)) return;
      if (field.name !== displayField) {
        // Find the plugin for this field type
        const plugin = plugins.find((plugin) =>
          plugin.types.includes(field.type)
        );

        cols.push({
          key: field.name,
          label: field.label || field.name,
          sortable: field.type !== "Reference Table" && field.type !== "Extend",
          render: plugin
            ? (doc: any) =>
                plugin.cellRender({
                  fieldOptions: field,
                  value: doc[field.name],
                  doc: doc,
                })
            : undefined,
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
        const docs = groupDocs as any[];
        const firstDoc = docs[0];
        const result: any = {
          ...firstDoc,
          _isAggregated: true,
          _groupKey: groupKey,
        };

        if (aggregationConfig.aggregateField) {
          const values = docs
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
                result[aggregationConfig.aggregateField!] = docs.length;
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
          result._count = docs.length;
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

    // Don't start selection if clicking on checkbox or aggregated rows
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('input[type="checkbox"]')
    ) {
      return;
    }

    const isAggregated = doc._isAggregated;
    if (isAggregated) return;

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
    const isAggregated = doc._isAggregated;
    if (isAggregated) return;

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

  // Calculate selectAll state based on selected items
  const selectAll =
    aggregatedData.length > 0 &&
    aggregatedData
      .filter((doc) => !doc._isAggregated)
      .every((doc) => selected.has(doc.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(
        aggregatedData.filter((doc) => !doc._isAggregated).map((doc) => doc.id)
      );
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

  // Column copy handler
  const handleCopyColumn = (columnKey: string) => {
    const column = derivedColumns.find((col) => String(col.key) === columnKey);
    if (!column) return;

    const columnData = aggregatedData
      .filter((doc) => !doc._isAggregated)
      .map((doc) => {
        const value = column.render
          ? column.render(doc)
          : (doc as any)[columnKey];
        return String(value || "");
      })
      .join("\n");

    navigator.clipboard.writeText(columnData);
    toast.success(t("Column copied to clipboard"));
  };

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
          doctype={doctype}
        />

        {/* Aggregation Button - Frappe Style */}
        <div className="zd:relative">
          <Button
            variant="outline"
            onClick={() => setAggregationPopupOpen(!aggregationPopupOpen)}
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

          {aggregationPopupOpen && (
            <div className="zd:absolute zd:top-full zd:right-0 zd:mt-2 zd:z-50 zd:bg-background zd:border zd:border-border zd:rounded-lg zd:shadow-lg zd:p-4 zd:min-w-[300px]">
              <div className="zd:flex zd:items-center zd:justify-between zd:mb-3">
                <span className="zd:font-medium">{t("Group By")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAggregationPopupOpen(false)}
                  className="zd:h-6 zd:w-6 zd:p-0"
                >
                  <X className="zd:h-4 zd:w-4" />
                </Button>
              </div>

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
                          // Clear and apply immediately
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
                          // Apply the pending config
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
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="zd:text-red-600 zd:text-sm zd:mb-2">{t(error)}</div>
      ) : null}

      {/* Sheet View Grid */}
      <div
        ref={scrollContainerRef}
        className="zd:flex-1 zd:overflow-auto zd:rounded-lg zd:bg-background"
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
        <div className="zd:inline-block">
          <table
            ref={tableRef}
            className="zd:text-sm zd:border"
            style={{ width: "max-content" }}
          >
            <thead className="zd:sticky zd:top-0 zd:z-20 zd:bg-muted">
              <tr>
                {/* Checkbox column */}
                <th
                  className="zd:sticky zd:left-0 zd:z-30 zd:px-2 zd:py-1.5 zd:font-medium zd:bg-muted zd:border-b zd:border-r zd:border-border"
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
                        className="zd:sticky zd:left-0 zd:z-10 zd:px-2 zd:py-1.5 zd:bg-background zd:border-r zd:border-border"
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

                        // Use field renderer for aggregated values if available (for currency formatting, etc.)
                        const shouldUseRenderer =
                          col.render &&
                          (!isAggregated ||
                            (isAggregated &&
                              columnKey === aggConfig.aggregateField));

                        const cellDisplayValue =
                          shouldUseRenderer && cellValue != null ? (
                            col.render!(doc)
                          ) : cellValue != null ? (
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
                              "zd:truncate  zd:px-2 zd:py-1.5 zd:whitespace-nowrap zd:bg-background zd:border-r zd:border-border",
                              isFirstColumn &&
                                "zd:sticky zd:left-10 zd:z-10 zd:bg-background",
                              isAggregated && "zd:bg-muted/50",
                              isTotals && "zd:bg-muted/70",
                              !isAggregated && "zd:cursor-cell",
                              isCellSelected &&
                                !isAggregated &&
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
                            <div
                              className={cn(
                                "zd:truncate zd:w-fit",
                                (() => {
                                  if (isAggregated) return "";
                                  const field = fields.find(
                                    (f) => f.name === columnKey
                                  );
                                  const isIdField = columnKey === "id";
                                  const isReferenceField =
                                    field?.type === "Reference"
                                  return (isIdField || isReferenceField) &&
                                    cellValue
                                    ? "zd:hover:underline zd:cursor-pointer"
                                    : "";
                                })()
                              )}
                              title={cellValue != null ? String(cellValue) : ""}
                              onClick={(e) => {
                                // Only navigate when clicking on ID or Reference field text
                                if (isAggregated) return;

                                const field = fields.find(
                                  (f) => f.name === columnKey
                                );
                                const isIdField = columnKey === "id";
                                const isReferenceField =
                                  field?.type === "Reference" ||
                                  field?.reference_type === "Reference";

                                if (
                                  (isIdField || isReferenceField) &&
                                  cellValue
                                ) {
                                  e.stopPropagation();
                                  const targetDocId = isIdField
                                    ? doc.id
                                    : String(cellValue);
                                  if (targetDocId) {
                                    const targetDoctype = isIdField
                                      ? doctype
                                      : field?.reference || doctype;
                                    push(
                                      `/desk/${org}/doctypes/${targetDoctype}/form/${targetDocId}`
                                    );
                                  }
                                }
                              }}
                            >
                              {cellDisplayValue}
                            </div>
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
          {count && (
            <span className="zd:text-sm zd:text-muted-foreground">
              {aggregatedData.filter((doc) => !doc._isAggregated).length} of{" "}
              {count}
            </span>
          )}
        </div>
      </div>

      {/* Context Menu for Cells */}
      {contextMenuOpen && (
        <>
          <div
            className="zd:fixed zd:inset-0 zd:z-40"
            onClick={() => setContextMenuOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuOpen(false);
            }}
          />
          <div
            className="zd:fixed zd:z-50 zd:min-w-[8rem] zd:overflow-hidden zd:rounded-md zd:border zd:bg-popover zd:p-1 zd:text-popover-foreground zd:shadow-md"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={handleCellCopy}
              className="zd:relative zd:flex zd:gap-2 zd:cursor-pointer zd:select-none zd:items-center zd:rounded-sm zd:px-2 zd:py-1.5 zd:w-full zd:text-left zd:outline-none zd:transition-colors zd:hover:bg-accent zd:hover:text-accent-foreground"
            >
              <Copy className="zd:mr-2 zd:h-4 zd:w-4" />
              {selectedCells.size > 0
                ? t(`Copy ${selectedCells.size} cell(s)`)
                : t("Copy")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
