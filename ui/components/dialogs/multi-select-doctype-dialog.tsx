import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { ClientFieldHelper } from "@/zodula/client/field";
import { FilterContent } from "@/zodula/ui/components/list/FilterContent";
import { ListTable, type ListColumn } from "@/zodula/ui/components/list/ListTable";
import { plugins } from "@/zodula/ui/components/form/plugins";
import { zodula } from "@/zodula/client";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";

export interface MultiSelectDoctypeDialogInitialData {
  doctype: Zodula.DoctypeName;
  /** Default filters; entries with operator "=" are applied to standard filter fields */
  defaultFilters?: IFilter<any, any, IOperator>[];
  limit?: number;
  labelField?: string;
  /** Field names for the standard filter form (filter grid); when set, overrides doctype list view fields for filters */
  standard_filter_fields?: string[];
  /** Field names for table columns (e.g. item_name, customer_name, price, uom, from_date, until_date) */
  columns?: string[];
  /** Server list sort field (passed to select_docs; default updated_at) */
  sort?: string;
  /** Server list sort direction (default desc) */
  order?: "asc" | "desc";
  /** When true, only one item can be selected; onClose receives string | null instead of string[] | null */
  single?: boolean;
  /** When true (default), the filters section starts collapsed; pass false to open it by default */
  defaultFiltersCollapsed?: boolean;
  /** Optional extra fields rendered in dialog (e.g. start_date/end_date) */
  extend_fields?: Array<{
    name: string;
    label: string;
    type: "Text" | "Date" | "Select" | "Check";
    required?: boolean;
    default?: any;
    options?: string;
  }>;
  extend_values?: Record<string, any>;
  /** Optional async submit hook. Return false to keep dialog open. */
  on_submit?: (payload: MultiSelectDoctypeDialogResult | { id: string | null; extend_values: Record<string, any> }) => Promise<boolean> | boolean;
}

export interface MultiSelectDoctypeDialogResult {
  ids: string[];
  extend_values: Record<string, any>;
}

interface MultiSelectDoctypeDialogProps {
  isOpen: boolean;
  onClose: (result?: string[] | string | MultiSelectDoctypeDialogResult | { id: string | null; extend_values: Record<string, any> } | null) => void;
  initialData?: MultiSelectDoctypeDialogInitialData;
}

function defaultFiltersToStandardValues(filters: IFilter<any, any, IOperator>[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of filters || []) {
    if (f[1] === "=" && f[0] != null && f[2] !== undefined && f[2] !== "") out[f[0] as string] = f[2];
  }
  return out;
}

function standardValuesToFilters(v: Record<string, any>): IFilter<any, any, IOperator>[] {
  return Object.entries(v)
    .filter(([, val]) => val !== undefined && val !== null && val !== "")
    .map(([field, value]) => [field, "LIKE" as IOperator, value] as IFilter<any, any, IOperator>);
}

function filterDocsClientSide<T extends Record<string, any>>(docs: T[], filters: IFilter<any, any, IOperator>[]): T[] {
  if (!filters.length) return docs;
  return docs.filter((doc) => {
    for (const [field, op, val] of filters) {
      const docVal = doc[field];
      const strVal = String(val ?? "").toLowerCase();
      const strDocVal = String(docVal ?? "").toLowerCase();
      const match =
        op === "=" ? (docVal === val || strDocVal === strVal) :
          op === "!=" ? (docVal !== val && strDocVal !== strVal) :
            op === ">" ? (docVal != null && val != null && Number(docVal) > Number(val)) || (docVal != null && val == null) :
              op === ">=" ? (docVal != null && val != null && Number(docVal) >= Number(val)) || (docVal != null && val == null) :
                op === "<" ? docVal != null && val != null && Number(docVal) < Number(val) :
                  op === "<=" ? docVal != null && val != null && Number(docVal) <= Number(val) :
                    op === "LIKE" ? strDocVal.includes(strVal.replace(/%/g, "")) :
                      op === "NOT LIKE" ? !strDocVal.includes(strVal.replace(/%/g, "")) :
                        op === "IN" ? Array.isArray(val) && val.includes(docVal) :
                          op === "NOT IN" ? !Array.isArray(val) || !val.includes(docVal) :
                            op === "IS NULL" ? (docVal == null) === (val === 1 || val === "1") :
                              op === "IS NOT NULL" ? (docVal != null) === (val === 1 || val === "1") :
                                docVal === val;
      if (!match) return false;
    }
    return true;
  });
}

