import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Input } from "../ui/input";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { plugins } from "../form/plugins";
import { useTranslation } from "../../hooks/use-translation";

interface QuickFilterBarProps {
  fields: Zodula.Field[];
  filters: IFilter<any, any, IOperator>[];
  onApplyFilters: (filters: IFilter<any, any, IOperator>[]) => void;
  doctype?: Zodula.DoctypeName;
  /** Rendered when there are no quick filter fields (e.g. search input) */
  fallback?: React.ReactNode;
}

function getFieldPlugin(field: Zodula.Field) {
  return plugins.find((p) => p.types.includes(field.type as never));
}

function getQuickFilterValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function QuickFilterBar({
  fields,
  filters,
  onApplyFilters,
  doctype,
  fallback,
}: QuickFilterBarProps) {
  const { t } = useTranslation();

  const quickFilterFields = useMemo(
    () => fields.filter((f) => f.is_quick_filter === 1),
    [fields]
  );

  const initialValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of quickFilterFields) {
      const name = field.name as string;
      const existing = filters?.find(
        (f) => (f[0] as string) === name && (f[1] as IOperator) === "="
      );
      map[name] = existing ? getQuickFilterValue(existing[2]) : "";
    }
    return map;
  }, [quickFilterFields, filters]);

  const [values, setValues] = useState<Record<string, string>>(() => initialValues);

  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };
      for (const field of quickFilterFields) {
        const name = field.name as string;
        const existing = filters?.find(
          (f) => (f[0] as string) === name && (f[1] as IOperator) === "="
        );
        const nextVal = existing ? getQuickFilterValue(existing[2]) : "";
        if (next[name] !== nextVal) next[name] = nextVal;
      }
      return next;
    });
  }, [quickFilterFields, filters]);

  const otherFilters = useMemo(
    () =>
      (filters ?? []).filter((f) => {
        const fieldName = f[0] as string;
        return !quickFilterFields.some((qf) => (qf.name as string) === fieldName);
      }),
    [filters, quickFilterFields]
  );

  const applyQuickFilters = useCallback(
    (newValues: Record<string, string>) => {
      const quickFilters: IFilter<any, any, IOperator>[] = quickFilterFields
        .filter((f) => {
          const v = newValues[f.name as string];
          return v !== undefined && v !== null && v !== "";
        })
        .map((f) => {
          const v = newValues[f.name as string];
          const num = v ? parseFloat(v) : undefined;
          const value = num !== undefined && !Number.isNaN(num) && v?.trim() !== "" ? num : v;
          return [f.name, "=" as IOperator, value] as IFilter<any, any, IOperator>;
        });
      onApplyFilters([...otherFilters, ...quickFilters]);
    },
    [quickFilterFields, otherFilters, onApplyFilters]
  );

  const handleChange = useCallback(
    (fieldName: string, value: string) => {
      const next = { ...values, [fieldName]: value };
      setValues(next);
      applyQuickFilters(next);
    },
    [applyQuickFilters, values]
  );

  if (quickFilterFields.length === 0) return <>{fallback}</>;

  return (
    <div className="zd:flex zd:flex-wrap zd:items-center zd:gap-3">
      {quickFilterFields.map((field) => {
        const fieldName = field.name as string;
        const value = values[fieldName] ?? "";
        const plugin = getFieldPlugin(field);

        return (
          <div
            key={fieldName}
            className="zd:flex zd:items-center zd:gap-2 zd:min-w-0"
          >
            {plugin?.renderFilter ? (
              <plugin.renderFilter
                fieldOptions={field}
                fieldPath={fieldName}
                value={value}
                onChange={(_fieldPath, value) => handleChange(fieldName, value)}
                operator="="
                placeholder={t(field.label || field.name || "")}
              />
            ) : (
              <Input
                type="text"
                placeholder={t("Filter") + "..."}
                value={value}
                onChange={(e) => handleChange(fieldName, e.target.value)}
                className="zd:w-40"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
