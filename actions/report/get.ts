import { z } from "bxo";
import { loader } from "@/zodula/server/loader";

type AggregationInput = {
  groupBy?: string | null;
  aggregateFunction?: "Count" | "Sum" | "Average" | null;
  aggregateField?: string | null;
};

type ColumnResult = {
  key: string;
  label: string;
  sortable: boolean;
};

function reportColumnFromItem(
  item: any,
  schemaFields: Record<string, any>
): ColumnResult | null {
  const fieldName = String(item?.doctype_field || "");
  if (!fieldName) return null;

  const top = schemaFields[fieldName];
  if (top) {
    return {
      key: fieldName,
      label: String(item.label || (top as any).label || fieldName),
      sortable:
        item.sortable !== 0 &&
        (top as any).type !== "Reference Table" &&
        (top as any).type !== "Extend",
    };
  }

  const dot = fieldName.indexOf(".");
  if (dot <= 0) return null;
  const parentName = fieldName.slice(0, dot);
  const childName = fieldName.slice(dot + 1);
  const parentField = schemaFields[parentName];
  if (!parentField || (parentField as any).type !== "Reference Table") {
    return null;
  }
  const childDoctype = (parentField as any).reference as string;
  if (!childDoctype) return null;
  const childMeta = loader.from("doctype").get(childDoctype as any);
  const childSchema = childMeta?.schema?.fields?.[childName];
  if (!childSchema) return null;
  return {
    key: fieldName,
    label: String(item.label || (childSchema as any).label || fieldName),
    sortable: item.sortable !== 0,
  };
}

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildDefaultColumns(doctypeName: Zodula.DoctypeName): ColumnResult[] {
  const doctypeMeta = loader.from("doctype").get(doctypeName);
  const schemaFields = doctypeMeta?.schema?.fields ?? {};
  const displayField = (doctypeMeta?.config?.display_field || "id") as string;
  const allFieldEntries = Object.entries(schemaFields) as [string, any][];
  const displayFieldConfig = schemaFields[displayField] || null;

  const listFields = allFieldEntries
    .filter(([name, field]) => {
      if (name === displayField) return false;
      if (!field) return false;
      if ((field as any).type === "Reference Table" || (field as any).type === "Extend") return false;
      if ($zodula.utils.isStandardField(name)) return false;
      return (field as any).in_list_view === 1 || (field as any).required === 1;
    })
    .map(([name, field]) => ({
      key: name,
      label: String((field as any).label || name),
      sortable: true,
    }));

  return [
    {
      key: displayField,
      label: String(displayFieldConfig?.label || displayField),
      sortable: true,
    },
    ...listFields,
  ];
}

export default $action(async (ctx) => {
  const {
    doctype,
    limit,
    filters = [],
    q,
    sort,
    order,
    report,
    aggregation,
  } = ctx.body;

  const finalLimit = limit ?? 20;
  const reportDoc = report
    ? await $zodula.doctype("Report").get(report as any)
    : null;

  const targetDoctype = (reportDoc?.doctype || doctype) as Zodula.DoctypeName;
  const defaultFilters = parseJsonSafe<any[]>(
    reportDoc?.default_filters,
    []
  );
  const finalFilters = [...defaultFilters, ...(filters || [])];
  const finalSort = sort || reportDoc?.sort || "updated_at";
  const finalOrder = (order || reportDoc?.order || "desc") as "asc" | "desc";

  if (reportDoc?.is_script === 1 && reportDoc?.script) {
    const runScript = new Function(
      "ctx",
      "$zodula",
      "loader",
      `
      return (async () => {
        ${reportDoc.script}
      })();
      `
    );

    const scriptResult = await runScript(
      {
        doctype: targetDoctype,
        limit: finalLimit,
        filters: finalFilters,
        q: q || "",
        sort: finalSort,
        order: finalOrder,
        aggregation: aggregation || null,
        report: reportDoc,
      },
      $zodula,
      loader
    );

    return ctx.json({
      rows: Array.isArray(scriptResult?.rows) ? scriptResult.rows : [],
      columns: Array.isArray(scriptResult?.columns) ? scriptResult.columns : [],
      count: Number(scriptResult?.count || 0),
      meta: {
        is_script: true,
        report_id: reportDoc.id,
      },
    });
  }

  let selector = $zodula
    .doctype(targetDoctype)
    .select()
    .limit(finalLimit)
    .q(q || "")
    .sort(finalSort as any, finalOrder);

  for (const filter of finalFilters) {
    selector = selector.where(filter[0] as any, filter[1] as any, filter[2] as any);
  }

  const selected = await selector;
  const rows = selected.docs || [];

  let columns: ColumnResult[] = [];
  if (reportDoc?.id) {
    const reportItems = ((reportDoc as any).report_items || []) as any[];
    const doctypeMeta = loader.from("doctype").get(targetDoctype);
    const schemaFields = doctypeMeta?.schema?.fields ?? {};
    columns = reportItems
      .map((item) => reportColumnFromItem(item, schemaFields))
      .filter(Boolean) as ColumnResult[];
  }

  if (!columns.length) {
    columns = buildDefaultColumns(targetDoctype);
  }

  return ctx.json({
    rows,
    columns,
    count: selected.count || rows.length,
    meta: {
      is_script: reportDoc?.is_script === 1,
      report_id: reportDoc?.id || null,
    },
  });
}, {
  body: z.object({
    doctype: z.string(),
    report: z.string().optional(),
    limit: z.number().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    filters: z.array(z.tuple([z.string(), z.string(), z.any()])).optional(),
    aggregation: z.object({
      groupBy: z.string().nullable().optional(),
      aggregateFunction: z.enum(["Count", "Sum", "Average"]).nullable().optional(),
      aggregateField: z.string().nullable().optional(),
    }).optional(),
  }),
});
