import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { Checkbox } from "@/zodula/ui/components/ui/checkbox";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { Loader2 } from "lucide-react";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useOrganization } from "@/zodula/ui/hooks/use-organization";
import { useParams } from "react-router";
import { FilterContent } from "@/zodula/ui/components/list/FilterContent";

export interface MultiSelectDoctypeDialogInitialData {
  doctype: Zodula.DoctypeName;
  /** Default filters; entries with operator "=" are applied to standard filter fields */
  defaultFilters?: IFilter<any, any, IOperator>[];
  limit?: number;
  labelField?: string;
  /** Field names for standard filter grid and table columns; when set, overrides doctype list view fields */
  list_view_fields?: string[];
}

interface MultiSelectDoctypeDialogProps {
  isOpen: boolean;
  onClose: (result?: string[]) => void;
  initialData?: MultiSelectDoctypeDialogInitialData;
}

/** Build initial standard filter values from defaultFilters where operator is "=" */
function defaultFiltersToStandardValues(defaultFilters: IFilter<any, any, IOperator>[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of defaultFilters || []) {
    if (f[1] === "=" && f[0] != null && f[2] !== undefined && f[2] !== "") {
      out[f[0] as string] = f[2];
    }
  }
  return out;
}

/** Build filters from standard filter field values (equality only) */
function standardValuesToFilters(standardFilterValues: Record<string, any>): IFilter<any, any, IOperator>[] {
  return Object.entries(standardFilterValues)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([field, value]) => [field, "=" as IOperator, value] as IFilter<any, any, IOperator>);
}

