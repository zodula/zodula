import { useMemo } from "react";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { useRouter } from "@/zodula/ui/components/router";
import { Button } from "@/zodula/ui/components/ui/button";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { cn } from "@/zodula/ui/lib/utils";
import { ExternalLink, Loader2 } from "lucide-react";

type FieldRow = { name: string; label: string; type: string; reference?: string | null };

function listViewFieldRows(
  metaFields: Zodula.Field[],
  displayField: string
): FieldRow[] {
  const byName = new Map(metaFields.map((f) => [f.name as string, f]));
  const ordered: FieldRow[] = [];
  const seen = new Set<string>();

  const pushField = (name: string) => {
    if (seen.has(name)) return;
    const f = byName.get(name);
    if (!f) return;
    if (ClientFieldHelper.isStandardField(name)) return;
    if (ClientFieldHelper.isLayoutField(f as any)) return;
    seen.add(name);
    ordered.push({
      name,
      label: String(f.label || name),
      type: String(f.type),
      reference: f.reference ?? null,
    });
  };

  pushField(displayField);
  const rest = [...metaFields]
    .filter(
      (f) =>
        f.in_list_view === 1 &&
        (f.name as string) !== displayField &&
        !ClientFieldHelper.isStandardField(f.name as string) &&
        !ClientFieldHelper.isLayoutField(f as any)
    )
    .sort((a, b) => ((a as any).idx || 0) - ((b as any).idx || 0));
  for (const f of rest) pushField(f.name as string);

  return ordered;
}

export function CalendarEventPreview({
  doctype,
  id,
  metaFields,
  chipLabel,
}: {
  doctype: Zodula.DoctypeName;
  id: string;
  metaFields: Zodula.Field[];
  /** Same text as the calendar chip (from server calendar label rules). */
  chipLabel: string;
}) {
  const { t } = useTranslation();
  const { push } = useRouter();
  const { doc: doctypeMeta } = useDoc({
    doctype: "Doctype",
    id: doctype,
  });
  const { doc, loading, error } = useDoc({
    doctype,
    id,
  });

  const displayField = (doctypeMeta as any)?.display_field || "id";
  const rows = useMemo(
    () => listViewFieldRows(metaFields, displayField),
    [metaFields, displayField]
  );
  const detailRows = useMemo(
    () => rows.filter((r) => r.name !== displayField),
    [rows, displayField]
  );

  const doctypeLabel = (doctypeMeta as any)?.label || doctype;

  const headerBlock = (
    <div className="zd:border-b zd:border-border/60 zd:bg-gradient-to-b zd:from-muted/40 zd:to-muted/10 zd:px-4 zd:pb-3 zd:pt-3.5">
      <p className="zd:text-[11px] zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground">
        {doctypeLabel}
      </p>
      <p className="zd:mt-1 zd:whitespace-pre-wrap zd:break-words zd:text-sm zd:font-semibold zd:leading-snug zd:text-foreground">
        {chipLabel}
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="zd:flex zd:min-w-[12rem] zd:flex-col">
        {headerBlock}
        <div className="zd:flex zd:items-center zd:gap-2 zd:px-4 zd:py-6 zd:text-sm zd:text-muted-foreground">
          <Loader2 className="zd:h-4 zd:w-4 zd:animate-spin" aria-hidden />
          <span>{t("Loading")}…</span>
        </div>
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="zd:flex zd:min-w-[12rem] zd:flex-col">
        {headerBlock}
        <div className="zd:px-4 zd:pb-4 zd:pt-2">
          <div className="zd:rounded-lg zd:border zd:border-destructive/30 zd:bg-destructive/10 zd:px-3 zd:py-2.5 zd:text-sm zd:text-destructive">
            {error || t("Could not load record")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zd:flex zd:min-w-0 zd:flex-col">
      {headerBlock}

      <div className="zd:max-h-56 zd:overflow-y-auto zd:overscroll-contain">
        {detailRows.length === 0 ? (
          <p className="zd:px-4 zd:py-3 zd:text-sm zd:text-muted-foreground">{t("No additional fields")}</p>
        ) : (
          <ul className="zd:divide-y zd:divide-border/50">
            {detailRows.map((row) => {
              const raw = (doc as any)[row.name];
              const isRef = row.type === "Reference" && row.reference && raw;
              return (
                <li key={row.name} className="zd:px-4 zd:py-2.5">
                  <div className="zd:flex zd:flex-col zd:gap-1">
                    <span className="zd:text-xs zd:font-medium zd:text-muted-foreground">{t(row.label)}</span>
                    <div className="zd:min-w-0">
                      {isRef ? (
                        <button
                          type="button"
                          className={cn(
                            "zd:inline-flex zd:max-w-full zd:cursor-pointer zd:items-center zd:gap-1 zd:rounded-md zd:border zd:border-primary/20 zd:bg-primary/5 zd:px-2 zd:py-1 zd:text-left zd:text-sm zd:font-medium zd:text-primary",
                            "zd:transition-colors hover:zd:border-primary/35 hover:zd:bg-primary/10"
                          )}
                          onClick={() =>
                            push(`/desk/doctypes/${row.reference}/form/${encodeURIComponent(String(raw))}`)
                          }
                        >
                          <span className="zd:truncate">{String(raw)}</span>
                          <ExternalLink className="zd:h-3.5 zd:w-3.5 zd:shrink-0 zd:opacity-70" aria-hidden />
                        </button>
                      ) : (
                        <span className="zd:block zd:break-words zd:text-sm zd:text-foreground">
                          {raw === null || raw === undefined || raw === "" ? (
                            <span className="zd:text-muted-foreground">—</span>
                          ) : (
                            String(raw)
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="zd:border-t zd:border-border/60 zd:bg-muted/15 zd:p-3">
        <Button
          type="button"
          variant="solid"
          size="sm"
          className="zd:w-full zd:cursor-pointer zd:gap-2"
          onClick={() => push(`/desk/doctypes/${doctype}/form/${encodeURIComponent(id)}`)}
        >
          <ExternalLink className="zd:h-3.5 zd:w-3.5" aria-hidden />
          {t("Open")}
        </Button>
      </div>
    </div>
  );
}
