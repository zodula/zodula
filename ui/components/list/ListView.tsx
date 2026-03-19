import React, { useMemo, useState, useEffect, useRef } from "react";
import { useDocList } from "../../hooks/use-doc-list";
import { useDoc } from "../../hooks/use-doc";
import { ListToolbar } from "./ListToolbar";
import { QuickFilterBar } from "./QuickFilterBar";
import { ListTable, type ListColumn } from "./ListTable";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
import { useColumnSettings } from "../../hooks/use-column-settings";
import { Badge, useZui } from "@/zodula/ui";
import type { ListFormatBadgeConfig } from "../../zui";

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
    doctype: "Doctype",
    id: doctype,
  });

  const zui = useZui();
  const [hasActiveFilter, setHasActiveFilter] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);
  const emptyFilters = useMemo(() => [] as IFilter<any, any, IOperator>[], []);

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
    // ID
    cols.push({
      key: "id",
      label: t("ID"),
      sortable: true,
      render: (doc: any) => {
        return <span className="">{doc.id}</span>;
      },
    });

    // First column: display field or id
    const displayField = (doctypeDoc as any)?.display_field || "id";
    const displayFieldInfo = fields.find(
      (field: any) => field.name === displayField
    );
    const displayPlugin = plugins.find((plugin) =>
      plugin.types.includes(displayFieldInfo?.type)
    );

    if (displayField !== "id") {
      cols.push({
        key: displayField,
        label: t(displayFieldInfo?.label || displayFieldInfo?.name || displayField),
        sortable: true,
        render: displayPlugin
          ? (doc: any) =>
            displayPlugin.cellRender({
              fieldOptions: displayFieldInfo,
              value: doc[displayField],
              doc: doc,
            })
          : undefined,
      });
    }

    // Add doc_status column right after display field
    if (!hideDocStatus) {
      const { DocStatusBadge } = require("../custom/doc-status-badge");
      cols.push({
        key: "doc_status",
        label: t("Document Status"),
        sortable: true,
        render: (doc: any) => {
          // Default: show doc_status badge
          // Custom badges can be added via UI scripts using context.addBadge("doc_status")
          return <DocStatusBadge status={doc.doc_status || "Draft"} />;
        },
      });
    }

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

    // Add doc_status right after display field if not hidden
    if (!hideDocStatus) {
      defaultCols.push("doc_status");
    }

    // Add fields that are in_list_view or required (system default behavior)
    fields.forEach((field: any) => {
      if (
        field.name !== displayField &&
        field.name !== "doc_status" &&
        (field.in_list_view === 1) &&
        !zodula.utils.isStandardField(field.name)
      ) {
        defaultCols.push(field.name);
      }
    });

    return defaultCols;
  }, [doctypeDoc, fields, allAvailableColumns, hideDocStatus]);

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

  // Filter columns based on visible columns and preserve order from visibleColumns
  const derivedColumns: string[] = useMemo(() => {
    // Ensure visibleColumns is not empty - use defaultColumns as fallback
    const columnsToUse =
      visibleColumns && visibleColumns.length > 0
        ? visibleColumns
        : defaultColumns;

    if (!columnsToUse || columnsToUse.length === 0) {
      return [];
    }

    // Filter and sort according to columnsToUse order (preserve visibleColumns order)
    return columnsToUse.map((colKey) => String(colKey));
  }, [allAvailableColumns, visibleColumns, defaultColumns, t]);

  // Get available sort fields from columns - pass full field metadata for FilterPopup
  const sortFields = useMemo(() => {
    return fields.filter(
      (field: Zodula.Field) =>
        field.type !== "Reference Table" && field.type !== "Extend"
    );
  }, [fields]);

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
        resetVisibleColumns();
      } else {
        setVisibleColumns(result.visibleColumns);
        setHasCustomColumns(true);
      }
    }
  };
  const customRenderers = useRef<Record<string, (doc: any) => React.ReactNode>>({});
  const badgeConfigs = useRef<Record<string, ListFormatBadgeConfig>>({});

  useEffect(() => {
    async function executeFormatScripts() {
      customRenderers.current = {};
      badgeConfigs.current = {};
      await zui._.executeListScripts(doctype as any, "on_format", {
        doctype,
        list_data: docs,
        selected_rows: selected,
        set_selected_rows: setSelected,
        set_badge_config: (fieldKey, config) => {
          badgeConfigs.current[fieldKey] = config;
        },
        set_custom_renderer: (fieldKey, render) => {
          customRenderers.current[fieldKey] = render;
        },
      });
    }
    executeFormatScripts();
  }, [doctype, docs, selected, setSelected]);

  const _columns = useMemo(() => {
    return allAvailableColumns
      ?.filter((col) => derivedColumns.includes(String(col.key)))
      .map((col) => {
        // Check if there's a custom renderer from scripts
        const customRenderer = customRenderers.current[String(col.key)];
        const badgeConfig = badgeConfigs.current[String(col.key)];

        // If badge config exists, create a badge renderer
        if (badgeConfig) {
          return {
            ...col,
            label: t(col.label || col.key || ""),
            render: (doc: any) => {
              const valueOrObj = badgeConfig.getValue ? badgeConfig.getValue(doc, t) : doc[String(col.key)];

              // If getValue returns null, fall back to default column renderer
              if (valueOrObj === null) {
                return col.render ? col.render(doc) : doc[String(col.key)];
              }

              const displayValue = typeof valueOrObj === 'object' && valueOrObj !== null ? valueOrObj.status : valueOrObj;
              const variant = typeof valueOrObj === 'object' && valueOrObj !== null ? valueOrObj.variant : badgeConfig.variant;
              return (
                <Badge variant={variant as any} size={badgeConfig.size as any}>
                  {displayValue || ""}
                </Badge>
              );
            }
          };
        }

        // If custom renderer exists, use it
        if (customRenderer) {
          return {
            ...col,
            label: t(col.label || col.key || ""),
            render: customRenderer
          };
        }

        return {
          ...col,
          label: t(col.label || col.key || ""),
        };
      });
  }, [allAvailableColumns, derivedColumns, t, customRenderers, badgeConfigs]);

  const searchFieldsLabels = useMemo(() => {
    const searchFields = doctypeDoc?.search_fields?.split("\n");
    if (!searchFields) return [];
    return searchFields.map((field: string) => {
      const fieldInfo = fields.find((f: any) => f.name === field);
      return fieldInfo ? t(fieldInfo.label || fieldInfo.name || field) : field;
    });
  }, [doctypeDoc, fields]);

  return (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:pb-12 zd:h-full">
      <ListToolbar
        hasActiveFilter={hasActiveFilter}
        onClearFilter={handleClearFilter}
        sortFields={sortFields}
        sortValue={sort ?? ""}
        onSortChange={onSortChange}
        orderValue={order ?? "asc"}
        onOrderChange={onOrderChange}
        filters={filters ?? emptyFilters}
        onApplyFilters={onApplyFilters}
        filterPopupOpen={filterPopupOpen}
        onFilterPopupOpenChange={handleFilterPopupOpenChange}
        onColumnSettings={handleColumnSettings}
        hasCustomColumns={hasCustomColumns}
        allFields={fields}
        doctype={doctype as any}
        quickFilterBar={
          <QuickFilterBar
            fields={fields}
            filters={filters ?? emptyFilters}
            onApplyFilters={onApplyFilters}
            doctype={doctype as any}
          />
        }
      />

      {error ? (
        <div className="zd:text-red-600 zd:text-sm zd:mb-2">{t(error)}</div>
      ) : null}

      <ListTable
        columns={_columns ?? []}
        docs={docs}
        count={count}
        sort={sort ?? ""}
        order={order ?? "desc"}
        onSort={onSort}
        onRowClick={handleRowClick}
        selected={selected}
        setSelected={setSelected}
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