export function MultiSelectDoctypeDialog({
  isOpen,
  onClose,
  initialData,
}: MultiSelectDoctypeDialogProps) {
  const { t } = useTranslation();
  const doctype = initialData?.doctype;
  const limit = initialData?.limit ?? 500;
  const labelField = initialData?.labelField ?? "id";
  const defaultFilters = initialData?.defaultFilters ?? [];
  const listViewFieldNames = initialData?.list_view_fields;
  const { organization } = useOrganization();
  const params = useParams();
  const org = organization?.id ?? params?.org ?? "";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [standardFilterValues, setStandardFilterValues] = useState<Record<string, any>>(() =>
    defaultFiltersToStandardValues(defaultFilters)
  );
  /** Applied filters for the list; defaults only pre-fill the form, we do not use them as filters until user clicks Apply */
  const [appliedFilters, setAppliedFilters] = useState<IFilter<any, any, IOperator>[]>([]);
  /** Current advanced filter rows from FilterContent (so we can Apply even when advanced section is empty) */
  const [currentAdvancedFilters, setCurrentAdvancedFilters] = useState<IFilter<any, any, IOperator>[]>([]);

  const { docs: fieldDocs } = useDocList(
    {
      doctype: "zodula__Field" as Zodula.DoctypeName,
      limit: -1,
      filters: doctype ? [["doctype", "=", doctype]] : [],
      sort: "idx",
      order: "asc",
    },
    [doctype]
  );

  const allFields = useMemo(() => {
    return (fieldDocs || [])
      .filter((f: any) => !ClientFieldHelper.isStandardField(f.name || ""))
      .filter((f: any) => f.type !== "Reference Table" && f.type !== "Extend")
      .sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0));
  }, [fieldDocs]);

  const standardFilterFields = useMemo(() => {
    if (listViewFieldNames?.length) {
      const nameSet = new Set(listViewFieldNames);
      return listViewFieldNames
        .map((name) => allFields.find((f: any) => f.name === name))
        .filter((f): f is NonNullable<typeof f> => !!f);
    }
    const inList = allFields.filter((f: any) => f.in_list_view === 1);
    if (inList.length >= 4) return inList.slice(0, 6);
    return allFields.slice(0, 6);
  }, [allFields, listViewFieldNames]);

  const standardFilterFieldNames = useMemo(() => new Set(standardFilterFields.map((f: any) => f.name)), [standardFilterFields]);

  /** Advanced filters: only default filters whose field is NOT in standard (so e.g. Source Warehouse doesn't appear twice) */
  const initialAdvancedFilters = useMemo(
    () => defaultFilters.filter((f) => !standardFilterFieldNames.has(f[0] as string)),
    [defaultFilters, standardFilterFieldNames]
  );

  /** All fields for FilterContent (include Reference Table for dropdown) */
  const allFieldsForFilter = useMemo(
    () =>
      (fieldDocs || [])
        .filter((f: any) => !ClientFieldHelper.isStandardField(f.name || ""))
        .filter((f: any) => f.type !== "Extend")
        .sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0)),
    [fieldDocs]
  );

  const { docs, loading, error } = useDocList(
    doctype
      ? { doctype, filters: appliedFilters, limit, sort: "updated_at", order: "desc" }
      : { doctype: "zodula__Doctype" as Zodula.DoctypeName, limit: 0 },
    [isOpen, doctype, JSON.stringify(appliedFilters), limit]
  );

  const immediateApplySkipRuns = useRef(0);
  useEffect(() => {
    if (!isOpen) {
      immediateApplySkipRuns.current = 0;
      setSelected(new Set());
      setStandardFilterValues(defaultFiltersToStandardValues(defaultFilters));
      setAppliedFilters([]);
    }
  }, [isOpen, defaultFilters]);

  /** Immediate apply: sync appliedFilters from standard + advanced; skip first 2 runs (mount + FilterContent initial sync) so we don't apply defaults */
  useEffect(() => {
    if (immediateApplySkipRuns.current < 2) {
      immediateApplySkipRuns.current += 1;
      return;
    }
    const fromStandard = standardValuesToFilters(standardFilterValues);
    setAppliedFilters(dedupeFilters([...fromStandard, ...currentAdvancedFilters]));
  }, [standardFilterValues, currentAdvancedFilters]);

  const setStandardFilter = (fieldName: string, value: any) => {
    setStandardFilterValues((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null || value === "") delete next[fieldName];
      else next[fieldName] = value;
      return next;
    });
  };

  const dedupeFilters = (filters: IFilter<any, any, IOperator>[]) => {
    const seen = new Set<string>();
    return filters.filter((f) => {
      const key = `${f[0]}|${f[1]}|${JSON.stringify(f[2])}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleApplyFiltersFromAdvanced = (advancedFilters: IFilter<any, any, IOperator>[]) => {
    const fromStandard = standardValuesToFilters(standardFilterValues);
    setAppliedFilters(dedupeFilters([...fromStandard, ...advancedFilters]));
  };

  const handleClearAdvancedFilters = () => {
    setAppliedFilters(standardValuesToFilters(standardFilterValues));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === docs.length) setSelected(new Set());
    else setSelected(new Set(docs.map((d) => String((d as any).id ?? ""))));
  };

  const handleAdd = () => {
    onClose(Array.from(selected));
  };

  const getLabel = (doc: Record<string, any>) => {
    if (labelField && doc[labelField] != null) return String(doc[labelField]);
    return doc.name ?? doc.id ?? "";
  };

  if (!doctype) return null;

  return (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:min-h-[200px]">
      {/* Standard filter fields (form-style, with fieldConfig via FormControl) */}
      <div className="zd:space-y-3">
        <div className="zd:grid zd:grid-cols-2 zd:gap-x-4 zd:gap-y-3 lg:zd:grid-cols-3">
          {standardFilterFields.map((field: any) => (
            <FormControl
              key={field.name}
              fieldKey={field.name}
              field={field}
              label={t(field.label || field.name || "")}
              value={standardFilterValues[field.name]}
              onChange={(fieldName, value) => setStandardFilter(fieldName, value)}
              readonly={false}
              formData={standardFilterValues}
              org={org}
              hideFormControl={false}
            />
          ))}
        </div>

        {/* Advanced filters; applyImmediately so changes apply without an Apply button */}
        <div className="zd:border-t zd:pt-3">
          <FilterContent
            fields={allFieldsForFilter as Zodula.Field[]}
            filters={initialAdvancedFilters}
            onApplyFilters={handleApplyFiltersFromAdvanced}
            onClearFilters={handleClearAdvancedFilters}
            onFiltersChange={setCurrentAdvancedFilters}
            doctype={doctype}
            inline
            addLabel={t("Add a Filter")}
            showBorderTop={true}
            applyImmediately
          />
        </div>
      </div>

      {/* Results table */}
      {loading && (
        <div className="zd:flex zd:items-center zd:justify-center zd:py-8">
          <Loader2 className="zd:h-8 zd:w-8 zd:animate-spin zd:text-muted-foreground" />
        </div>
      )}
      {error && <p className="zd:text-sm zd:text-destructive">{String(error)}</p>}
      {!loading && !error && docs.length === 0 && (
        <p className="zd:text-sm zd:text-muted-foreground">{t("No records found. Adjust filters and click Apply.")}</p>
      )}
      {!loading && docs.length > 0 && (
        <>
          <div className="zd:border zd:rounded-md zd:overflow-hidden">
            <table className="zd:w-full zd:text-sm">
              <thead>
                <tr className="zd:border-b zd:bg-muted/50">
                  <th className="zd:w-10 zd:px-3 zd:py-2 zd:text-left">
                    <Checkbox checked={selected.size === docs.length} onCheckedChange={toggleAll} />
                  </th>
                  {standardFilterFields.slice(0, 5).map((col: any) => (
                    <th key={col.name} className="zd:px-3 zd:py-2 zd:text-left zd:font-medium zd:text-muted-foreground">
                      {t(col.label || col.name || "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc: any) => {
                  const id = String(doc.id ?? "");
                  return (
                    <tr
                      key={id}
                      className="zd:border-b zd:cursor-pointer hover:zd:bg-muted/50"
                      onClick={() => toggle(id)}
                    >
                      <td className="zd:w-10 zd:px-3 zd:py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(id)} onCheckedChange={() => toggle(id)} />
                      </td>
                      {standardFilterFields.slice(0, 5).map((col: any) => (
                        <td key={col.name} className="zd:px-3 zd:py-2">
                          {doc[col.name] != null ? String(doc[col.name]) : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="zd:flex zd:justify-end zd:gap-2">
            <Button variant="outline" onClick={() => onClose()}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0}>
              {t("Get Items")} {selected.size > 0 && `(${selected.size})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
