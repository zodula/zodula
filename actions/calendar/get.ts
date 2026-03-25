import { z } from "bxo";
import { loader } from "@/zodula/server/loader";

type CalendarEvent = {
  id: string;
  doctype: string;
  date: string;
  label: string;
};

function normalizeDateValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value);
  const parsed = $zodula.utils.parseDate(s);
  if (!parsed) return s.slice(0, 10) || null;
  return $zodula.utils.format(parsed, "date");
}

/** Build chip label from optional value/sub field names; falls back to display field then id. */
function calendarChipLabel(
  doc: Record<string, unknown>,
  valueField: string | null | undefined,
  subValueField: string | null | undefined,
  displayField: string
): string {
  const valKey = String(valueField ?? "").trim();
  const subKey = String(subValueField ?? "").trim();

  const str = (key: string): string => {
    if (!key) return "";
    const v = doc[key];
    if (v == null || v === "") return "";
    return String(v).trim();
  };

  let main = valKey ? str(valKey) : "";
  if (!main) main = str(displayField);
  if (!main) main = String(doc.id ?? "");

  const sub = subKey ? str(subKey) : "";
  if (sub) return `${main} · ${sub}`;
  return main;
}

export default $action(async (ctx) => {
  const {
    doctype,
    from,
    to,
    filters = [],
    q = "",
    sort = "updated_at",
    order = "desc",
  } = ctx.body;

  const { docs: configs } = await $zodula
    .doctype("Doctype Calendar")
    .select()
    .limit(1)
    .where("doctype", "=", doctype);

  const config = configs?.[0] as Zodula.SelectDoctype<"Doctype Calendar"> | undefined;
  if (!config) {
    return ctx.json({
      config: null,
      primary: [] as CalendarEvent[],
      secondary: [] as CalendarEvent[],
    });
  }

  const pDoctype = config.primary_date_doctype as Zodula.DoctypeName;
  const sDoctype = config.secondary_date_doctype as Zodula.DoctypeName;
  const pField = String(config.primary_date_fieldname || "").trim();
  const sField = String(config.secondary_date_fieldname || "").trim();
  if (!pField || !sField) {
    return ctx.json({
      config,
      primary: [] as CalendarEvent[],
      secondary: [] as CalendarEvent[],
    });
  }

  const pMeta = loader.from("doctype").get(pDoctype);
  const sMeta = loader.from("doctype").get(sDoctype);
  const pDisplay = String(pMeta?.config?.display_field || "name");
  const sDisplay = String(sMeta?.config?.display_field || "name");

  const pSel = await $zodula
    .doctype(pDoctype)
    .select()
    .limit(5000)
    .sort(pField as any, "asc")
    .where(pField as any, ">=", from)
    .where(pField as any, "<=", to);

  const finalOrder = (order === "asc" ? "asc" : "desc") as "asc" | "desc";
  let sSel = $zodula
    .doctype(sDoctype)
    .select()
    .limit(5000)
    .q(q || "")
    .sort((sort || "updated_at") as any, finalOrder)
    .where(sField as any, ">=", from)
    .where(sField as any, "<=", to);

  for (const filter of filters || []) {
    if (!filter || !Array.isArray(filter) || filter.length < 3) continue;
    sSel = sSel.where(filter[0] as any, filter[1] as any, filter[2] as any);
  }

  const sResult = await sSel;

  const primaryDocs = (pSel.docs || []) as Record<string, unknown>[];
  const secondaryDocs = (sResult.docs || []) as Record<string, unknown>[];

  const primary: CalendarEvent[] = primaryDocs
    .map((d) => {
      const date = normalizeDateValue(d[pField]);
      if (!date) return null;
      const label = calendarChipLabel(
        d,
        config.primary_value_field,
        config.primary_sub_value_field,
        pDisplay
      );
      return {
        id: String(d.id),
        doctype: String(pDoctype),
        date,
        label,
      };
    })
    .filter(Boolean) as CalendarEvent[];

  const secondary: CalendarEvent[] = secondaryDocs
    .map((d) => {
      const date = normalizeDateValue(d[sField]);
      if (!date) return null;
      const label = calendarChipLabel(
        d,
        config.secondary_value_field,
        config.secondary_sub_value_field,
        sDisplay
      );
      return {
        id: String(d.id),
        doctype: String(sDoctype),
        date,
        label,
      };
    })
    .filter(Boolean) as CalendarEvent[];

  return ctx.json({ config, primary, secondary });
}, {
  body: z.object({
    doctype: z.string(),
    from: z.string(),
    to: z.string(),
    filters: z.array(z.tuple([z.string(), z.string(), z.any()])).optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
  }),
});
