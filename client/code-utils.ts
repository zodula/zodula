import path from "path";
import { loader } from "../server/loader";
import type { DoctypeMetadata } from "../server/loader/plugins/doctype";
import { translate } from "../server/zodula/utils";
import fs from "fs";
import { ClientFieldHelper } from "./field";

// Page format dimensions in mm
export const PAGE_FORMATS: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
  "210x30mm": { width: 210, height: 30 },
  "30x30mm": { width: 30, height: 30 },
};

const DEFAULT_ROW_ID = "__default";

/** Template item shape used for print (subset of Print Template Item / PrintTemplateBuilderItem) */
export interface TemplateItemForPrint {
  id?: string;
  idx?: number;
  type: "text" | "field" | "image" | "line" | "reference" | "custom_html" | "anchor";
  value?: string | null;
  field_name?: string | null;
  label?: string | null;
  /** "left" | "right" | "top" | "bottom" - for field type, label position relative to value */
  label_position?: string | null;
  hide_no_value?: number | boolean | null;
  align?: string | null;
  /** Row/group id; items with the same group are rendered in one visual row */
  group?: string | null;
  /** JSON array of column field names for reference table */
  columns?: string | null;
  /** Reference field on each child row for nested table (e.g. delivery_order) */
  nested_field?: string | null;
  /** Field on nested doctype holding the child table (e.g. items). When empty, auto-detected. */
  nested_table_field?: string | null;
  /** JSON array of nested table column field names */
  nested_columns?: string | null;
  /** Legacy: JSON child fields for reference table */
  fields?: string | null;
  table_config?: string | null;
}

/** Normalize layout entry: if not array, wrap in array so structure is uniform. */
function toRowArray(entry: unknown): unknown[] {
  if (Array.isArray(entry)) return entry;
  return entry != null ? [entry] : [];
}

/** Get default columns for a Reference Table: (required || in_list_view) && !no_print, excluding standard fields. */
function getDefaultColumnsForReferenceTable(childDoctypeName: string): string[] {
  try {
    const childMeta = loader.from("doctype").get(childDoctypeName as any);
    const fields = childMeta?.schema?.fields as Record<string, { required?: number; in_list_view?: number; no_print?: number; idx?: number }> | undefined;
    if (!fields) return [];
    return Object.entries(fields)
      .filter(([name]) => !ClientFieldHelper.isStandardField(name))
      .filter(([, f]) => (f?.required === 1 || f?.in_list_view === 1) && !(f?.no_print === 1))
      .sort(([, a], [, b]) => (a?.idx ?? 0) - (b?.idx ?? 0))
      .map(([name]) => name);
  } catch {
    return [];
  }
}

/** Recursively collect field objects from a row (handles nested arrays). */
function collectFieldObjectsFromRow(row: unknown[], out: Record<string, unknown>[]): void {
  for (const entry of row) {
    if (Array.isArray(entry)) {
      collectFieldObjectsFromRow(entry, out);
      continue;
    }
    const obj = entry as Record<string, unknown>;
    if (obj?.type === "field" && typeof obj.value === "string") out.push(obj);
  }
}

/**
 * Build an array of template items from a doctype's tabs layout.
 * Mirrors the tab layout structure: each layout row (array of fields) produces items that share the same group.
 * Entries that are not arrays are normalized to single-element arrays.
 */
