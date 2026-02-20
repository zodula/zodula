import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";
import { FilterIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import { useTranslation } from "../../hooks/use-translation";
import { FilterContent } from "./FilterContent";

interface FilterPopupProps {
  fields: Zodula.Field[];
  filters: IFilter<any, any, IOperator>[];
  onApplyFilters?: (filters: IFilter<any, any, IOperator>[]) => void;
  onClearFilters?: () => void;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  doctype?: Zodula.DoctypeName;
  /** When true, filters apply on every change (no Apply button); popover stays open */
  applyImmediately?: boolean;
}

export function FilterPopup({
  fields,
  filters,
  onApplyFilters,
  onClearFilters,
  open,
  onOpenChange,
  doctype,
  applyImmediately = false,
}: FilterPopupProps) {
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <FilterIcon />
          {t("Filter")}
          {filters.length > 0 && (
            <Badge variant="default" className="zd:h-5 zd:w-5 zd:text-xs zd:rounded-full">
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="zd:w-fit zd:bg-background zd:p-2 zd:border zd:rounded zd:min-w-[480px]"
        align="end"
      >
        <FilterContent
          fields={fields}
          filters={filters}
          onApplyFilters={(f) => {
            onApplyFilters?.(f);
            if (!applyImmediately) onOpenChange?.(false);
          }}
          onClearFilters={() => {
            onClearFilters?.();
            onOpenChange?.(false);
          }}
          doctype={doctype}
          showBorderTop={true}
          applyImmediately={applyImmediately}
        />
      </PopoverContent>
    </Popover>
  );
}
