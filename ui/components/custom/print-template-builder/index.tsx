import React, { useCallback, useMemo, useState } from "react";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDnd } from "@/zodula/ui/hooks/use-dnd";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useIsTabletOrUp } from "@/zodula/ui/hooks/use-media-query";
import { Button } from "@/zodula/ui/components/ui/button";
import { Input } from "@/zodula/ui/components/ui/input";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { Select } from "@/zodula/ui/components/ui/select";
import { popup } from "@/zodula/ui/components/ui/popit";
import { cn } from "@/zodula/ui/lib/utils";
import { GripVertical, Settings2, Trash2, Pencil, Plus, Rows3, Circle } from "lucide-react";
import type { WorkspaceItem } from "@/zodula/ui/components/workspace/use-workspace";
import type { PrintTemplateBuilderItem, PaletteEntry } from "./types";

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function parseJsonArray(s: string | null | undefined): string[] {
  if (s == null || s === "") return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** Popup for table items: select main columns, nested field, and nested columns (extended to the right). */
function TableColumnsConfigPopup({
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: (result?: Partial<PrintTemplateBuilderItem>) => void;
  initialData?: {
    item: PrintTemplateBuilderItem;
    parentDoctype: string;
    allFields: any[];
    onApply: (patch: Partial<PrintTemplateBuilderItem>) => void;
    onRemove?: () => void;
  };
}) {
  const { t } = useTranslation();
  const { item, parentDoctype, allFields = [], onApply, onRemove } = initialData ?? {
    item: null as any,
    parentDoctype: "",
    allFields: [],
    onApply: () => {},
  };

  const refField = useMemo(() => {
    if (!parentDoctype || !item?.field_name) return null;
    return (allFields as any[]).find((f: any) => f.doctype === parentDoctype && f.name === item.field_name);
  }, [parentDoctype, item?.field_name, allFields]);

  const referenceDoctype = (refField as any)?.reference ?? null;

  const mainColumnFields = useMemo(() => {
    if (!referenceDoctype) return [];
    return (allFields as any[])
      .filter((f: any) => f.doctype === referenceDoctype && !ClientFieldHelper.isStandardField(f.name || ""))
      .filter((f: any) => f.type !== "Reference Table" && f.type !== "Extend")
      .sort((a: any, b: any) => (a.idx ?? 0) - (b.idx ?? 0));
  }, [referenceDoctype, allFields]);

  const nestedFieldOptions = useMemo(() => {
    if (!referenceDoctype) return [];
    return (allFields as any[])
      .filter((f: any) => f.doctype === referenceDoctype && f.type === "Reference")
      .map((f: any) => ({ value: f.name, label: f.label || f.name }));
  }, [referenceDoctype, allFields]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => parseJsonArray(item?.columns ?? item?.fields));
  const [nestedField, setNestedField] = useState<string | null>(item?.nested_field ?? null);
  const [nestedTableField, setNestedTableField] = useState<string | null>(item?.nested_table_field ?? null);
  const [nestedTableFieldDoctype, setNestedTableFieldDoctype] = useState<string | null>(item?.nested_table_field_doctype ?? null);
  const [selectedNestedColumns, setSelectedNestedColumns] = useState<string[]>(() => parseJsonArray(item?.nested_columns));

  const nestedRefField = useMemo(() => {
    if (!referenceDoctype || !nestedField) return null;
    return (allFields as any[]).find((f: any) => f.doctype === referenceDoctype && f.name === nestedField);
  }, [referenceDoctype, nestedField, allFields]);

  const nestedDoctype = (nestedRefField as any)?.reference ?? null;

  const nestedTableFieldOptions = useMemo(() => {
    if (!nestedDoctype) return [];
    return (allFields as any[])
      .filter((f: any) => f.doctype === nestedDoctype && f.type === "Reference Table")
      .map((f: any) => ({ value: f.name, label: f.label || f.name }));
  }, [nestedDoctype, allFields]);

  const resolvedNestedTableField = useMemo(() => {
    if (!nestedDoctype) return null;
    const fieldName = nestedTableField ?? item?.nested_table_field;
    if (!fieldName) return null;
    return (allFields as any[]).find((f: any) => f.doctype === nestedDoctype && f.name === fieldName);
  }, [nestedDoctype, nestedTableField, item?.nested_table_field, allFields]);

  const nestedChildDoctype = (() => {
    const manual = nestedTableFieldDoctype ?? item?.nested_table_field_doctype;
    if (manual != null && String(manual).trim() !== "") return String(manual).trim();
    const ref = (resolvedNestedTableField as any)?.reference;
    if (ref == null || ref === "") return null;
    const s = String(ref).trim();
    return s || null;
  })();

  /** Dropdown path but Field row has no `reference` — manual path already has its own doctype field. */
  const needsNestedChildDoctypeInput =
    !!(nestedTableField || item?.nested_table_field) &&
    !!nestedDoctype &&
    !nestedChildDoctype &&
    nestedTableFieldOptions.length > 0;

  /** Child table Field rows are often missing from a single global Field fetch; load explicitly by doctype. */
  const NESTED_FIELD_FETCH_SKIP = "__PrintTemplateNestedFieldFetchSkip__";
  const { docs: nestedFieldsForChildRaw, loading: nestedFieldsLoading } = useDocList(
    {
      doctype: "Field" as Zodula.DoctypeName,
      limit: -1,
      sort: "idx",
      order: "asc",
      filters: nestedChildDoctype ? ([["doctype", "=", nestedChildDoctype]] as any) : ([["doctype", "=", NESTED_FIELD_FETCH_SKIP]] as any),
    },
    [nestedChildDoctype]
  );

  const pickPrintableColumns = useCallback((rows: any[]) => {
    return rows
      .filter((f: any) => !ClientFieldHelper.isStandardField(f.name || ""))
      .filter((f: any) => f.type !== "Reference Table" && f.type !== "Extend")
      .sort((a: any, b: any) => (a.idx ?? 0) - (b.idx ?? 0));
  }, []);

  const nestedColumnFieldsFromAll = useMemo(() => {
    if (!nestedChildDoctype) return [];
    return pickPrintableColumns(
      (allFields as any[]).filter((f: any) => f.doctype === nestedChildDoctype)
    );
  }, [nestedChildDoctype, allFields, pickPrintableColumns]);

  const nestedColumnFieldsFromQuery = useMemo(() => {
    if (!nestedChildDoctype) return [];
    return pickPrintableColumns(nestedFieldsForChildRaw as any[]);
  }, [nestedChildDoctype, nestedFieldsForChildRaw, pickPrintableColumns]);

  const nestedColumnFields = useMemo(() => {
    const byName = new Map<string, any>();
    for (const f of nestedColumnFieldsFromQuery) byName.set(f.name, f);
    for (const f of nestedColumnFieldsFromAll) {
      if (!byName.has(f.name)) byName.set(f.name, f);
    }
    return Array.from(byName.values()).sort((a: any, b: any) => (a.idx ?? 0) - (b.idx ?? 0));
  }, [nestedColumnFieldsFromQuery, nestedColumnFieldsFromAll]);

  React.useEffect(() => {
    setSelectedColumns(parseJsonArray(item?.columns ?? item?.fields));
    setNestedField(item?.nested_field ?? null);
    setNestedTableField(item?.nested_table_field ?? null);
    setNestedTableFieldDoctype(item?.nested_table_field_doctype ?? null);
    setSelectedNestedColumns(parseJsonArray(item?.nested_columns));
  }, [item?.id, item?.columns, item?.fields, item?.nested_field, item?.nested_table_field, item?.nested_table_field_doctype, item?.nested_columns]);

  const toggleColumn = (name: string) => {
    setSelectedColumns((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const toggleNestedColumn = (name: string) => {
    setSelectedNestedColumns((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const handleApply = () => {
    if (!item) return;
    onApply({
      columns: selectedColumns.length ? JSON.stringify(selectedColumns) : null,
      nested_field: nestedField || null,
      nested_table_field: nestedTableField || null,
      nested_table_field_doctype: nestedTableFieldDoctype || null,
      nested_columns: selectedNestedColumns.length ? JSON.stringify(selectedNestedColumns) : null,
    });
    onClose();
  };

  if (!item?.field_name) return null;

  return (
    <div className="zd:space-y-4">
      <FormControl label={t("Table columns")} fieldKey="columns" helperText={referenceDoctype ? undefined : t("Select a Doctype on the Print Template to load fields.")}>
        <div className="zd:max-h-48 zd:overflow-auto zd:border zd:rounded-md zd:p-2 zd:space-y-1">
          {mainColumnFields.length === 0 && <span className="zd:text-muted-foreground zd:text-sm">{referenceDoctype ? t("No fields") : t("—")}</span>}
          {mainColumnFields.map((f: any) => {
            const isSelected = selectedColumns.includes(f.name);
            const idx = isSelected ? selectedColumns.indexOf(f.name) + 1 : 0;
            return (
              <div
                key={f.name}
                role="button"
                tabIndex={0}
                onClick={() => toggleColumn(f.name)}
                onKeyDown={(e) => e.key === "Enter" && toggleColumn(f.name)}
                className="zd:flex zd:items-center zd:gap-2 zd:cursor-pointer zd:text-sm zd:py-0.5 zd:rounded hover:zd:bg-muted/50"
              >
                <div className={cn(
                  "zd:flex zd:items-center zd:justify-center zd:shrink-0 zd:w-5 zd:h-5 zd:rounded-full zd:border zd:border-input",
                  isSelected ? "zd:bg-primary zd:text-primary-foreground" : "zd:bg-background zd:text-muted-foreground"
                )}>
                  <span className="zd:text-xs zd:font-medium">{idx || ""}</span>
                </div>
                <span>{f.label || f.name}</span>
              </div>
            );
          })}
        </div>
      </FormControl>
      <FormControl label={t("Nested field")} fieldKey="nested_field" helperText={t("Reference on each row (e.g. delivery_note). Nested rows render below each main row.")}>
        <Select
          options={[{ value: "", label: t("— None —") }, ...nestedFieldOptions]}
          value={nestedField ?? ""}
          onChange={(v) => { setNestedField(v || null); setNestedTableField(null); setNestedTableFieldDoctype(null); setSelectedNestedColumns([]); }}
          className="zd:w-full"
        />
      </FormControl>
      {nestedDoctype && nestedTableFieldOptions.length > 0 && (
        <FormControl label={t("Nested table field")} fieldKey="nested_table_field" helperText={t("Field on nested doctype holding the child table (e.g. items). Required for nested columns.")}>
          <Select
            options={[{ value: "", label: t("— Select —") }, ...nestedTableFieldOptions]}
            value={nestedTableField ?? ""}
            onChange={(v) => { setNestedTableField(v || null); setSelectedNestedColumns([]); }}
            className="zd:w-full"
          />
        </FormControl>
      )}
      {nestedDoctype && nestedTableFieldOptions.length === 0 && (
        <>
          <FormControl label={t("Nested table field")} fieldKey="nested_table_field_manual" helperText={t("When schema cannot be loaded, enter the field name (e.g. items).")}>
            <Input
              value={nestedTableField ?? ""}
              onChange={(e) => { setNestedTableField(e.target.value || null); setSelectedNestedColumns([]); }}
              placeholder={t("e.g. items")}
              className="zd:w-full"
            />
          </FormControl>
          <FormControl label={t("Nested table field doctype")} fieldKey="nested_table_field_doctype" helperText={t("Doctype of the nested table (e.g. Delivery Note Item).")}>
            <Input
              value={nestedTableFieldDoctype ?? ""}
              onChange={(e) => setNestedTableFieldDoctype(e.target.value || null)}
              placeholder={t("e.g. Delivery Note Item")}
              className="zd:w-full"
            />
          </FormControl>
        </>
      )}
      {needsNestedChildDoctypeInput && (
        <FormControl
          label={t("Child table doctype")}
          fieldKey="nested_child_doctype_fallback"
          helperText={t("Field metadata has no child doctype for this table. Enter it (e.g. Delivery Note Item) to pick nested columns.")}
        >
          <Input
            value={nestedTableFieldDoctype ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setNestedTableFieldDoctype(v || null);
            }}
            placeholder={t("e.g. Delivery Note Item")}
            className="zd:w-full"
          />
        </FormControl>
      )}
      {(nestedTableField || item?.nested_table_field) && nestedChildDoctype && (
        <FormControl label={t("Nested columns")} fieldKey="nested_columns" helperText={t("Columns from nested table (e.g. delivery_note_items), extended to the right.")}>
          <div className="zd:max-h-48 zd:overflow-auto zd:border zd:rounded-md zd:p-2 zd:space-y-1">
            {nestedFieldsLoading && (
              <span className="zd:text-muted-foreground zd:text-sm">{t("Loading columns…")}</span>
            )}
            {!nestedFieldsLoading && nestedColumnFields.length === 0 && (
              <span className="zd:text-muted-foreground zd:text-sm">
                {t("No fields found for this nested table doctype. Confirm nested table field / doctype and Field permissions.")}{" "}
                <span className="zd:font-mono">({nestedChildDoctype})</span>
              </span>
            )}
            {!nestedFieldsLoading &&
              nestedColumnFields.map((f: any) => {
                const isSelected = selectedNestedColumns.includes(f.name);
                const idx = isSelected ? selectedNestedColumns.indexOf(f.name) + 1 : 0;
                return (
                  <div
                    key={f.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleNestedColumn(f.name)}
                    onKeyDown={(e) => e.key === "Enter" && toggleNestedColumn(f.name)}
                    className="zd:flex zd:items-center zd:gap-2 zd:cursor-pointer zd:text-sm zd:py-0.5 zd:rounded hover:zd:bg-muted/50"
                  >
                    <div className={cn(
                      "zd:flex zd:items-center zd:justify-center zd:shrink-0 zd:w-5 zd:h-5 zd:rounded-full zd:border zd:border-input",
                      isSelected ? "zd:bg-primary zd:text-primary-foreground" : "zd:bg-background zd:text-muted-foreground"
                    )}>
                      <span className="zd:text-xs zd:font-medium">{idx || ""}</span>
                    </div>
                    <span>{f.label || f.name}</span>
                  </div>
                );
              })}
          </div>
        </FormControl>
      )}
      <div className="zd:flex zd:flex-wrap zd:justify-end zd:gap-2">
        {onRemove && (
          <Button type="button" variant="outline" className="zd:text-destructive" onClick={() => { onRemove(); onClose(); }}>
            {t("Remove element")}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onClose()}>{t("Cancel")}</Button>
        <Button type="button" onClick={handleApply}>{t("Apply")}</Button>
      </div>
    </div>
  );
}

/** Popup content for configuring a template item (label, hide empty, text align, custom_html template, etc.) */
function FieldConfigPopup({
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: (result?: Partial<PrintTemplateBuilderItem>) => void;
  initialData?: { item: PrintTemplateBuilderItem; onApply: (patch: Partial<PrintTemplateBuilderItem>) => void; onRemove?: () => void };
}) {
  const { t } = useTranslation();
  const { item, onApply, onRemove } = initialData ?? { item: null as any, onApply: () => {} };
  const isRefTable = item?.type === "field" && (item?.fields != null || item?.columns != null);
  const isEmptyColumn = item?.type === "empty";
  const [label, setLabel] = React.useState(item?.label ?? "");
  const [hideNoValue, setHideNoValue] = React.useState(!!item?.hide_no_value);
  const [align, setAlign] = React.useState(item?.align ?? "left");
  const [height, setHeight] = React.useState<number | "">(item?.height != null ? Number(item.height) : "");
  const [templateValue, setTemplateValue] = React.useState(item?.type === "custom_html" ? (item.value ?? "") : "");
  const isCustomHtml = item?.type === "custom_html";
  React.useEffect(() => {
    if (item) {
      setLabel(item.label ?? "");
      setHideNoValue(!!item.hide_no_value);
      setAlign(item.align ?? "left");
      setHeight(item.height != null ? Number(item.height) : "");
      if (item.type === "custom_html") setTemplateValue(item.value ?? "");
    }
  }, [item?.id, item?.type]);
  const handleApply = () => {
    if (!item) return;
    if (isEmptyColumn) {
      onApply({ label: label || null });
      onClose();
      return;
    }
    const patch: Partial<PrintTemplateBuilderItem> = {
      label: label || null,
      hide_no_value: hideNoValue ? 1 : 0,
      align: align || "left",
    };
    if (isCustomHtml) patch.value = templateValue;
    if (isRefTable) patch.height = height === "" ? null : Number(height);
    onApply(patch);
    onClose();
  };
  return (
    <div className="zd:space-y-4">
      {isEmptyColumn && (
        <p className="zd:text-sm zd:text-muted-foreground">{t("Reserves a flex column in this row. Prints as blank space.")}</p>
      )}
      {isCustomHtml && (
        <FormControl label={t("Template (binba)")} fieldKey="template" helperText={t("Uses binba template syntax, e.g. {{ doc.id }}")}>
          <textarea
            value={templateValue}
            onChange={(e) => setTemplateValue(e.target.value)}
            placeholder="{{ doc.id }}"
            className="zd:w-full zd:min-h-[120px] zd:rounded-md zd:border zd:border-input zd:bg-background zd:px-3 zd:py-2 zd:text-sm zd:font-mono"
            spellCheck={false}
          />
        </FormControl>
      )}
      <FormControl label={t("Label")} fieldKey="label">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="zd:w-full" placeholder={t("Label")} />
      </FormControl>
      {!isEmptyColumn && (
        <>
          <FormControl label={t("Text align")} fieldKey="align">
            <Select
              options={TEXT_ALIGN_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
              value={align}
              onChange={(v) => setAlign(v)}
              className="zd:w-full"
            />
          </FormControl>
          <FormControl label={t("Hide empty")} fieldKey="hide_no_value">
            <input
              type="checkbox"
              checked={hideNoValue}
              onChange={(e) => setHideNoValue(e.target.checked)}
              className="zd:h-4 zd:w-4 zd:rounded zd:border-input"
            />
          </FormControl>
        </>
      )}
      {isRefTable && (
        <FormControl label={t("Min height (px)")} fieldKey="height" helperText={t("Minimum height for this table in PDF/print.")}>
          <Input
            type="number"
            min={0}
            value={height === "" ? "" : height}
            onChange={(e) => setHeight(e.target.value === "" ? "" : Number(e.target.value))}
            className="zd:w-full"
            placeholder="e.g. 200"
          />
        </FormControl>
      )}
      <div className="zd:flex zd:flex-wrap zd:justify-end zd:gap-2">
        {onRemove && (
          <Button type="button" variant="outline" className="zd:text-destructive" onClick={() => { onRemove(); onClose(); }}>
            {t("Remove element")}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onClose()}>{t("Cancel")}</Button>
        <Button type="button" onClick={handleApply}>{t("Apply")}</Button>
      </div>
    </div>
  );
}

const CANVAS_WORKSPACE_ID = "canvas";
const MAX_FIELDS_PER_ROW = 6;
const DEFAULT_ROW_ID = "__default__";

function toWorkspaceItem(item: PrintTemplateBuilderItem, index: number): WorkspaceItem {
  return {
    id: item.id,
    type: item.type || "field",
    value: item.value ?? null,
    parentid: CANVAS_WORKSPACE_ID,
    parentype: "Workspace",
    parentfield: "workspace_items",
    idx: index,
  };
}

function newId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function newRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type PrintTemplateBuilderProps = {
  /** Doctype name to load fields for palette (from Print Template's doctype field) */
  doctype: string;
  /** Current template items (controlled) */
  items: PrintTemplateBuilderItem[];
  onChange: (items: PrintTemplateBuilderItem[]) => void;
  /** Document title/heading shown at top */
  heading?: string;
  onHeadingChange?: (value: string) => void;
  /** Doc name expression (e.g. "{{ doc.id }}" - use zui.t() in UI for labels) */
  docNameExpression?: string;
  onDocNameExpressionChange?: (value: string) => void;
  /** Exclude Custom HTML from palette (for is_html: 0) */
  excludeCustomHtml?: boolean;
  className?: string;
};

/** Group items by row (group id); returns ordered rows with their items */
function itemsToRows(items: PrintTemplateBuilderItem[]): { rowId: string; items: PrintTemplateBuilderItem[] }[] {
  const byRow = new Map<string, PrintTemplateBuilderItem[]>();
  for (const item of items) {
    const rowId = item.group || DEFAULT_ROW_ID;
    if (!byRow.has(rowId)) byRow.set(rowId, []);
    byRow.get(rowId)!.push(item);
  }
  for (const arr of byRow.values()) {
    arr.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  }
  const rowOrder = Array.from(byRow.keys()).sort((a, b) => {
    const minA = Math.min(...(byRow.get(a) ?? []).map((i) => i.idx ?? 0));
    const minB = Math.min(...(byRow.get(b) ?? []).map((i) => i.idx ?? 0));
    return minA - minB;
  });
  return rowOrder.map((rowId) => ({ rowId, items: byRow.get(rowId) ?? [] }));
}

export function PrintTemplateBuilder({
  doctype,
  items,
  onChange,
  heading = "Document",
  onHeadingChange,
  docNameExpression = "{{ doc.id }}",
  onDocNameExpressionChange,
  excludeCustomHtml = true,
  className,
}: PrintTemplateBuilderProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const [editingHeading, setEditingHeading] = useState(false);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dragOverRowPosition, setDragOverRowPosition] = useState<"before" | "after" | null>(null);
  const [isDraggingRow, setIsDraggingRow] = useState(false);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const isTabletOrUp = useIsTabletOrUp();

  const { docs: allFields } = useDocListAll({ doctype: "Field" as Zodula.DoctypeName });
  const fieldsForDoctype = useMemo(() => {
    if (!doctype) return [];
    return (allFields || [])
      .filter((f: any) => f.doctype === doctype)
      .filter((f: any) => !ClientFieldHelper.isStandardField(f.name || ""))
      .filter((f: any) => !(f.no_print === 1 || f.no_print === true))
      .sort((a: any, b: any) => (a.idx ?? 0) - (b.idx ?? 0));
  }, [allFields, doctype]);

  const paletteEntries = useMemo((): PaletteEntry[] => {
    const out: PaletteEntry[] = [];
    for (const field of fieldsForDoctype) {
      const f = field as any;
      const name = f.name || "";
      const label = f.label || name;
      if (f.type === "Reference Table" && f.reference) {
        out.push({ type: "field", field_name: name, label: `${label}`, isTable: true, reference: f.reference });
      } else {
        out.push({ type: "field", field_name: name, label });
      }
    }
    if (!excludeCustomHtml) {
      out.push({ type: "custom_html", label: "Custom HTML" });
    }
    out.push({ type: "empty", label: t("Empty Column") });
    return out;
  }, [fieldsForDoctype, excludeCustomHtml, t]);

  const availablePaletteEntries = useMemo(() => {
    return paletteEntries.filter((entry) => {
      if (entry.type === "field" && entry.field_name)
        return !items.some((i) => i.type === "field" && i.field_name === entry.field_name);
      if (entry.type === "custom_html") return !items.some((i) => i.type === "custom_html");
      return true;
    });
  }, [paletteEntries, items]);

  const filteredPalette = useMemo(() => {
    if (!filter.trim()) return availablePaletteEntries;
    const q = filter.toLowerCase();
    return availablePaletteEntries.filter((e) => (e.label || "").toLowerCase().includes(q));
  }, [availablePaletteEntries, filter]);

  const rows = useMemo(() => itemsToRows(items), [items]);
  const workspaceItems = useMemo(() => items.map((item, i) => toWorkspaceItem(item, i)), [items]);

  const handleReorder = useCallback(
    (fromId: string, toId: string, type: "before" | "after") => {
      const fromIdx = items.findIndex((i) => i.id === fromId);
      const toIdx = items.findIndex((i) => i.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const targetGroup = items[toIdx]?.group ?? DEFAULT_ROW_ID;
      const newGroup = targetGroup === DEFAULT_ROW_ID ? null : targetGroup;
      const withoutFrom = items.filter((_, i) => i !== fromIdx);
      const toIdxAfter = fromIdx < toIdx ? toIdx - 1 : toIdx;
      const insertAt = type === "before" ? toIdxAfter : toIdxAfter + 1;
      const moved = { ...items[fromIdx], group: newGroup };
      const reordered = [...withoutFrom.slice(0, insertAt), moved, ...withoutFrom.slice(insertAt)];
      const withIdx = reordered.map((it, i) => ({ ...it, idx: i })) as PrintTemplateBuilderItem[];
      onChange(withIdx);
    },
    [items, onChange]
  );

  const { getDropZoneProps, getDragProps, handleDrop: dndHandleDrop, dragOverIndex, dragOverPosition, resetDragState } = useDnd({
    items: workspaceItems,
    onReorder: handleReorder,
  });

  const addItemFromPalette = useCallback(
    (entry: PaletteEntry, insertIndex: number, rowId: string) => {
      const isCustomHtml = entry.type === "custom_html" || (entry.type === "text" && entry.label === "Custom HTML");
      const isEmptyPalette = entry.type === "empty";
      const newItem: PrintTemplateBuilderItem = {
        id: newId(),
        idx: insertIndex,
        type: entry.type === "anchor"
          ? "anchor"
          : isCustomHtml
            ? "custom_html"
            : isEmptyPalette
              ? "empty"
              : entry.type === "text"
                ? "text"
                : "field",
        value: isCustomHtml || entry.type === "text" ? "" : undefined,
        field_name: entry.field_name ?? undefined,
        label: entry.label ?? undefined,
        label_position: "top",
        align: "left",
        hide_no_value: 1,
        group: rowId === DEFAULT_ROW_ID ? null : rowId,
        transform_x: 0,
        transform_y: 0,
        transform_width: 200,
        transform_height: 30,
      };
      if (entry.isTable && entry.reference) {
        newItem.fields = "[]";
        newItem.table_config = JSON.stringify({ showHeader: true, showBorder: true, rowHeight: 20, columns: [] });
      }
      const next = [...items];
      next.forEach((it, i) => (it.idx = i >= insertIndex ? i + 1 : i));
      next.splice(insertIndex, 0, newItem);
      next.forEach((it, i) => (it.idx = i));
      onChange(next);
    },
    [items, onChange]
  );

  const addRow = useCallback(() => {
    const rowId = newRowId();
    const newAnchor: PrintTemplateBuilderItem = {
      id: newId(),
      idx: items.length,
      type: "anchor",
      value: "",
      group: rowId,
      transform_x: 0,
      transform_y: 0,
      transform_width: 200,
      transform_height: 30,
    };
    onChange([...items, newAnchor]);
  }, [items, onChange]);

  const deleteRow = useCallback(
    (rowId: string) => {
      const next = items.filter((i) => (i.group || DEFAULT_ROW_ID) !== rowId);
      next.forEach((it, i) => (it.idx = i));
      onChange(next);
    },
    [items, onChange]
  );

  /** Move a whole row before or after another row; reassigns idx and preserves group. */
  const moveRow = useCallback(
    (fromRowId: string, toRowId: string, position: "before" | "after") => {
      const currentRows = itemsToRows(items);
      const fromIdx = currentRows.findIndex((r) => r.rowId === fromRowId);
      const toIdx = currentRows.findIndex((r) => r.rowId === toRowId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const reordered = currentRows.slice();
      const [removed] = reordered.splice(fromIdx, 1);
      if (!removed) return;
      let insertIdx = position === "before" ? toIdx : toIdx + 1;
      if (fromIdx < insertIdx) insertIdx--;
      reordered.splice(insertIdx, 0, removed);
      const newItems: PrintTemplateBuilderItem[] = [];
      let idx = 0;
      for (const { rowId: rId, items: rowItems } of reordered) {
        for (const it of rowItems) {
          newItems.push({ ...it, idx, group: rId === DEFAULT_ROW_ID ? null : rId });
          idx++;
        }
      }
      onChange(newItems);
    },
    [items, onChange]
  );

  const removeItem = useCallback(
    (id: string) => {
      const next = items.filter((i) => i.id !== id);
      next.forEach((it, i) => (it.idx = i));
      onChange(next);
    },
    [items, onChange]
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<PrintTemplateBuilderItem>) => {
      onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    [items, onChange]
  );

  const openRowSettingsPopup = useCallback(
    (rowId: string, rowTitle: string, anchorItem: PrintTemplateBuilderItem | null) => {
      popup(
        function RowSettingsPopup({ onClose, initialData }: { isOpen: boolean; onClose: () => void; initialData?: { title: string; onApplyTitle: (title: string) => void; onRemoveRow: () => void } }) {
          const { t } = useTranslation();
          const [title, setTitle] = React.useState(initialData?.title ?? "");
          React.useEffect(() => {
            setTitle(initialData?.title ?? "");
          }, [initialData?.title]);
          const onApplyTitle = initialData?.onApplyTitle;
          const onRemoveRow = initialData?.onRemoveRow;
          const handleApply = () => {
            onApplyTitle?.(title.trim() || t("Row"));
            onClose();
          };
          return (
            <div className="zd:space-y-4">
              <FormControl label={t("Row title")} fieldKey="rowTitle">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="zd:w-full" placeholder={t("Row")} />
              </FormControl>
              <div className="zd:flex zd:flex-wrap zd:justify-end zd:gap-2">
                {onRemoveRow && (
                  <Button type="button" variant="outline" className="zd:text-destructive" onClick={() => { onRemoveRow(); onClose(); }}>
                    {t("Remove row")}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => onClose()}>{t("Cancel")}</Button>
                <Button type="button" onClick={handleApply}>{t("Apply")}</Button>
              </div>
            </div>
          );
        } as React.ComponentType<{ isOpen: boolean; onClose: () => void; initialData?: any }>,
        { title: t("Row settings"), width: 320 },
        {
          title: rowTitle,
          onApplyTitle: anchorItem ? (newTitle: string) => updateItem(anchorItem.id, { label: newTitle }) : undefined,
          onRemoveRow: () => deleteRow(rowId),
        }
      );
    },
    [t, deleteRow, updateItem]
  );

  const openConfigPopup = useCallback(
    (item: PrintTemplateBuilderItem) => {
      popup(
        FieldConfigPopup as React.ComponentType<{ isOpen: boolean; onClose: (r?: any) => void; initialData?: any }>,
        {
          title: t("Configure field"),
          description:
            item.type === "custom_html"
              ? t("Custom HTML (binba template)")
              : item.type === "empty"
                ? t("Empty column (layout spacer)")
                : item.field_name
                  ? `${t("Field")}: ${item.field_name}`
                  : undefined,
          width: 420,
        },
        {
          item,
          onApply: (patch: Partial<PrintTemplateBuilderItem>) => updateItem(item.id, patch),
          onRemove: () => removeItem(item.id),
        }
      );
    },
    [t, updateItem, removeItem]
  );

  const openTableColumnsPopup = useCallback(
    (item: PrintTemplateBuilderItem) => {
      popup(
        TableColumnsConfigPopup as React.ComponentType<{ isOpen: boolean; onClose: (r?: any) => void; initialData?: any }>,
        {
          title: t("Select columns"),
          description: item.field_name ? `${t("Table")}: ${item.field_name}` : undefined,
          width: 420,
        },
        {
          item,
          parentDoctype: doctype,
          allFields: allFields ?? [],
          onApply: (patch: Partial<PrintTemplateBuilderItem>) => updateItem(item.id, patch),
          onRemove: () => removeItem(item.id),
        }
      );
    },
    [t, doctype, allFields, updateItem, removeItem]
  );

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent, insertIndex: number, rowId: string) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.paletteEntry) {
          addItemFromPalette(data.paletteEntry as PaletteEntry, insertIndex, rowId);
          return;
        }
        const fromId = data.id ?? data.data?.id;
        if (fromId && items.some((i) => i.id === fromId)) {
          const fromIdx = items.findIndex((i) => i.id === fromId);
          const source = items[fromIdx];
          if (!source || (source.group ?? DEFAULT_ROW_ID) === rowId) return;
          const targetGroup = rowId === DEFAULT_ROW_ID ? null : rowId;
          const withoutFrom = items.filter((_, i) => i !== fromIdx);
          const insertAt = fromIdx < insertIndex ? insertIndex - 1 : insertIndex;
          const moved = { ...source, group: targetGroup };
          const reordered = [...withoutFrom.slice(0, insertAt), moved, ...withoutFrom.slice(insertAt)];
          onChange(reordered.map((it, i) => ({ ...it, idx: i })) as PrintTemplateBuilderItem[]);
          resetDragState();
          setIsDraggingElement(false);
        }
      } catch (_) {}
    },
    [addItemFromPalette, items, onChange, resetDragState]
  );

  const handlePaletteDragStart = useCallback((e: React.DragEvent, entry: PaletteEntry) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ paletteEntry: entry }));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleSidebarDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.id && items.some((i) => i.id === data.id)) {
          removeItem(data.id);
        }
      } catch (_) {}
    },
    [items, removeItem]
  );

  const sidebarContent = (
    <div className="zd:flex zd:flex-col zd:h-full">
      <div
        className="zd:m-2 zd:rounded-lg zd:border-2 zd:border-dashed zd:border-border zd:bg-muted/20 zd:py-4 zd:px-3 zd:text-center zd:text-sm zd:text-muted-foreground"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleSidebarDrop}
      >
        {t("Drag element here to remove")}
      </div>
      <Input
        placeholder={t("Filter...")}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="zd:m-2 zd:h-8"
      />
      <div className="zd:flex-1 zd:overflow-auto zd:px-2 zd:pb-4">
        {!doctype ? (
          <p className="zd:text-sm zd:text-muted-foreground zd:px-2">{t("Select a Doctype in the Print Template to load fields.")}</p>
        ) : (
          filteredPalette.map((entry, i) => (
            <div
              key={`${entry.field_name ?? entry.label}-${i}`}
              draggable
              onDragStart={(e) => handlePaletteDragStart(e, entry)}
              className="zd:flex zd:items-center zd:gap-2 zd:py-2 zd:px-2 zd:rounded-md zd:border zd:border-transparent zd:hover:border-border zd:hover:bg-muted/50 zd:cursor-grab zd:active:cursor-grabbing zd:mb-1"
            >
              <span className="zd:opacity-50 zd:flex-shrink-0" data-drag-handle>
                <GripVertical className="zd:w-4 zd:h-4" />
              </span>
              <div className="zd:flex-1 zd:min-w-0">
                <div className="zd:text-sm zd:truncate zd:font-medium">{entry.label}</div>
                {entry.field_name && (
                  <div className="zd:text-xs zd:text-muted-foreground zd:truncate">{entry.field_name}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderItem = (item: PrintTemplateBuilderItem, index: number, rowId: string) => {
    const wi = toWorkspaceItem(item, index);
    const globalIndex = items.findIndex((i) => i.id === item.id);
    const dropZoneProps = getDropZoneProps(globalIndex, wi);
    const rawDragProps = getDragProps(wi, globalIndex);
    const dragProps = {
      ...rawDragProps,
      onDragStart: (e: React.DragEvent) => {
        setIsDraggingElement(true);
        rawDragProps.onDragStart(e);
      },
      onDragEnd: (e: React.DragEvent) => {
        rawDragProps.onDragEnd(e);
        setIsDraggingElement(false);
      },
    };
    const dropProps = {
      ...dropZoneProps,
      onDrop: (e: React.DragEvent) => {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) {
          try {
            const d = JSON.parse(raw);
            if (d.paletteEntry) {
              addItemFromPalette(d.paletteEntry as PaletteEntry, globalIndex, rowId);
              return;
            }
          } catch (_) {}
        }
        dndHandleDrop(e, wi, globalIndex);
      },
    };
    const isTable = !!(item.type === "field" && item.fields);
    const displayLabel =
      item.type === "empty" ? item.label || t("Empty Column") : item.label || item.field_name || item.type || t("Item");
    const customHtmlSubtitle = item.type === "custom_html" ? (item.value?.trim() ? `${item.value.slice(0, 40)}${(item.value?.length ?? 0) > 40 ? "…" : ""}` : t("(empty template)")) : null;
    const selectedCols = parseJsonArray(item.columns ?? item.fields);
    const selectedNestedCols = parseJsonArray(item.nested_columns);
    const hasColumnConfig = selectedCols.length > 0 || selectedNestedCols.length > 0;
    const hideEmpty = item.type === "field" && (item.hide_no_value === 1 || item.hide_no_value === true);

    if (item.type === "anchor" && !item.field_name) {
      return null;
    }

    const dropClassName = (dropProps as { className?: string }).className ?? "";
    const dropClassNameWithoutBorder = dropClassName
      .replace(/zd:border-t-2 zd:border-blue-500/g, "")
      .replace(/zd:border-b-2 zd:border-blue-500/g, "")
      .trim();
    const isDropTargetBefore = dragOverIndex === globalIndex && dragOverPosition === "before";
    const isDropTargetAfter = dragOverIndex === globalIndex && dragOverPosition === "after";

    return (
      <div className="zd:relative">
        {isDropTargetBefore && (
          <div className="zd:absolute zd:left-0 zd:right-0 zd:top-0 zd:h-0.5 zd:-translate-y-1/2 zd:z-10 zd:rounded-full zd:bg-blue-500" aria-hidden />
        )}
        <div
          onDragOver={dropProps.onDragOver}
          onDragLeave={dropProps.onDragLeave}
          onDrop={dropProps.onDrop}
          data-drop-index={dropProps["data-drop-index"]}
          className={cn("zd:rounded-lg zd:border zd:border-border zd:bg-card zd:shadow-sm zd:overflow-hidden", dropClassNameWithoutBorder)}
        >
          <div
            className={cn("zd:flex zd:items-center zd:gap-2 zd:px-3 zd:py-2 zd:min-h-[44px]", (dragProps as { className?: string }).className)}
            draggable={dragProps.draggable}
            onDragStart={dragProps.onDragStart}
            onDragEnd={dragProps.onDragEnd}
            data-drag-id={dragProps["data-drag-id"]}
          >
            <span className="zd:cursor-grab zd:active:cursor-grabbing zd:text-muted-foreground zd:flex-shrink-0" data-drag-handle>
              <GripVertical className="zd:w-4 zd:h-4" />
            </span>
            <div className="zd:flex-1 zd:min-w-0">
              <div className="zd:flex zd:items-center zd:gap-1 zd:flex-wrap">
                {item.type === "anchor" && <span className="zd:text-muted-foreground">:: </span>}
                <span className="zd:font-medium">{displayLabel}</span>
                {isTable && <span className="zd:text-muted-foreground zd:ml-1">({t("Table")})</span>}
                {hideEmpty && (
                  <span className="zd:text-[10px] zd:px-1.5 zd:py-0.5 zd:rounded zd:bg-muted zd:text-muted-foreground">
                    {t("Hide empty")}
                  </span>
                )}
              </div>
              {item.field_name && (
                <div className="zd:text-xs zd:text-muted-foreground zd:truncate">{item.field_name}</div>
              )}
              {hasColumnConfig && (
                <div className="zd:text-xs zd:text-muted-foreground zd:truncate">
                  {selectedCols.length > 0 && (
                    <span>
                      {t("Columns")}: {selectedCols.map((c, i) => `${i + 1}. ${c}`).join(", ")}
                    </span>
                  )}
                  {selectedCols.length > 0 && selectedNestedCols.length > 0 && " | "}
                  {selectedNestedCols.length > 0 && (
                    <span>
                      {t("Nested")}: {selectedNestedCols.map((c, i) => `${i + 1}. ${c}`).join(", ")}
                    </span>
                  )}
                </div>
              )}
              {customHtmlSubtitle != null && (
                <div className="zd:text-xs zd:text-muted-foreground zd:truncate zd:font-mono">{customHtmlSubtitle}</div>
              )}
            </div>
            <div className="zd:flex zd:items-center zd:gap-1 zd:flex-shrink-0">
              {isTable && (
                <Button size="sm" variant="outline" className="zd:h-7 zd:text-xs" onClick={() => openTableColumnsPopup(item)}>
                  {t("Select Columns")}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="zd:h-8 zd:w-8 zd:p-0" onClick={() => openConfigPopup(item)} title={t("Configure field")}>
                <Settings2 className="zd:w-4 zd:h-4" />
              </Button>
            </div>
          </div>
        </div>
        {isDropTargetAfter && (
          <div className="zd:absolute zd:left-0 zd:right-0 zd:bottom-0 zd:h-0.5 zd:translate-y-1/2 zd:z-10 zd:rounded-full zd:bg-blue-500" aria-hidden />
        )}
      </div>
    );
  };

  return (
    <div className={cn("zd:flex zd:h-full zd:min-h-[520px] zd:min-h-0 zd:gap-4", className)}>
      {/* Main content */}
      <div className="zd:flex zd:flex-col zd:flex-1 zd:min-w-0 zd:overflow-y-auto zd:gap-4">
        <p className="zd:text-muted-foreground zd:text-sm">
          {t("Drag elements from the sidebar to add. Drag to reorder. Max 6 fields per row.")}
        </p>

        {/* Header block */}
        <div className="zd:rounded-lg zd:border zd:border-border zd:bg-card zd:p-4 zd:shadow-sm">
          {editingHeading ? (
            <div className="zd:flex zd:items-center zd:gap-2">
              <Input
                value={heading}
                onChange={(e) => onHeadingChange?.(e.target.value)}
                className="zd:flex-1 zd:font-semibold zd:text-lg"
              />
              <Button size="sm" variant="ghost" onClick={() => setEditingHeading(false)}>
                {t("Done")}
              </Button>
            </div>
          ) : (
            <div className="zd:flex zd:items-center zd:justify-between">
              <h2 className="zd:font-bold zd:text-xl" onClick={() => setEditingHeading(true)}>
                {heading}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setEditingHeading(true)} className="zd:gap-1">
                <Pencil className="zd:w-3 zd:h-3" /> {t("Edit Heading")}
              </Button>
            </div>
          )}
          {(onDocNameExpressionChange || docNameExpression) && (
            <div className="zd:mt-2">
              {onDocNameExpressionChange ? (
                <Input
                  value={docNameExpression}
                  onChange={(e) => onDocNameExpressionChange(e.target.value)}
                  placeholder={t("e.g. {{ doc.id }}")}
                  className="zd:font-mono zd:text-sm"
                />
              ) : (
                <span className="zd:font-mono zd:text-sm zd:text-muted-foreground">{docNameExpression}</span>
              )}
            </div>
          )}
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div
            className="zd:rounded-lg zd:border-2 zd:border-dashed zd:border-border zd:bg-muted/20 zd:py-12 zd:text-center zd:text-muted-foreground"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleCanvasDrop(e, 0, DEFAULT_ROW_ID)}
          >
            {t("Drop elements here or add a row below")}
          </div>
        ) : (
          rows.map(({ rowId, items: rowItems }, rowIndex) => {
            const count = rowItems.filter((i) => i.type !== "anchor" || i.field_name).length;
            const canAddToRow = count < MAX_FIELDS_PER_ROW;
            const anchorItem = rowItems.find((i) => i.type === "anchor" && !i.field_name) ?? null;
            const rowTitle = anchorItem?.label?.trim() || `${t("Row")} ${rowIndex + 1}`;

            const handleRowDrop = (e: React.DragEvent) => {
              setDragOverRowId(null);
              setDragOverRowPosition(null);
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              try {
                const data = JSON.parse(raw);
                if (data.rowId && data.rowId !== rowId) {
                  moveRow(data.rowId, rowId, dragOverRowPosition || "before");
                  return;
                }
                const fromId = data.id ?? data.data?.id;
                if (fromId && items.some((i) => i.id === fromId)) {
                  const it = items.find((i) => i.id === fromId);
                  if ((it?.group ?? DEFAULT_ROW_ID) === rowId) return;
                  const lastInRow = rowItems[rowItems.length - 1];
                  const insertIdx = lastInRow ? items.findIndex((x) => x.id === lastInRow.id) + 1 : items.length;
                  handleCanvasDrop(e, insertIdx, rowId);
                  return;
                }
                if (data.paletteEntry) {
                  const lastInRow = rowItems[rowItems.length - 1];
                  const insertIdx = lastInRow ? items.findIndex((x) => x.id === lastInRow.id) + 1 : items.length;
                  handleCanvasDrop(e, insertIdx >= 0 ? insertIdx : items.length, rowId);
                }
              } catch (_) {}
            };

            const handleRowDragOver = (e: React.DragEvent) => {
              if (!e.dataTransfer.types.includes("application/json")) return;
              e.preventDefault();
              setDragOverRowId(rowId);
              if (isDraggingRow) {
                const rowEl = (e.currentTarget as HTMLElement).closest("[data-row-id]");
                if (rowEl) {
                  const rect = rowEl.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  setDragOverRowPosition(y < rect.height / 2 ? "before" : "after");
                }
              } else {
                setDragOverRowPosition(null);
              }
            };

            const handleRowDragLeave = () => {
              setDragOverRowId(null);
              setDragOverRowPosition(null);
            };

            return (
              <div key={rowId} className="zd:relative">
                {dragOverRowId === rowId && isDraggingRow && dragOverRowPosition === "before" && (
                  <div className="zd:absolute zd:left-0 zd:right-0 zd:top-0 zd:h-0.5 zd:-translate-y-1/2 zd:z-10 zd:rounded-full zd:bg-blue-500" aria-hidden />
                )}
                <div
                  data-row-id={rowId}
                  draggable
                  onDragStart={(e) => {
                    if ((e.target as HTMLElement).closest("[data-drag-id]")) return;
                    e.dataTransfer.setData("application/json", JSON.stringify({ rowId }));
                    e.dataTransfer.effectAllowed = "move";
                    setIsDraggingRow(true);
                  }}
                  onDragEnd={() => {
                    setIsDraggingRow(false);
                    setDragOverRowId(null);
                    setDragOverRowPosition(null);
                  }}
                  className={cn(
                    "zd:rounded-lg zd:border zd:border-border zd:bg-muted/20 zd:transition-[outline,box-shadow] zd:cursor-grab zd:active:cursor-grabbing",
                    dragOverRowId === rowId && !isDraggingRow && "zd:outline zd:outline-2 zd:outline-dashed zd:outline-blue-500 zd:outline-offset-0"
                  )}
                >
                  <div
                    className="zd:flex zd:items-center zd:justify-between zd:gap-2 zd:px-3 zd:py-2 zd:min-h-[44px] zd:border-b zd:border-border/50"
                    onDragOver={handleRowDragOver}
                    onDragLeave={handleRowDragLeave}
                    onDrop={handleRowDrop}
                  >
                    <span className="zd:text-xs zd:font-medium zd:text-muted-foreground zd:flex zd:items-center zd:gap-1 zd:flex-1 zd:min-w-0">
                      <GripVertical className="zd:w-3 zd:h-3 zd:flex-shrink-0" />
                      <Rows3 className="zd:w-3 zd:h-3" />
                      <span className="zd:truncate">{rowTitle}</span>
                    </span>
                    <Button size="sm" variant="ghost" className="zd:h-7 zd:w-7 zd:p-0" onClick={(e) => { e.stopPropagation(); openRowSettingsPopup(rowId, rowTitle, anchorItem); }} title={t("Row settings")}>
                      <Settings2 className="zd:w-3 zd:h-3" />
                    </Button>
                  </div>
                <div
                  className={cn("zd:flex zd:flex-wrap zd:gap-2 zd:min-h-[60px] zd:p-3 zd:rounded-b-lg")}
                  onDragOver={handleRowDragOver}
                  onDragLeave={handleRowDragLeave}
                  onDrop={handleRowDrop}
                >
                  {rowItems.map((item, i) => {
                    if (item.type === "anchor" && !item.field_name) return null;
                    const globalIdx = items.findIndex((x) => x.id === item.id);
                    return <div key={item.id} className="zd:relative zd:min-w-[200px] zd:flex-1 zd:max-w-full">{renderItem(item, globalIdx, rowId)}</div>;
                  })}
                  {canAddToRow && count === 0 && (
                    <div
                      className="zd:min-w-[120px] zd:flex-1 zd:rounded zd:border-2 zd:border-dashed zd:border-border zd:py-4 zd:px-4 zd:text-center zd:text-muted-foreground zd:text-sm"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        setDragOverRowId(null);
                        const rowIndex = rows.findIndex((r) => r.rowId === rowId);
                        const startOfRow = rowIndex <= 0 ? 0 : rows.slice(0, rowIndex).reduce((sum, r) => sum + r.items.length, 0);
                        handleCanvasDrop(e, startOfRow + 1, rowId);
                      }}
                    >
                      {t("Drop here")}
                    </div>
                  )}
                </div>
                </div>
                {dragOverRowId === rowId && isDraggingRow && dragOverRowPosition === "after" && (
                  <div className="zd:absolute zd:left-0 zd:right-0 zd:bottom-0 zd:h-0.5 zd:translate-y-1/2 zd:z-10 zd:rounded-full zd:bg-blue-500" aria-hidden />
                )}
              </div>
            );
          })
        )}

        <Button type="button" variant="outline" onClick={addRow} className="zd:w-fit zd:gap-2">
          <Plus className="zd:w-4 zd:h-4" /> {t("Add row")}
        </Button>
      </div>

      {/* Palette sidebar */}
      {isTabletOrUp && (
        <div className="zd:w-72 zd:shrink-0 zd:border zd:border-border zd:rounded-xl zd:bg-card zd:overflow-y-auto zd:shadow-sm zd:p-3">
          {sidebarContent}
        </div>
      )}
    </div>
  );
}

export default PrintTemplateBuilder;
export type { PrintTemplateBuilderItem, PaletteEntry } from "./types";