export function tabsToTemplateItem(
  doctype: DoctypeMetadata
): TemplateItemForPrint[] {
  const raw = doctype.config.tabs;
  if (raw == null) return [];
  const tabs: Array<{ type?: string; label?: string; layout?: unknown[] }> =
    typeof raw === "string" ? (safeJsonParse(raw) ?? []) : raw;
  if (!Array.isArray(tabs)) return [];

  const items: TemplateItemForPrint[] = [];
  let idx = 0;
  let rowIndex = 0;
  const schemaFields = doctype.schema.fields as Record<string, { type?: string; label?: string; reference?: string }>;

  function collectField(value: string, label: string, group: string) {
    if (!value || typeof value !== "string") return;
    const fieldDef = schemaFields[value] as { type?: string; reference?: string } | undefined;
    const isRefTable = fieldDef?.type === "Reference Table";
    const refTableExtras =
      isRefTable && fieldDef?.reference
        ? (() => {
            const defaultCols = getDefaultColumnsForReferenceTable(fieldDef.reference);
            return {
              columns: defaultCols.length > 0 ? JSON.stringify(defaultCols) : null,
              fields: "[]",
              nested_field: null,
              nested_table_field: null,
              nested_columns: null,
            };
          })()
        : {};
    items.push({
      id: `field_${idx}_${value}`,
      idx,
      type: "field",
      field_name: value,
      label: label ?? value,
      hide_no_value: 1,
      align: "left",
      group,
      ...refTableExtras,
    });
    idx += 1;
  }

  function walkLayout(layout: unknown[]) {
    if (!Array.isArray(layout)) return;
    for (const entry of layout) {
      const row = toRowArray(entry);
      if (row.length === 0) continue;
      const fieldObjs: Record<string, unknown>[] = [];
      collectFieldObjectsFromRow(row, fieldObjs);
      if (fieldObjs.length === 0) continue;
      const rowId = `row_${rowIndex}`;
      rowIndex += 1;
      for (const obj of fieldObjs) {
        const val = obj.value as string;
        const label = (schemaFields[val]?.label as string) ?? "";
        collectField(val, label, rowId);
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

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  // server side
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/** Group items by row (group id), sort rows by min idx of items in each row. Empty/whitespace group = same default row. */
function itemsToRows(items: TemplateItemForPrint[]): TemplateItemForPrint[][] {
  const byRow = new Map<string, TemplateItemForPrint[]>();
  for (const item of items) {
    const raw = item.group != null ? String(item.group).trim() : "";
    const rowId = raw ? raw : DEFAULT_ROW_ID;
    if (!byRow.has(rowId)) byRow.set(rowId, []);
    byRow.get(rowId)!.push(item);
  }
  const rows = Array.from(byRow.entries()).map(([, rowItems]) => {
    rowItems.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    return rowItems;
  });
  rows.sort((a, b) => {
    const minA = Math.min(...a.map((i) => i.idx ?? 0));
    const minB = Math.min(...b.map((i) => i.idx ?? 0));
    return minA - minB;
  });
  return rows;
}

async function renderReferenceTable(
  item: TemplateItemForPrint,
  doctype: Zodula.DoctypeName,
  language: string,
  doc: any,
): Promise<string> {
  const allColumns: string[] = [];

  const parentDoctypeMeta = loader.from("doctype").get(doctype as any);
  const childField = parentDoctypeMeta?.schema?.fields[item?.field_name as keyof typeof parentDoctypeMeta.schema.fields];
  const childDoctypeMeta = loader.from("doctype").get(childField?.reference as any);
  const nestedField = item.nested_field ? childDoctypeMeta?.schema?.fields[item?.nested_field as keyof typeof childDoctypeMeta.schema.fields] : null;
  const nestedDoctypeMeta = nestedField ? loader.from("doctype").get(nestedField?.reference as any) : null;
  const nestedChildDoctypeMeta = nestedDoctypeMeta ? loader.from("doctype").get(nestedDoctypeMeta?.schema?.fields[item.nested_table_field as keyof typeof nestedDoctypeMeta.schema.fields]?.reference as any) : null;

  if (item.columns) {
    allColumns.push(...(safeJsonParse<string[]>(item.columns ?? "[]") ?? []));
  }
  if (item.nested_columns) {
    const nestedColumns = safeJsonParse<string[]>(item.nested_columns ?? "[]");
    for (const column of nestedColumns ?? []) {
      allColumns.push(`${item.nested_field}.${column}`);
    }
  }

  let html = `<table class="print-ref-table"><thead class="print-th-row"><tr class="print-th-row">`;
  for (const column of allColumns) {
    if (column.includes(".")) {
      const [nestedFieldName, nestedColumnName] = column.split(".");
      const nestedColumnField = nestedChildDoctypeMeta?.schema?.fields[nestedColumnName as keyof typeof nestedChildDoctypeMeta.schema.fields];
      const label = nestedColumnField?.label as string ?? "";
      html += `<th class="print-th">${translate(label, language)}</th>`;
    } else {
      const columnField = childDoctypeMeta?.schema?.fields[column as keyof typeof parentDoctypeMeta.schema.fields];
      const label = columnField?.label as string ?? "";
      html += `<th class="print-th">${translate(label, language)}</th>`;
    }
  }
  html += `</tr></thead><tbody>`

  const childDocs = doc[item.field_name as keyof typeof doc];
  for (const childDoc of childDocs) {
    html += `<tr class="print-td-row">`;
    for (const childItem of childDocs) {
      for (const column of allColumns) {
        if (!column.includes(".")) {
          const columnField = childDoctypeMeta?.schema?.fields[column as keyof typeof childDoctypeMeta.schema.fields];
          const value = childDoc[column as keyof typeof childDoc];
          html += `<td class="print-td">${value || ""}</td>`;
        } else {
          html += `<td class="print-td"></td>`
        }
      }
      if (nestedChildDoctypeMeta?.name) {
        const { docs: nestedChildDocs } = await $zodula.doctype(nestedChildDoctypeMeta?.name).select().where("parentid", "=", childDoc[item.nested_field as keyof typeof childDoc])
        for (const nestedChildDoc of nestedChildDocs) {
          html += `<tr class="print-td-row">`;
          for (const column of allColumns) {
            if (column.includes(".")) {
              const [, nestedColumnName] = column.split(".");
              const value = nestedChildDoc[nestedColumnName as keyof typeof nestedChildDoc];
              html += `<td class="print-td">${value || ""}</td>`;
            } else {
              html += `<td class="print-td"></td>`
            }
          }
          html += `</tr>`;
        }
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`
  return html
}

async function renderFieldCellValue(
  doctype: Zodula.DoctypeName,
  field: Zodula.Field | undefined,
  item: TemplateItemForPrint,
  doc: Record<string, unknown>,
  renderCustomHtml: (html: string) => Promise<string>,
  language: string,
  fetchRefDoc?: (doctype: string, id: string) => Promise<Record<string, unknown> | null>
): Promise<string | null> {
  const raw = item.field_name ? doc[item.field_name as keyof typeof doc] : null;
  if((raw === "" || raw === null || raw === undefined) && item.hide_no_value) return null;
  const textAlign = item.align === "center" || item.align === "right" ? item.align : "left";
  let escapedValue = raw != null ? String(raw) : "";
  if (field?.type === "Select" && field?.no_translate !== 1) {
    escapedValue = translate(escapedValue as string, language);
  }
  if (field?.type === "File" && field?.accept?.includes("image/*")) {
    if(!escapedValue) return null;
    const imageFile = fs.readFileSync(path.join(process.cwd(), ".zodula_data", ["files", doc.organization, doctype, doc.id, item.field_name, escapedValue].join("/")));
    escapedValue = `<div class="print-image-container" style="float:${textAlign}"><img class="print-image" src="data:image/jpeg;base64,${imageFile.toString('base64')}" alt="" style="width: 100%; max-height: 150px; object-fit: contain;" /></div>`;
  }

  if (field?.type === "Check") {
    escapedValue = escapedValue === "1" ? "<input type=\"checkbox\" checked disabled />" : "<input type=\"checkbox\" disabled />";
  }

  if (field?.type === "Reference Table") {
    escapedValue = await renderReferenceTable(item, doctype, language, doc).then((html) => html).catch((e) => `<span class=\"print-error\">Template error: ${e.message}</span>`);
  }
  if (item.hide_no_value && raw === "") return null;
  return escapedValue;
}

async function renderCellContent(
  doctype: Zodula.DoctypeName,
  item: TemplateItemForPrint,
  doc: Record<string, unknown>,
  renderCustomHtml: (html: string) => Promise<string>,
  language: string,
  fetchRefDoc?: (doctype: string, id: string) => Promise<Record<string, unknown> | null>
): Promise<string | null> {
  if (item.type === "field") {
    const label = translate(item.label as string ?? item.field_name as string ?? "", language);
    const doctypeMeta = loader.from("doctype").get(doctype);
    const field = doctypeMeta.schema.fields[item.field_name as keyof typeof doctypeMeta.schema.fields];
    const escapedValue = await renderFieldCellValue(doctype, field, item, doc, renderCustomHtml, language, fetchRefDoc);
    if (escapedValue == null && item.hide_no_value) return null;
    const align = item.align === "center" || item.align === "right" ? item.align : "left";
    const labelPosition = (item.label_position ?? "top").toLowerCase();
    const isLabelOnTop = labelPosition === "top" || labelPosition === "bottom";
    if (isLabelOnTop) {
      const labelBlock = `<div class="print-label">${escapeHtml(label)}</div>`;
      const valueBlock = `<div class="print-value" style="text-align:${align}">${escapedValue}</div>`;
      const order = labelPosition === "top" ? labelBlock + valueBlock : valueBlock + labelBlock;
      return Promise.resolve(
        `<div class="print-cell-inner print-cell-label-${labelPosition}" style="text-align:${align}">${order}</div>`
      );
    }
    const safeValue = (field?.type === "File" && field?.accept?.includes("image/*")) ? escapedValue : escapeHtml(escapedValue || "");
    return Promise.resolve(
      `${label !== "" ? `<span class="print-label">${escapeHtml(label)}</span>` : ""}
      <span class="print-value" style="text-align:${align}">${safeValue}</span>`
    );
  }
  if (item.type === "text") {
    const v = item.value ?? "";
    if (!v) return null;
    return Promise.resolve(`<span class="print-text">${escapeHtml(v)}</span>`);
  }
  if (item.type === "custom_html" && item.value) {
    return await renderCustomHtml(item.value).then((html) => html).catch(() => "<span class=\"print-error\">Template error</span>");
  }
  if (item.type === "line") {
    return Promise.resolve('<hr class="print-line" />');
  }
  if (item.type === "image" && item.value) {
    const src = item.value.startsWith("http") || item.value.startsWith("/") ? item.value : "";
    if (src) return Promise.resolve(`<img class="print-image" src="${escapeHtml(src)}" alt="" />`);
  }
  return null;
}

/**
 * Render template items and a document to an HTML string (body content).
 * Items with the same group are rendered in one visual row. Uses binba for custom_html items.
 * Pass fetchRefDoc when template has reference tables with nested_field (e.g. to load Delivery Order for each row).
 */
export async function templateItemToHtml(
  doctype: Zodula.DoctypeName,
  items: TemplateItemForPrint[],
  doc: Record<string, unknown>,
  options?: {
    title?: string;
    subtitle?: string;
    language?: string;
    fetchRefDoc?: (doctype: string, id: string) => Promise<Record<string, unknown> | null>;
  }
): Promise<string> {
  // @ts-ignore - binba may not have type definitions
  const { Template } = await import("binba");
  const parts: string[] = [];

  if (options?.title) {
    parts.push(`<h1 class="print-title">${escapeHtml(options.title)}</h1>`);
  }
  if (options?.subtitle) {
    parts.push(`<p class="print-subtitle">${escapeHtml(options.subtitle)}</p>`);
  }

  const renderCustomHtml = async (html: string) => {
    const ctx = { doc, _(x: string) { return x; }, ...doc };
    return Template.render(html, ctx as any);
  };

  const rowGroups = itemsToRows(items);
  const rowHtml: string[] = [];
  const fetchRefDoc = options?.fetchRefDoc;

  for (const rowItems of rowGroups) {
    const cellPromises = rowItems.map(async (item) => {
      return await renderCellContent(doctype, item, doc, renderCustomHtml, options?.language ?? "en", fetchRefDoc);
    });
    const cellResults = await Promise.all(cellPromises);

    const cells: string[] = [];
    for (let i = 0; i < cellResults.length; i++) {
      const content = cellResults[i];
      if (content != null && content !== "") cells.push(`<div class="print-cell">${content}</div>`);
    }
    if (cells.length) rowHtml.push(`<div class="print-row">${cells.join("")}</div>`);
  }


  if (rowHtml.length) {
    parts.push('<div class="print-body">' + rowHtml.join("") + "</div>");
  }

  return parts.join("\n");
}

/** Alias for templateItemToHtml (same rendering from template items + doc to HTML). */
export const itemsToHtml = templateItemToHtml;

export function generatePrintItemCss(items: TemplateItemForPrint[]): string {
  return `
    * {
    font-family: Arial, sans-serif;
    font-size: 14px;
    }
    .print-row {
    display: flex;
    margin-bottom: 10px;
    }
    .print-cell {
    flex: 1;
    }
    .print-cell-inner {
    display: flex;
    flex-direction: column;
    gap: 2px;
    }

    h1 {
    font-size: 20px;
    font-weight: bold;
    }
    h2 {
    font-size: 18px;
    font-weight: bold;
    }

    .print-label {
    font-weight: bold;
    }

    .print-td {
    text-align: left;
    font-size: 14px;
    padding: 4px 2px;
    }
    .print-th {
    text-align: left;
    font-size: 12px;
    padding: 6px 2px;
    white-space: nowrap;
    }
    .print-th-row {
    border-top: 1px solid black;
    border-bottom: 1px solid black;
    }
    .print-td-row {
    border-bottom: 1px dashed black;
    }
    .print-ref-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 0.875rem;
    }
  `;
}