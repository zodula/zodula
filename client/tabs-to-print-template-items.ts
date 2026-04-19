import { ClientFieldHelper } from "@/zodula/client/field";
import type { PrintTemplateBuilderItem } from "@/zodula/ui/components/custom/print-template-builder/types";

type FieldRow = {
  name: string;
  type?: string;
  label?: string;
  reference?: string;
  no_print?: number | boolean;
  required?: number | boolean;
  in_list_view?: number | boolean;
  idx?: number;
  height?: number | string | null;
};

type SchemaFieldsMap = Record<
  string,
  { type?: string; label?: string; reference?: string; no_print?: number; height?: number | string | null }
>;

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function toRowArray(entry: unknown): unknown[] {
  if (Array.isArray(entry)) return entry;
  return entry != null ? [entry] : [];
}

function getDefaultColumnsForReferenceTable(childFields: FieldRow[]): string[] {
  return childFields
    .filter((f) => !ClientFieldHelper.isStandardField(f.name || ""))
    .filter((f) => (f.required === 1 || f.required === true || f.in_list_view === 1 || f.in_list_view === true) && !(f.no_print === 1 || f.no_print === true))
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
    .map((f) => f.name);
}

function fieldRowsToSchemaMap(rows: FieldRow[]): SchemaFieldsMap {
  const m: SchemaFieldsMap = {};
  for (const f of rows) {
    if (!f?.name) continue;
    m[f.name] = {
      type: f.type,
      label: f.label,
      reference: f.reference,
      no_print: (f.no_print === 1 || f.no_print === true) ? 1 : 0,
      height: f.height,
    };
  }
  return m;
}

function toPrintTemplateBuilderItem(
  raw: {
    id: string;
    idx: number;
    type: PrintTemplateBuilderItem["type"];
    value?: string | null;
    field_name?: string | null;
    label?: string | null;
    hide_no_value?: number | boolean | null;
    align?: string | null;
    group?: string | null;
    columns?: string | null;
    fields?: string | null;
    nested_field?: string | null;
    nested_table_field?: string | null;
    nested_table_field_doctype?: string | null;
    nested_columns?: string | null;
    height?: number | null;
  },
): PrintTemplateBuilderItem {
  return {
    id: raw.id,
    idx: raw.idx,
    type: raw.type,
    value: raw.value ?? null,
    code: null,
    group: raw.group ?? null,
    field_name: raw.field_name ?? null,
    label: raw.label ?? null,
    label_position: "left",
    align: raw.align ?? "left",
    vertical_align: "middle",
    hide_no_value: raw.hide_no_value ?? 1,
    fields: raw.fields ?? null,
    columns: raw.columns ?? null,
    nested_field: raw.nested_field ?? null,
    nested_table_field: raw.nested_table_field ?? null,
    nested_table_field_doctype: raw.nested_table_field_doctype ?? null,
    nested_columns: raw.nested_columns ?? null,
    height: raw.height ?? null,
    table_config: null,
    anchor_config: null,
    transform_x: 0,
    transform_y: 0,
    transform_width: 200,
    transform_height: 30,
    style_font_size: null,
    style_font_weight: null,
    style_font_style: null,
    style_text_decoration: null,
    image: null,
    reference_doctype: null,
    reference_id_filter: null,
    reference_field: null,
  };
}

/**
 * Build print template builder items from a doctype tab layout + schema (same rules as server `tabsToTemplateItem` in code-utils).
 */
