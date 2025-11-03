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
}

export function FilterPopup({
  fields,
  filters,
  onApplyFilters,
  onClearFilters,
  open,
  onOpenChange,
}: FilterPopupProps) {
  const { t } = useTranslation();
  // Helper function to get the appropriate plugin for a field
  const getFieldPlugin = (fieldName: string) => {
    const field = fields.find((f) => f.name === fieldName);
    if (!field) return null;

    return plugins.find((plugin) => plugin.types.includes(field.type as any));
  };

  // Convert fields to options for the field selector
  const fieldOptions = useMemo(
    () => [
      { value: "", label: "" },
      ...fields.map(
        (field) =>
          ({
            value: (field.name as string) || "",
            label: t(field.label || field.name || ""),
            subtitle: field.name || "",
          }) satisfies SelectOption
      ),
    ],
    [fields, t]
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
                  onChange={(value) =>
                    updateFilterRow(row.id, { field: value })
                  }
                  className="zd:w-40"
                />

                <Select
                  displayMode="label"
                  options={OPERATORS.map((operator) => ({
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
                    const field = fields.find((f) => f.name === row.field);
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
