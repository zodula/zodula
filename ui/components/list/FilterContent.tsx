import React, { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Select, type SelectOption } from "../ui/select";
import { Input } from "../ui/input";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { FilterXIcon } from "lucide-react";
import { plugins } from "../form/plugins";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/use-translation";
import { useDocList } from "../../hooks/use-doc-list";
import { ClientFieldHelper } from "@/zodula/client/field";

const OPERATORS: { value: IOperator; label: string }[] = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not Equals" },
  { value: ">", label: "Greater Than" },
  { value: ">=", label: "Greater Than or Equal" },
  { value: "<", label: "Less Than" },
  { value: "<=", label: "Less Than or Equal" },
  { value: "LIKE", label: "Like" },
  { value: "NOT LIKE", label: "Not Like" },
  { value: "IN", label: "In" },
  { value: "NOT IN", label: "Not In" },
  { value: "IS NULL", label: "Is Null" },
  { value: "IS NOT NULL", label: "Is Not Null" },
];

export interface FilterRowState {
  id: string;
  field: string;
  operator: IOperator;
  value: string;
}

export interface FilterContentProps {
  fields: Zodula.Field[];
  /** Initial filters to show as rows. No empty row is added by default. */
  filters: IFilter<any, any, IOperator>[];
  onApplyFilters?: (filters: IFilter<any, any, IOperator>[]) => void;
  onClearFilters?: () => void;
  /** Called when the current valid filters change (e.g. so parent can apply without clicking Apply) */
  onFiltersChange?: (filters: IFilter<any, any, IOperator>[]) => void;
  doctype?: Zodula.DoctypeName;
  /** When true, Apply does not close a popover (used when embedded in dialog) */
  inline?: boolean;
  /** Add button label - default "+ Add" */
  addLabel?: string;
  /** Show border-top above actions */
  showBorderTop?: boolean;
  /** When true, apply filters on every change (no Apply button); parent should sync from onFiltersChange */
  applyImmediately?: boolean;
  /** Optional class for the root container (e.g. zd:w-full for full width in dialogs) */
  className?: string;
}