function dedupeFilters(filters: IFilter<any, any, IOperator>[]): IFilter<any, any, IOperator>[] {
  const seen = new Set<string>();
  return filters.filter((f) => {
    const key = `${f[0]}|${f[1]}|${JSON.stringify(f[2])}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function MultiSelectDoctypeDialog({
  isOpen,
  onClose,
  initialData,
}: MultiSelectDoctypeDialogProps) {
  const { t } = useTranslation();
  const doctype = initialData?.doctype;
  const limit = initialData?.limit ?? 500;
  const defaultFilters = useMemo(() => initialData?.defaultFilters ?? [], [initialData?.defaultFilters]);
  /** Advanced filters: default filters with operator other than "=" (e.g. from_date <= x, until_date >= y) */
  const initialAdvancedFilters = useMemo(
    () => defaultFilters.filter((f) => f[1] !== "="),
    [defaultFilters]
  );
  const standardFilterFieldNames = initialData?.standard_filter_fields;
  const columnsFieldNames = initialData?.columns;
  const initialSort = initialData?.sort ?? "updated_at";
  const initialOrder = initialData?.order ?? "desc";
  const single = initialData?.single === true;
  const extendFields = initialData?.extend_fields ?? [];

  const [listSortState, setListSortState] = useState(() => ({
    sort: initialSort,
    order: initialOrder as "asc" | "desc",
  }));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [standardFilterValues, setStandardFilterValues] = useState<Record<string, any>>(() =>
    defaultFiltersToStandardValues(defaultFilters)
  );
  /** Initial applied filters from defaults so first fetch uses them (avoids double fetch from debounce) */
  const initialAppliedFilters = useMemo(
    () =>
      dedupeFilters([
        ...standardValuesToFilters(defaultFiltersToStandardValues(defaultFilters)),
        ...initialAdvancedFilters,
      ]),
    [defaultFilters, initialAdvancedFilters]
  );
  /** Applied filters for the list; when changed, we re-fetch from server */
  const [appliedFilters, setAppliedFilters] = useState<IFilter<any, any, IOperator>[]>(() => initialAppliedFilters);
  /** Current advanced filter rows from FilterContent (so we can Apply even when advanced section is empty) */
  const [currentAdvancedFilters, setCurrentAdvancedFilters] = useState<IFilter<any, any, IOperator>[]>(initialAdvancedFilters);
  const [docs, setDocs] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(() => !(initialData?.defaultFiltersCollapsed ?? true));
  const [extendValues, setExtendValues] = useState<Record<string, any>>(() => {
    const out: Record<string, any> = { ...(initialData?.extend_values ?? {}) };
    for (const field of extendFields) {
      if (out[field.name] === undefined && field.default !== undefined) out[field.name] = field.default;
    }
    return out;
  });

  const { docs: fieldDocs } = useDocList(
    {
      doctype: "Field" as Zodula.DoctypeName,
      limit: 500,
      sort: "idx",
      order: "asc",
      filters: (doctype ? [["doctype", "=", doctype]] : [["doctype", "=", ""]]) as IFilter<any, any, any>[],
    },
    [doctype]
  );

  const allFields = useMemo(() => {
    return (fieldDocs || [])
      .filter((f: any) => f.type !== "Reference Table" && f.type !== "Extend")
      .sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0));
  }, [fieldDocs]);

  const standardFilterFields = useMemo(() => {
    if (standardFilterFieldNames?.length) {
      return standardFilterFieldNames
        .map((name) => allFields.find((f: any) => f.name === name))
        .filter((f): f is NonNullable<typeof f> => !!f);
    }
    const inList = allFields.filter((f: any) => f.in_list_view === 1);
    if (inList.length >= 4) return inList.slice(0, 6);
    return allFields.slice(0, 6);
  }, [allFields, standardFilterFieldNames]);

  const filtersCount = useMemo(() => {
    const standard = Object.entries(standardFilterValues).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    ).length;
    return standard + currentAdvancedFilters.length;
  }, [standardFilterValues, currentAdvancedFilters]);

  /** All fields for FilterContent (include Reference Table for dropdown) */
  const allFieldsForFilter = useMemo(
    () =>
      (fieldDocs || [])
        .filter((f: any) => !ClientFieldHelper.isStandardField(f.name || ""))
        .filter((f: any) => f.type !== "Extend")
        .sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0)),
    [fieldDocs]
  );

  const fetchDocs = useCallback(async () => {
    if (!doctype) return;
    setLoading(true);
    setError(null);
    try {
      const res = await zodula.doc.select_docs(doctype as any, {
        limit,
        sort: listSortState.sort,
        order: listSortState.order,
        filters: appliedFilters,
      });
      const list = (res?.docs ?? []) as Record<string, any>[];
      setDocs(list);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [doctype, limit, appliedFilters, listSortState.sort, listSortState.order]);

  useEffect(() => {
    if (!isOpen || !doctype) return;
    fetchDocs();
  }, [isOpen, doctype, fetchDocs]);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    const opened = !wasOpen && isOpen;
    const closed = wasOpen && !isOpen;
    prevIsOpenRef.current = isOpen;

    if (closed) {
      setSelected(new Set());
      setDocs([]);
      setStandardFilterValues(defaultFiltersToStandardValues(defaultFilters));
      setCurrentAdvancedFilters(initialAdvancedFilters);
      const nextExtend: Record<string, any> = { ...(initialData?.extend_values ?? {}) };
      for (const field of extendFields) {
        if (nextExtend[field.name] === undefined && field.default !== undefined) nextExtend[field.name] = field.default;
      }
      setExtendValues(nextExtend);
      const fromStandard = standardValuesToFilters(defaultFiltersToStandardValues(defaultFilters));
      const next = dedupeFilters([...fromStandard, ...initialAdvancedFilters]);
      appliedFiltersJsonRef.current = JSON.stringify(next);
      setAppliedFilters(next);
      setListSortState({
        sort: initialData?.sort ?? "updated_at",
        order: (initialData?.order ?? "desc") as "asc" | "desc",
      });
      return;
    }

    if (opened) {
      setFiltersExpanded(!(initialData?.defaultFiltersCollapsed ?? true));
      setListSortState({
        sort: initialData?.sort ?? "updated_at",
        order: (initialData?.order ?? "desc") as "asc" | "desc",
      });
    }
  }, [isOpen, defaultFilters, initialAdvancedFilters, initialData?.defaultFiltersCollapsed, initialData?.extend_values, initialData?.sort, initialData?.order, extendFields]);

  const getMissingExtendRequired = () => {
    return extendFields.filter((field) => {
      if (!field.required) return false;
      const value = extendValues[field.name];
      return value === undefined || value === null || value === "";
    });
  };
  const hasMissingExtendRequired = getMissingExtendRequired().length > 0;

  /** Debounce 500ms: apply filters after user stops typing in standard filters or FilterContent */
  const applyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedFiltersJsonRef = useRef<string>(JSON.stringify(initialAppliedFilters));
  const prevIsOpenRef = useRef<boolean>(isOpen);
  useEffect(() => {
    applyDebounceRef.current && clearTimeout(applyDebounceRef.current);
    applyDebounceRef.current = setTimeout(() => {
      const fromStandard = standardValuesToFilters(standardFilterValues);
      const next = dedupeFilters([...fromStandard, ...currentAdvancedFilters]);
      const nextJson = JSON.stringify(next);
      if (nextJson !== appliedFiltersJsonRef.current) {
        appliedFiltersJsonRef.current = nextJson;
        setAppliedFilters(next);
      }
      applyDebounceRef.current = null;
    }, 500);
    return () => {
      if (applyDebounceRef.current) clearTimeout(applyDebounceRef.current);
    };
  }, [standardFilterValues, currentAdvancedFilters]);

  const setStandardFilter = (fieldName: string, value: any) => {
    setStandardFilterValues((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null || value === "") delete next[fieldName];
      else next[fieldName] = value;
      return next;
    });
  };

  const handleApplyFiltersFromAdvanced = (advancedFilters: IFilter<any, any, IOperator>[]) => {
    const fromStandard = standardValuesToFilters(standardFilterValues);
    const next = dedupeFilters([...fromStandard, ...advancedFilters]);
    appliedFiltersJsonRef.current = JSON.stringify(next);
    setAppliedFilters(next);
  };

  const handleClearAdvancedFilters = () => {
    setAppliedFilters(standardValuesToFilters(standardFilterValues));
  };

  const handleListSort = (field: string) => {
    setListSortState((s) =>
      s.sort !== field
        ? { sort: field, order: "asc" as const }
        : { sort: field, order: s.order === "asc" ? ("desc" as const) : ("asc" as const) }
    );
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (single) {
        if (next.has(id)) return new Set();
        return new Set([id]);
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const tableColumnFields = useMemo(() => {
    if (columnsFieldNames?.length) {
      return columnsFieldNames
        .map((name) => allFields.find((f: any) => f.name === name))
        .filter((f): f is NonNullable<typeof f> => !!f);
    }
    return standardFilterFields;
  }, [allFields, columnsFieldNames, standardFilterFields]);

  const listColumns: ListColumn[] = useMemo(
    () =>
      tableColumnFields.map((col: any) => {
        const plugin = plugins.find((p) => p.types.includes(col.type as never));
        return {
          key: col.name,
          label: t(col.label || col.name || ""),
          sortable: col.type !== "Reference Table" && col.type !== "Extend",
          render: plugin
            ? (doc: any) =>
                plugin.cellRender({
                  fieldOptions: col,
                  value: doc[col.name],
                  doc,
                })
            : (doc: any) => (doc[col.name] != null ? String(doc[col.name]) : ""),
        };
      }),
    [tableColumnFields, t]
  );

  if (!doctype) return null;

  return (
    <div className="zd:flex zd:flex-col zd:gap-5 zd:min-h-[200px] zd:w-full zd:min-w-0">
      {/* Filters panel (collapsible) */}
      <div className="zd:rounded-lg zd:border zd:border-border zd:bg-muted/30 zd:w-full zd:min-w-0 zd:overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersExpanded((v) => !v)}
          className="zd:flex zd:w-full zd:items-center zd:gap-2 zd:px-4 zd:py-3 zd:text-left zd:hover:bg-muted/50 zd:transition-colors"
        >
          {filtersExpanded ? (
            <ChevronDown className="zd:h-4 zd:w-4 zd:shrink-0 zd:text-muted-foreground" />
          ) : (
            <ChevronRight className="zd:h-4 zd:w-4 zd:shrink-0 zd:text-muted-foreground" />
          )}
          <span className="zd:text-xs zd:font-medium zd:uppercase zd:tracking-wider zd:text-muted-foreground">
            {t("Filters")}
            {filtersCount > 0 && (
              <span className="zd:ml-1.5 zd:font-normal zd:normal-case zd:tracking-normal">
                ({filtersCount})
              </span>
            )}
          </span>
        </button>
        <div
          className={filtersExpanded ? "zd:space-y-4 zd:border-t zd:border-border zd:px-4 zd:pb-4 zd:pt-3" : "zd:overflow-hidden zd:border-t-0 zd:h-0 zd:opacity-0 zd:pointer-events-none zd:invisible"}
          aria-hidden={!filtersExpanded}
        >
          <div className="zd:grid zd:grid-cols-2 zd:gap-x-4 zd:gap-y-3 lg:zd:grid-cols-3">
            {standardFilterFields.map((field: any) => (
              <FormControl
                key={field.name}
                fieldKey={field.name}
                fieldPath={field.name}
                field={field}
                label={t(field.label || field.name || "")}
                value={standardFilterValues[field.name]}
                onChange={(fieldName, value) => setStandardFilter(fieldName, value)}
                readonly={false}
                formData={standardFilterValues}
                hideFormControl={false}
              />
            ))}
          </div>
          <div className="zd:border-t zd:border-border zd:pt-3">
            <p className="zd:mb-2 zd:text-xs zd:font-medium zd:uppercase zd:tracking-wider zd:text-muted-foreground">
              {t("Advanced filters")}
            </p>
            <FilterContent
              fields={allFieldsForFilter as Zodula.Field[]}
              filters={initialAdvancedFilters}
              onApplyFilters={handleApplyFiltersFromAdvanced}
              onClearFilters={handleClearAdvancedFilters}
              onFiltersChange={setCurrentAdvancedFilters}
              doctype={doctype}
              inline
              addLabel={t("Add a Filter")}
              showBorderTop={false}
              applyImmediately={true}
              className="zd:w-full"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="zd:flex zd:flex-1 zd:flex-col zd:min-h-0 zd:w-full zd:min-w-0">
        {extendFields.length > 0 && (
          <div className="zd:mb-4 zd:rounded-lg zd:border zd:border-border zd:bg-muted/20 zd:p-3">
            <p className="zd:mb-3 zd:text-xs zd:font-medium zd:uppercase zd:tracking-wider zd:text-muted-foreground">
              {t("Additional inputs")}
            </p>
            <div className="zd:grid zd:grid-cols-1 zd:gap-3 lg:zd:grid-cols-2">
              {extendFields.map((field) => (
                <FormControl
                  key={field.name}
                  fieldKey={field.name}
                  fieldPath={field.name}
                  field={field as any}
                  label={t(field.label || field.name)}
                  value={extendValues[field.name]}
                  onChange={(fieldName, value) => setExtendValues((prev) => ({ ...prev, [fieldName]: value }))}
                  readonly={false}
                  formData={extendValues}
                  hideFormControl={false}
                />
              ))}
            </div>
          </div>
        )}
        <p className="zd:mb-2 zd:text-xs zd:font-medium zd:uppercase zd:tracking-wider zd:text-muted-foreground">
          {t("Results")}
          {!loading && !error && docs.length > 0 && (
            <span className="zd:ml-1.5 zd:font-normal zd:normal-case zd:tracking-normal">
              ({docs.length})
            </span>
          )}
        </p>
        {loading && (
          <div className="zd:flex zd:flex-1 zd:items-center zd:justify-center zd:rounded-lg zd:border zd:border-dashed zd:border-border zd:py-12">
            <Loader2 className="zd:h-8 zd:w-8 zd:animate-spin zd:text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="zd:rounded-lg zd:border zd:border-destructive/50 zd:bg-destructive/10 zd:px-4 zd:py-3">
            <p className="zd:text-sm zd:text-destructive">{String(error)}</p>
          </div>
        )}
        {!loading && !error && docs.length === 0 && (
          <div className="zd:flex zd:flex-1 zd:items-center zd:justify-center zd:rounded-lg zd:border zd:border-dashed zd:border-border zd:bg-muted/20 zd:py-12">
            <p className="zd:text-sm zd:text-muted-foreground">{t("No records found. Adjust filters above.")}</p>
          </div>
        )}
        {!loading && docs.length > 0 && (
          <>
            <ListTable
              columns={listColumns}
              docs={docs}
              sort={listSortState.sort}
              order={listSortState.order}
              onSort={handleListSort}
              selected={selected}
              setSelected={setSelected}
              compact
              single={single}
              onRowClick={(doc) => toggle(String(doc.id ?? ""))}
            />
            <div className="zd:flex zd:justify-end zd:gap-2 zd:pt-3 zd:border-t zd:border-border zd:mt-4">
              <Button variant="outline" onClick={() => onClose()}>{t("Cancel")}</Button>
              <Button
                onClick={async () => {
                  const missing = getMissingExtendRequired();
                  if (missing.length > 0) return;
                  if (single) {
                    const id = selected.size ? Array.from(selected)[0] ?? null : null;
                    const payload = extendFields.length > 0 ? { id, extend_values: extendValues } : id;
                    if (typeof payload === "object" && payload !== null && initialData?.on_submit) {
                      const shouldClose = await initialData.on_submit(payload as { id: string | null; extend_values: Record<string, any> });
                      if (!shouldClose) return;
                    }
                    onClose(payload as any);
                  } else {
                    const ids = Array.from(selected);
                    const payload = extendFields.length > 0 ? { ids, extend_values: extendValues } : ids;
                    if (!Array.isArray(payload) && initialData?.on_submit) {
                      const shouldClose = await initialData.on_submit(payload);
                      if (!shouldClose) return;
                    }
                    onClose(payload as any);
                  }
                }}
                disabled={selected.size === 0 || hasMissingExtendRequired}
              >
                {t("Get")} {selected.size > 0 && (single ? "" : `(${selected.size})`)}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
