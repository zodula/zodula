import { loader } from "@/zodula/server/loader";

export type DeskSearchResult = {
  doctypes: { name: string; label: string; listHref: string }[];
  pages: { name: string; href: string }[];
  docs: {
    doctype: string;
    doctypeLabel: string;
    name: string;
    formHref: string;
  }[];
};

const empty: DeskSearchResult = { doctypes: [], pages: [], docs: [] };

function isCheckOn(v: unknown): boolean {
  return v === 1 || v === "1" || v === true;
}

function resolveNamingSeries(
  doctypeName: string,
  fromDb: string | null | undefined
): string | null {
  const db = String(fromDb ?? "").trim();
  if (db) return db;
  try {
    const dm = loader.from("doctype").get(doctypeName as Zodula.DoctypeName);
    const cfg = dm.config as { naming_series?: string };
    const sch = dm.schema as { naming_series?: string };
    const fromCode = String(sch?.naming_series ?? cfg?.naming_series ?? "").trim();
    return fromCode || null;
  } catch {
    return null;
  }
}

function isChildDoctypeRow(d: Record<string, unknown>): boolean {
  const v = d.is_child_doctype;
  return v === 1 || v === "1" || v === true;
}

function namingSeriesDocSearchPrefix(namingSeries: string): string | null {
  const ns = String(namingSeries || "").trim();
  if (!ns) return null;
  if (ns.startsWith("{{") || ns.startsWith("field:")) return null;
  const brace = ns.indexOf("{");
  const field = ns.indexOf("field:");
  let cut = -1;
  if (brace >= 0) cut = brace;
  if (field >= 0 && (cut < 0 || field < cut)) cut = field;
  const prefix = (cut >= 0 ? ns.slice(0, cut) : ns).trimEnd();
  return prefix.length > 0 ? prefix : null;
}

function likePrefixPattern(q: string): string {
  const safe = String(q).replace(/'/g, "''").replace(/%/g, "").replace(/_/g, "");
  return `${safe}%`;
}

function queryMatchesNamingStaticPrefix(qRaw: string, seriesPrefix: string): boolean {
  if (!seriesPrefix) return false;
  return qRaw.startsWith(seriesPrefix) || seriesPrefix.startsWith(qRaw);
}

export type RunDeskSearchOptions = {
  /** Skip doctype/page queries and list building; only run doc id search (client lists doctypes/pages). */
  docsOnly?: boolean;
};

/**
 * Shared desk omnibox search (doctypes, pages, doc id hits). Used by zodula.core.search and zodula.core.scan_search.
 */
export async function runDeskSearch(
  qRaw: string,
  options?: RunDeskSearchOptions
): Promise<{ status: 200 | 401; body: DeskSearchResult }> {
  const docsOnly = options?.docsOnly === true;
  const qLower = qRaw.toLowerCase();

  const user = await $zodula.session.user().catch(() => null);
  if (!user) {
    return { status: 401, body: empty };
  }

  const roles = await $zodula.session.roles();
  if (!roles?.length) {
    return { status: 401, body: empty };
  }

  if (docsOnly && !qRaw) {
    return { status: 200, body: empty };
  }

  const isSystemAdmin = roles.includes("System Admin");

  const { docs: permRows } = await $zodula
    .doctype("Doctype Permission")
    .select()
    .limit(-1)
    .bypass(true)
    .where("role", "IN", roles)
    .where("perm_level", "=", "0");

  const allowedDoctypes = new Set<string>();
  for (const p of permRows || []) {
    const row = p as Zodula.SelectDoctype<"Doctype Permission">;
    if (isCheckOn(row.can_select) || isCheckOn(row.can_own_select)) {
      const dt = String(row.doctype || "").trim();
      if (dt) allowedDoctypes.add(dt);
    }
  }

  const { docs: doctypeRows } = await $zodula
    .doctype("Doctype")
    .select()
    .limit(-1)
    .bypass(true);

  const metaByName = new Map<
    string,
    { label: string; naming_series: string | null }
  >();
  for (const d of doctypeRows || []) {
    const row = d as unknown as Record<string, unknown>;
    const name = String(row.name || "");
    if (!name || isChildDoctypeRow(row)) continue;
    if (!isSystemAdmin && !allowedDoctypes.has(name)) continue;
    metaByName.set(name, {
      label: String(row.label || name),
      naming_series: resolveNamingSeries(
        name,
        (row.naming_series as string | null | undefined) ?? null
      ),
    });
  }

  const doctypesOut: DeskSearchResult["doctypes"] = [];

  if (!docsOnly) {
    for (const [name, meta] of metaByName) {
      if (!qRaw) {
        doctypesOut.push({
          name,
          label: meta.label,
          listHref: `/desk/doctypes/${name}/list`,
        });
        continue;
      }
      const label = meta.label;
      if (
        name.toLowerCase().includes(qLower) ||
        label.toLowerCase().includes(qLower)
      ) {
        doctypesOut.push({
          name,
          label,
          listHref: `/desk/doctypes/${name}/list`,
        });
      }
    }

    doctypesOut.sort((a, b) =>
      (a.label || a.name).localeCompare(b.label || b.name)
    );
  }

  const pagesOut: DeskSearchResult["pages"] = [];
  if (!docsOnly) {
    const { docs: pageRows } = await $zodula
      .doctype("Page")
      .select()
      .limit(-1)
      .bypass(true);

    for (const p of pageRows || []) {
      const row = p as Zodula.SelectDoctype<"Page">;
      const name = String(row.name || "");
      const href = String(row.href || "");
      if (!name || !href) continue;
      if (
        !qRaw ||
        name.toLowerCase().includes(qLower) ||
        href.toLowerCase().includes(qLower)
      ) {
        pagesOut.push({ name, href });
      }
    }
    pagesOut.sort((a, b) => a.name.localeCompare(b.name));
  }

  const docsOut: DeskSearchResult["docs"] = [];

  if (qRaw) {
    const likePat = likePrefixPattern(qRaw);
    for (const [dtName, meta] of metaByName) {
      const ns = meta.naming_series;
      if (!ns) {
        continue;
      }
      const prefix = namingSeriesDocSearchPrefix(ns);
      if (!prefix || !queryMatchesNamingStaticPrefix(qRaw, prefix)) {
        continue;
      }

      let docs: { id?: string | null; name?: string | null }[] = [];
      try {
        const sel = await $zodula
          .doctype(dtName as Zodula.DoctypeName)
          .select()
          .limit(5)
          .sort("id" as any, "desc")
          .where("id" as any, "LIKE", likePat);
        docs = (sel.docs || []) as { id?: string | null; name?: string | null }[];
      } catch {
        continue;
      }

      const label = meta.label;
      for (const doc of docs) {
        const n = String(doc.name || doc.id || "").trim();
        if (!n) continue;
        docsOut.push({
          doctype: dtName,
          doctypeLabel: label,
          name: n,
          formHref: `/desk/doctypes/${encodeURIComponent(dtName)}/form/${encodeURIComponent(n)}`,
        });
      }
    }
  }

  return {
    status: 200,
    body: {
      doctypes: doctypesOut,
      pages: pagesOut,
      docs: docsOut,
    },
  };
}