export function FilterContent({
  fields,
  filters,
  onApplyFilters,
  onClearFilters,
  onFiltersChange,
  doctype,
  inline = false,
  addLabel,
  showBorderTop = true,
  applyImmediately = false,
  className,
}: FilterContentProps) {
  const { t } = useTranslation();

  const { docs: allFields } = useDocList(
    { doctype: "Field" as Zodula.DoctypeName, limit: -1, sort: "idx", order: "asc" },
    [doctype]
  );

  const referenceTableChildFields = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const field of fields) {
      if (field.type === "Reference Table" && field.reference) {
        const childFields = (allFields || []).filter(
          (f: any) =>
            f.doctype === field.reference &&
            f.name !== field.reference &&
            !ClientFieldHelper.isStandardField(f.name || "")
        );
        if (childFields.length > 0) map.set(field.name || "", childFields);
      }
    }
    return map;
  }, [fields, allFields]);

  const parseFieldPath = (fieldPath: string) => {
    if (!fieldPath || !fieldPath.includes(".")) return { parentField: fieldPath, childField: null };
    const parts = fieldPath.split(".", 2);
    return { parentField: parts[0] || fieldPath, childField: parts[1] || null };
  };

  const getFieldPlugin = (fieldName: string) => {
    const { parentField, childField } = parseFieldPath(fieldName);
    if (childField) {
      const childFields = referenceTableChildFields.get(parentField);
      const childFieldObj = childFields?.find((f: any) => f.name === childField);
      if (childFieldObj) return plugins.find((p) => p.types.includes(childFieldObj.type as any));
      return null;
    }
    const field = fields.find((f) => f.name === fieldName);
    return field ? plugins.find((p) => p.types.includes(field.type as any)) : null;
  };

  const COUNT_OPERATORS = useMemo(() => OPERATORS.filter((op) => ["=", "!=", ">", ">=", "<", "<="].includes(op.value)), []);
  const isReferenceTableCountField = (fieldName: string) =>
    !!fieldName && !fieldName.includes(".") && fields.some((f) => f.name === fieldName && f.type === "Reference Table");

  const getSupportedOperators = (fieldName: string) => {
    if (isReferenceTableCountField(fieldName)) return COUNT_OPERATORS;
    const plugin = getFieldPlugin(fieldName);
    if (plugin?.supportOperators) return OPERATORS.filter((op) => plugin.supportOperators!.includes(op.value));
    return OPERATORS;
  };

  const fieldOptions = useMemo(() => {
    const options: SelectOption[] = [{ value: "", label: "" }];
    for (const field of fields) {
      if (ClientFieldHelper.isStandardField(field.name || "")) continue;
      if (field.type === "Reference Table" && field.reference) {
        const parentFieldName = field.name || "";
        options.push({ value: parentFieldName, label: `${t(field.label || parentFieldName)} (count)`, subtitle: parentFieldName });
        const childFields = referenceTableChildFields.get(field.name || "");
        if (childFields?.length) {
          for (const childField of childFields) {
            const childFieldName = childField.name || "";
            if (childFieldName && parentFieldName)
              options.push({
                value: `${parentFieldName}.${childFieldName}`,
                label: `${t(field.label || parentFieldName)} → ${t(childField.label || childFieldName)}`,
                subtitle: `${parentFieldName}.${childFieldName}`,
              });
          }
        }
      } else if (field.type !== "Extend") {
        options.push({ value: (field.name as string) || "", label: t(field.label || field.name || ""), subtitle: field.name || "" });
      }
    }
    return options;
  }, [fields, referenceTableChildFields, t]);

  const [filterRows, setFilterRows] = useState<FilterRowState[]>(() =>
    filters?.length
      ? filters.map((f, i) => ({ id: String(i + 1), field: (f[0] as string) ?? "", operator: f[1], value: String(f[2] ?? "") }))
      : []
  );

  const lastSyncedFiltersRef = useRef<string>(JSON.stringify(filters ?? []));
  useEffect(() => {
    const key = JSON.stringify(filters ?? []);
    if (key === lastSyncedFiltersRef.current) return;
    lastSyncedFiltersRef.current = key;
    if (filters?.length) {
      setFilterRows(
        filters.map((f, i) => ({ id: String(i + 1), field: (f[0] as string) ?? "", operator: f[1], value: String(f[2] ?? "") }))
      );
    } else {
      setFilterRows([]);
    }
  }, [filters]);

  const addFilterRow = () => {
    setFilterRows((prev) => [...prev, { id: String(Date.now()), field: "", operator: "=", value: "" }]);
  };

  const removeFilterRow = (id: string) => {
    setFilterRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateFilterRow = (id: string, updates: Partial<FilterRowState>) => {
    setFilterRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const buildValidFilters = (): IFilter<any, any, IOperator>[] => {
    const floatRegex = /^[0-9]+\.?[0-9]*$/;
    const intRegex = /^[0-9]+$/;
    return filterRows
      .filter(
        (row) =>
          row.field &&
          row.operator &&
          (row.value !== undefined || ["IS NULL", "IS NOT NULL"].includes(row.operator))
      )
      .map((row) => {
        let value: any = row.value;
        if (["IN", "NOT IN"].includes(row.operator)) {
          value = row.value.split(",").map((v) => v.trim()).filter(Boolean);
        } else if (["IS NULL", "IS NOT NULL"].includes(row.operator)) {
          value = "1";
        } else if (row.operator === "LIKE" || row.operator === "NOT LIKE") {
          value = row.value;
        } else {
          const numValue = floatRegex.test(row.value) ? parseFloat(row.value) : intRegex.test(row.value) ? parseInt(row.value, 10) : row.value;
          value = numValue;
        }
        return [row.field, row.operator, value] as IFilter<any, any, IOperator>;
      });
  };

  const handleApplyFilters = () => {
    const validFilters = buildValidFilters();
    onApplyFilters?.(validFilters);
  };

  const handleClearFilters = () => {
    setFilterRows([]);
    onClearFilters?.();
  };

  const lastEmittedRef = useRef<string>("");
  useEffect(() => {
    const valid = buildValidFilters();
    const key = JSON.stringify(valid);
    if (key !== lastEmittedRef.current) {
      lastEmittedRef.current = key;
      onFiltersChange?.(valid);
      if (applyImmediately) onApplyFilters?.(valid);
    }
  }, [filterRows, applyImmediately]);

  const getValueInputType = (operator: IOperator) =>
    ["IS NULL", "IS NOT NULL"].includes(operator) ? "hidden" : "text";
  const getValuePlaceholder = (operator: IOperator) =>
    ["IN", "NOT IN"].includes(operator) ? "comma-separated values" : ["LIKE", "NOT LIKE"].includes(operator) ? "use % as wildcard" : "value";

  return (
    <div className={cn("zd:space-y-4 zd:w-full zd:min-w-0", className)}>
      <div className="zd:space-y-3 zd:min-h-[24px] zd:w-full zd:min-w-0">
        {filterRows.map((row) => (
          <div key={row.id} className="zd:flex zd:items-center zd:gap-2 zd:w-full zd:min-w-0">
            <Select
              displayMode="label"
              options={fieldOptions}
              value={row.field}
              onChange={(value) => {
                const supportedOps = getSupportedOperators(value);
                const newOperator = (supportedOps.find((op) => op.value === row.operator)?.value || supportedOps[0]?.value || "=") as IOperator;
                updateFilterRow(row.id, { field: value, operator: newOperator });
              }}
              className="zd:shrink-0 zd:w-[180px]"
            />
            <Select
              displayMode="label"
              options={getSupportedOperators(row.field).map((op) => ({ value: op.value, label: op.value, subtitle: op.label }))}
              value={row.operator}
              onChange={(value) => updateFilterRow(row.id, { operator: value as IOperator })}
              className="zd:shrink-0 zd:w-24"
            />
            {getValueInputType(row.operator) !== "hidden" &&
              (() => {
                const valueCellClass = "zd:flex-1 zd:min-w-0 zd:max-w-none";
                if (isReferenceTableCountField(row.field)) {
                  return (
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={row.value}
                      onChange={(e) => updateFilterRow(row.id, { value: e.target.value })}
                      className={valueCellClass}
                    />
                  );
                }
                const { parentField, childField } = parseFieldPath(row.field);
                const field = childField
                  ? referenceTableChildFields.get(parentField)?.find((f: any) => f.name === childField)
                  : fields.find((f) => f.name === row.field);
                const plugin = field ? getFieldPlugin(row.field) : null;
                if (plugin && field) {
                  return (
                    <div className={valueCellClass}>
                      <plugin.renderFilter
                        fieldOptions={field}
                        value={row.value}
                        onChange={(_fieldPath, value) => updateFilterRow(row.id, { value })}
                        operator={row.operator}
                        fieldPath={row.field}
                      />
                    </div>
                  );
                }
                return (
                  <Input
                    type={getValueInputType(row.operator)}
                    placeholder={getValuePlaceholder(row.operator)}
                    value={row.value}
                    onChange={(e) => updateFilterRow(row.id, { value: e.target.value })}
                    className={valueCellClass}
                  />
                );
              })()}
            <Button variant="ghost" onClick={() => removeFilterRow(row.id)} className="zd:shrink-0 h-8 w-8 p-0">
              <FilterXIcon />
            </Button>
          </div>
        ))}
      </div>
      <div className={cn("zd:flex zd:items-center zd:justify-between zd:gap-2 zd:w-full", showBorderTop && "zd:pt-2 zd:border-t")}>
        <Button variant="ghost" onClick={addFilterRow}>
          + {addLabel ?? t("Add")}
        </Button>
        <div className="zd:flex zd:gap-2">
          <Button variant="outline" onClick={handleClearFilters}>
            {t("Clear")}
          </Button>
          {!applyImmediately && (
            <Button onClick={handleApplyFilters}>{t("Apply")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
