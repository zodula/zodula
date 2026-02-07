import React, { useEffect, useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Select, type SelectOption } from "../ui/select";
import { Input } from "../ui/input";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { FilterIcon, FilterXIcon } from "lucide-react";
import { Badge } from "../ui/badge";
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

interface FilterRow {
  id: string;
  field: string;
  operator: IOperator;
  value: string;
}

interface FilterPopupProps {
  fields: Zodula.Field[];
  filters: IFilter<any, any, IOperator>[];
  onApplyFilters?: (filters: IFilter<any, any, IOperator>[]) => void;
  onClearFilters?: () => void;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  doctype?: Zodula.DoctypeName;
}

export function FilterPopup({
  fields,
  filters,
  onApplyFilters,
  onClearFilters,
  open,
  onOpenChange,
  doctype,
}: FilterPopupProps) {
  const { t } = useTranslation();

  // Fetch all fields to get child fields for Reference Table fields
  const { docs: allFields } = useDocList({
    doctype: "zodula__Field",
    limit: -1,
    sort: "idx",
    order: "asc",
  }, [doctype]);

  // Build map of reference table fields to their child fields
  const referenceTableChildFields = useMemo(() => {
    const map = new Map<string, any[]>();
    
    for (const field of fields) {
      if (field.type === "Reference Table" && field.reference) {
        const childFields = allFields.filter(
          (f: any) => 
            f.doctype === field.reference && 
            f.name !== field.reference &&
            !ClientFieldHelper.isStandardField(f.name || "")
        );
        if (childFields.length > 0) {
          map.set(field.name || "", childFields);
        }
      }
    }
    
    return map;
  }, [fields, allFields]);

  // Helper function to parse field path (e.g., "items.unit" -> { parentField: "items", childField: "unit" })
  const parseFieldPath = (fieldPath: string) => {
    if (!fieldPath || !fieldPath.includes(".")) {
      return { parentField: fieldPath, childField: null };
    }
    const parts = fieldPath.split(".", 2);
    if (parts.length < 2) {
      return { parentField: fieldPath, childField: null };
    }
    const [parentField, childField] = parts;
    return { parentField: parentField || fieldPath, childField: childField || null };
  };

  // Helper function to get the appropriate plugin for a field (supports dot notation)
  const getFieldPlugin = (fieldName: string) => {
    const { parentField, childField } = parseFieldPath(fieldName);
    
    if (childField) {
      // For reference table fields, find the child field
      const childFields = referenceTableChildFields.get(parentField);
      if (childFields) {
        const childFieldObj = childFields.find((f: any) => f.name === childField);
        if (childFieldObj) {
          return plugins.find((plugin) => plugin.types.includes(childFieldObj.type as any));
        }
      }
      return null;
    }
    
    const field = fields.find((f) => f.name === fieldName);
    if (!field) return null;

    return plugins.find((plugin) => plugin.types.includes(field.type as any));
  };

  // Get supported operators for a field (supports dot notation)
  const getSupportedOperators = (fieldName: string) => {
    const plugin = getFieldPlugin(fieldName);
    if (plugin?.supportOperators) {
      return OPERATORS.filter((op) => plugin.supportOperators!.includes(op.value));
    }
    return OPERATORS; // Default to all operators if no supportOperators specified
  };

  // Convert fields to options for the field selector (including nested reference table fields)
  const fieldOptions = useMemo(
    () => {
      const options: SelectOption[] = [{ value: "", label: "" }];
      
      // Add regular fields
      for (const field of fields) {
        // Skip standard fields
        if (ClientFieldHelper.isStandardField(field.name || "")) {
          continue;
        }
        
        if (field.type === "Reference Table" && field.reference) {
          // Add the reference table field itself as a group header
          const childFields = referenceTableChildFields.get(field.name || "");
          if (childFields && childFields.length > 0) {
            // Add nested fields
            for (const childField of childFields) {
              const childFieldName = childField.name || "";
              const parentFieldName = field.name || "";
              if (childFieldName && parentFieldName) {
                options.push({
                  value: `${parentFieldName}.${childFieldName}`,
                  label: `${t(field.label || parentFieldName)} → ${t(childField.label || childFieldName)}`,
                  subtitle: `${parentFieldName}.${childFieldName}`,
                });
              }
            }
          }
        } else if (field.type !== "Extend") {
          // Add regular fields (exclude Extend fields)
          options.push({
            value: (field.name as string) || "",
            label: t(field.label || field.name || ""),
            subtitle: field.name || "",
          });
        }
      }
      
      return options;
    },
    [fields, referenceTableChildFields, t]
  );
  const [filterRows, setFilterRows] = useState<FilterRow[]>(() => {
    if (filters.length === 0) {
      return [{ id: "1", field: "", operator: "=", value: "" }];
    }
    return filters.map((filter, index) => ({
      id: `${index + 1}`,
      field: filter[0] as string,
      operator: filter[1],
      value: String(filter[2] || ""),
    }));
  });

  const addFilterRow = () => {
    const newId = String(Date.now());
    setFilterRows([
      ...filterRows,
      { id: newId, field: "", operator: "=", value: "" },
    ]);
  };

  const removeFilterRow = (id: string) => {
    setFilterRows(filterRows.filter((row) => row.id !== id));
  };

  const updateFilterRow = (id: string, updates: Partial<FilterRow>) => {
    setFilterRows(
      filterRows.map((row) => (row.id === id ? { ...row, ...updates } : row))
    );
  };

  const handleApplyFilters = () => {
    const validFilters: IFilter<any, any, IOperator>[] = filterRows
      .filter(
        (row) =>
          row.field &&
          row.operator &&
          (row.value !== undefined ||
            ["is null", "is not null"].includes(row.operator))
      )
      .map((row) => {
        let value: any = row.value;
        // ex: 12.25, 12, 12.2500, 12.0000 but not 12.25.00, a12.25, 12.25a
        const floatRegex = /^[0-9]+\.?[0-9]*$/;
        const intRegex = /^[0-9]+$/;

        // Handle different operator value types
        if (["IN", "NOT IN"].includes(row.operator)) {
          value = row.value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        } else if (["IS NULL", "IS NOT NULL"].includes(row.operator)) {
          value = "1";
        } else if (row.operator === "LIKE" || row.operator === "NOT LIKE") {
          // Keep the value as is for like operators
          value = row.value;
        } else {
          // Try to parse as number for numeric operators
          const numValue = floatRegex.test(row.value)
            ? parseFloat(row.value)
            : intRegex.test(row.value)
              ? parseInt(row.value)
              : row.value;
          value = numValue;
        }

        return [row.field, row.operator, value] as IFilter<any, any, IOperator>;
      });

    onApplyFilters?.(validFilters);
    onOpenChange?.(false);
  };

  const handleClearFilters = () => {
    setFilterRows([{ id: "1", field: "", operator: "=", value: "" }]);
    onClearFilters?.();
    onOpenChange?.(false);
  };

  const getValueInputType = (operator: IOperator) => {
    if (["IS NULL", "IS NOT NULL"].includes(operator)) {
      return "hidden";
    }
    if (["IN", "NOT IN"].includes(operator)) {
      return "text";
    }
    return "text";
  };

  const getValuePlaceholder = (operator: IOperator) => {
    if (["IN", "NOT IN"].includes(operator)) {
      return "comma-separated values";
    }
    if (["LIKE", "NOT LIKE"].includes(operator)) {
      return "use % as wildcard";
    }
    return "value";
  };

  useEffect(() => {
    setFilterRows(
      filters?.map((filter, index) => ({
        id: `${index + 1}`,
        field: filter[0] as string,
        operator: filter[1],
        value: String(filter[2]),
      }))
    );
  }, [open]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <FilterIcon />
          {t("Filter")}
          {filters.length > 0 && (
            <Badge
              variant="default"
              className="zd:h-5 zd:w-5 zd:text-xs zd:rounded-full"
            >
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="zd:w-fit zd:bg-background zd:p-2 zd:border zd:rounded zd:min-w-[480px]"
        align="end"
      >
        <div className="zd:space-y-4">
          <div className="zd:space-y-3 zd:min-h-[24px]">
            {filterRows.map((row) => (
              <div key={row.id} className="zd:flex zd:items-center zd:gap-2">
                <Select
                  displayMode="label"
                  options={fieldOptions}
                  value={row.field}
                  onChange={(value) => {
                    const supportedOps = getSupportedOperators(value);
                    // If current operator is not supported by new field, reset to first supported operator
                    const newOperator = supportedOps.find(op => op.value === row.operator)?.value || supportedOps[0]?.value || "=";
                    updateFilterRow(row.id, { field: value, operator: newOperator as IOperator });
                  }}
                  className="zd:w-80"
                />

                <Select
                  displayMode="label"
                  options={getSupportedOperators(row.field).map((operator) => ({
                    value: operator.value,
                    label: operator.value,
                    subtitle: operator.label,
                  }))}
                  value={row.operator}
                  onChange={(value) =>
                    updateFilterRow(row.id, { operator: value as IOperator })
                  }
                  className={cn(
                    ["IS NULL", "IS NOT NULL"].includes(row.operator)
                      ? "zd:w-full"
                      : "zd:w-24"
                  )}
                />

                {getValueInputType(row.operator) !== "hidden" &&
                  (() => {
                    const { parentField, childField } = parseFieldPath(row.field);
                    let field: Zodula.Field | undefined;
                    
                    if (childField) {
                      // For reference table fields, find the child field
                      const childFields = referenceTableChildFields.get(parentField);
                    if (childFields && childField) {
                      field = childFields.find((f: any) => f.name === childField) as any;
                    }
                    } else {
                      field = fields.find((f) => f.name === row.field);
                    }
                    
                    const plugin = field ? getFieldPlugin(row.field) : null;

                    if (plugin && field) {
                      return (
                        <plugin.renderFilter
                          fieldOptions={field}
                          value={row.value}
                          onChange={(value) =>
                            updateFilterRow(row.id, { value })
                          }
                          operator={row.operator}
                        />
                      );
                    }

                    // Fallback to basic input if no plugin found
                    return (
                      <Input
                        type={getValueInputType(row.operator)}
                        placeholder={getValuePlaceholder(row.operator)}
                        value={row.value}
                        onChange={(e) =>
                          updateFilterRow(row.id, { value: e.target.value })
                        }
                        className="zd:flex-1"
                      />
                    );
                  })()}

                <Button
                  variant="ghost"
                  onClick={() => removeFilterRow(row.id)}
                  className="h-8 w-8 p-0"
                >
                  <FilterXIcon />
                </Button>
              </div>
            ))}
          </div>

          <div className="zd:flex zd:items-center zd:justify-between zd:pt-2 zd:border-t">
            <Button variant="ghost" onClick={addFilterRow}>
              + {t("Add")}
            </Button>
            <div className="zd:flex zd:gap-2">
              <Button variant="outline" onClick={handleClearFilters}>
                {t("Clear")}
              </Button>
              <Button onClick={handleApplyFilters}>{t("Apply")}</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
