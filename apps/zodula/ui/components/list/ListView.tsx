import React, { useMemo, useState, useEffect } from "react";
import { useDocList } from "../../hooks/use-doc-list";
import { useDoc } from "../../hooks/use-doc";
import { ListToolbar } from "./ListToolbar";
import { ListTable, type ListColumn } from "./ListTable";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { useRouter } from "../router";
import { popup } from "../ui/popit";
import { ColumnSettingsDialog } from "../dialogs/column-settings-dialog";
import { zodula } from "@/zodula/client";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import type {
  ListParams,
  ListParamsActions,
} from "../../hooks/use-list-params";
import { ClientFieldHelper } from "@/zodula/client/field";
import { plugins } from "../form/plugins";
import { useTranslation } from "../../hooks/use-translation";

interface ListViewProps {
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

export function ListView({
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
}: ListViewProps) {
  const { push } = useRouter();
  const { t } = useTranslation();
  // Get doctype schema to determine columns
  const { doc: doctypeDoc, loading: doctypeLoading } = useDoc({
    doctype: "zodula__Doctype",
    id: doctype,
  });

  const [hasActiveFilter, setHasActiveFilter] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [hasCustomColumns, setHasCustomColumns] = useState(false);

  // Update search input when searchQuery prop changes
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Update hasActiveFilter based on filters and search query
  useEffect(() => {
    setHasActiveFilter(!!searchQuery || (filters?.length ?? 0) > 0);
  }, [searchQuery, filters]);

  const listViewFields = useMemo(() => {
    if (!fields || !doctypeDoc) return [];
    return fields
      .filter((field: any) => field.doctype === doctype && field.in_list_view)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [fields, doctypeDoc]);

  // Get all available columns (all fields, not just list view fields)
  const allAvailableColumns: ListColumn[] = useMemo(() => {
    // if (columns && columns?.length > 0) return columns;

    if (!doctypeDoc || !fields.length) {
      // Fallback: infer columns from first doc keys
      const sample = docs[0] || {};
      return Object.keys(sample)
        .slice(0, 6)
        .map((key) => ({
          key,
          label: key,
          sortable: true,
          // No plugin available, will use default rendering
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

  // Load column settings from localStorage
  useEffect(() => {
    const storageKey = `column-settings-${doctype}`;
    const savedSettings = localStorage.getItem(storageKey);

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setVisibleColumns(parsed.visibleColumns || defaultColumns);
        setHasCustomColumns(true);
      } catch (error) {
        console.error("Error parsing column settings:", error);
        setVisibleColumns(defaultColumns);
        setHasCustomColumns(false);
      }
    } else {
      setVisibleColumns(defaultColumns);
      setHasCustomColumns(false);
    }
  }, [doctype, defaultColumns]);

  // Filter columns based on visible columns
  const derivedColumns: ListColumn[] = useMemo(() => {
    return allAvailableColumns
      .filter((col) => visibleColumns.includes(col.key))
      .map((col) => ({
        ...col,
        label: t(col.label || col.key || ""),
      }));
  }, [allAvailableColumns, visibleColumns, t]);

  // Get available sort fields from columns - pass full field metadata for FilterPopup
  const sortFields = useMemo(() => {
    return fields.filter(
      (field: Zodula.Field) =>
        field.type !== "Reference Table" && field.type !== "Extend"
    );
  }, [fields]);

  const handleLastUpdated = () => {
    onSort("updated_at");
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== searchQuery) {
        onSearch(searchInput);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchQuery, onSearch]);

  const handleFilter = () => {
    setFilterPopupOpen(true);
  };

  const handleFilterPopupOpenChange = (open: boolean) => {
    setFilterPopupOpen(open);
  };

  const handleClearFilter = () => {
    setHasActiveFilter(false);
    onClearFilter();
    setSearchInput("");
  };

  const handleRowClick = (doc: any) => {
    // Navigate to the form page with the doc ID
    push(`/desk/doctypes/${doctype}/form/${doc.id}`);
  };

  const handleColumnSettings = async () => {
    const result = await popup(
      ColumnSettingsDialog,
      {
        title: `${t("Column Settings")} ${t("For")} ${t(doctype)}`,
        description: `${t("Choose which columns to display in the list view")}`,
      },
      {
        doctype,
        availableColumns: allAvailableColumns.filter((col) => col.sortable),
        visibleColumns,
        defaultColumns,
      }
    );

    if (result?.visibleColumns) {
      const storageKey = `column-settings-${doctype}`;

      if (result.resetToDefault) {
        // Delete localStorage to return to system default behavior
        localStorage.removeItem(storageKey);
        setVisibleColumns(result.visibleColumns);
        setHasCustomColumns(false);
      } else {
        // Save to localStorage
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            visibleColumns: result.visibleColumns,
            timestamp: Date.now(),
          })
        );

        // Update state
        setVisibleColumns(result.visibleColumns);
        setHasCustomColumns(true);
      }
    }
  };

  return (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:pb-12">
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
      />

      {error ? (
        <div className="zd:text-red-600 zd:text-sm zd:mb-2">{t(error)}</div>
      ) : null}

      <ListTable
        columns={derivedColumns}
        docs={docs}
        count={count}
        sort={sort ?? ""}
        order={order ?? "desc"}
        onSort={onSort}
        onRowClick={handleRowClick}
        selected={selected}
        setSelected={setSelected}
        hideDocStatus={hideDocStatus}
      />

      {/* Row count selector at bottom left */}
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
      </div>
    </div>
  );
}