export function tabsLayoutToPrintTemplateBuilderItems(
  tabs: Array<{ type?: string; label?: string; layout?: unknown[] }>,
  schemaFields: SchemaFieldsMap,
  childColumnsByRefDoctype: Record<string, string[]>,
): PrintTemplateBuilderItem[] {
  const items: PrintTemplateBuilderItem[] = [];
  let idx = 0;
  let rowIndex = 0;

  function collectField(value: string, label: string, group: string) {
    if (!value || typeof value !== "string") return;
    const fieldDef = schemaFields[value];
    if (fieldDef?.no_print === 1) return;
    const isRefTable = fieldDef?.type === "Reference Table";
    const refTableExtras =
      isRefTable && fieldDef?.reference
        ? (() => {
            const defaultCols = childColumnsByRefDoctype[fieldDef.reference!] ?? [];
            const h = fieldDef.height;
            const heightNum = typeof h === "number" ? h : typeof h === "string" && h !== "" ? Number(h) : NaN;
            return {
              columns: defaultCols.length > 0 ? JSON.stringify(defaultCols) : null,
              fields: "[]" as string | null,
              nested_field: null as string | null,
              nested_table_field: null as string | null,
              nested_table_field_doctype: null as string | null,
              nested_columns: null as string | null,
              height: Number.isFinite(heightNum) ? heightNum : null,
            };
          })()
        : {};
    items.push(
      toPrintTemplateBuilderItem({
        id: `field_${idx}_${value}`,
        idx,
        type: "field",
        field_name: value,
        label: label ?? value,
        hide_no_value: 1,
        align: "left",
        group,
        ...refTableExtras,
      }),
    );
    idx += 1;
  }

  function walkLayout(layout: unknown[]) {
    if (!Array.isArray(layout)) return;
    for (const entry of layout) {
      const row = toRowArray(entry);
      if (row.length === 0) continue;
      const rowId = `row_${rowIndex}`;
      rowIndex += 1;
      let rowHasPrintable = false;
      const deferredEmpties: PrintTemplateBuilderItem[] = [];
      function pushDeferredEmpties() {
        for (const e of deferredEmpties) {
          items.push(e);
        }
        deferredEmpties.length = 0;
      }
      function visitCell(node: unknown) {
        if (Array.isArray(node)) {
          for (const n of node) visitCell(n);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (obj?.type === "empty") {
          deferredEmpties.push(
            toPrintTemplateBuilderItem({
              id: `empty_${idx}`,
              idx,
              type: "empty",
              hide_no_value: 1,
              align: "left",
              group: rowId,
            }),
          );
          idx += 1;
          return;
        }
        if (obj?.type === "field" && typeof obj.value === "string") {
          const val = obj.value;
          const fd = schemaFields[val];
          if (fd?.no_print === 1) return;
          const lbl = (schemaFields[val]?.label as string) ?? "";
          const countBefore = items.length;
          pushDeferredEmpties();
          collectField(val, lbl, rowId);
          if (items.length > countBefore) rowHasPrintable = true;
        }
      }
      for (const cell of row) visitCell(cell);
      if (rowHasPrintable) {
        pushDeferredEmpties();
      }
      if (!rowHasPrintable) {
        rowIndex -= 1;
      }
    }
  }

  for (const tab of tabs) {
    const layout = tab.layout;
    if (!Array.isArray(layout)) continue;
    walkLayout(layout);
  }

  return items;
}

export type LoadPrintTemplateFromDoctypeResult = {
  items: PrintTemplateBuilderItem[];
  sectionTitle: string;
  docNameExpression: string;
};

/**
 * Loads Field rows, builds tab layout items (client-side equivalent of server `tabsToTemplateItem`).
 * `doctypeDoc` should be a Doctype document with `name`, `tabs`, `label`, `display_field`.
 */
type ZodulaClientDoc = Pick<typeof import("@/zodula/client").zodula, "doc">;

export async function loadPrintTemplateItemsFromDoctypeTabs(
  client: ZodulaClientDoc,
  doctypeDoc: { name: string; tabs?: unknown; label?: string | null; display_field?: string | null },
): Promise<LoadPrintTemplateFromDoctypeResult | null> {
  const doctypeName = doctypeDoc.name;
  if (!doctypeName) return null;

  const rawTabs = doctypeDoc.tabs;
  const tabs: Array<{ type?: string; label?: string; layout?: unknown[] }> =
    typeof rawTabs === "string" ? (safeJsonParse(rawTabs) ?? []) : (rawTabs as any) ?? [];
  if (!Array.isArray(tabs) || tabs.length === 0) return null;

  const parentFieldsRes = await client.doc.select_docs("Field", {
    filters: [["doctype", "=", doctypeName]] as any,
    limit: -1,
    sort: "idx",
    order: "asc",
  });
  const parentRows = (parentFieldsRes.docs ?? []) as FieldRow[];
  const schemaFields = fieldRowsToSchemaMap(parentRows);

  const uniqueChildRefs = [
    ...new Set(
      Object.values(schemaFields)
        .filter((f) => f?.type === "Reference Table" && f.reference)
        .map((f) => String(f.reference)),
    ),
  ];

  const childColumnsByRefDoctype: Record<string, string[]> = {};
  await Promise.all(
    uniqueChildRefs.map(async (refName) => {
      const { docs } = await client.doc.select_docs("Field", {
        filters: [["doctype", "=", refName]] as any,
        limit: -1,
        sort: "idx",
        order: "asc",
      });
      childColumnsByRefDoctype[refName] = getDefaultColumnsForReferenceTable((docs ?? []) as FieldRow[]);
    }),
  );

  const items = tabsLayoutToPrintTemplateBuilderItems(tabs, schemaFields, childColumnsByRefDoctype);
  if (items.length === 0) return null;

  const df = doctypeDoc.display_field != null && String(doctypeDoc.display_field).trim() !== ""
    ? String(doctypeDoc.display_field).trim()
    : "";
  const docNameExpression = df ? `{{ doc.${df} }}` : "{{ doc.id }}";

  return {
    items,
    sectionTitle: (doctypeDoc.label != null && String(doctypeDoc.label).trim() !== "" ? String(doctypeDoc.label) : doctypeName) as string,
    docNameExpression,
  };
}
