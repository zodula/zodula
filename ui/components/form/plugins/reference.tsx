import React, { useEffect, useMemo, useState } from "react";
import { FormPlugin } from "../plugin";
import { Select, type SelectAction } from "../../ui/select";
import { ArrowRight, FilterIcon, PlusIcon, ArrowUpDown } from "lucide-react";
import { Link, useRouter } from "../../router";
import { useParams } from "react-router";
import { zodula } from "@/zodula/client";
import { cn } from "../../../lib/utils";
import { Input } from "../../ui/input";
import { popup } from "../../ui/popit";
import { QuickEntryDialog } from "../../dialogs/quick-entry-dialog";
import { useDoc } from "../../../hooks/use-doc";
import { useDocList } from "../../../hooks/use-doc-list";
import { useOrganization } from "../../../hooks/use-organization";

const ReferenceInput = (props: {
  fieldOptions: Zodula.Field;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: (value: any) => void;
  readonly?: boolean;
  multiple?: boolean;
  fieldKey?: string;
  formData?: any;
  fieldPath?: string;
  autocomplete?: "on" | "off";
  org?: string;
}) => {
  const router = useRouter();
  const { org } = router.params;
  const organizationId = props.org || org || "";
  const [options, setOptions] = useState<
    { id: string; title: string; subtitle: string; doc: any }[]
  >([]);
  const [doctype, setDoctype] =
    useState<Zodula.SelectDoctype<"zodula__Doctype"> | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isVirtual = props.fieldOptions.type === "Virtual Reference";
  
  const referenceDoctype = useMemo(() => {
    const reference = zodula.utils.getFieldValueFromDoc(
      props.fieldOptions.reference as string,
      props.formData,
      props.fieldOptions
    ) as Zodula.DoctypeName | undefined;
    if(reference?.includes("{{")) {
      return ""
    }
    return reference;
  }, [props.fieldOptions.reference, props.formData, props.fieldOptions]);

  // Get doctype metadata to check if it's quick entry
  const { doc: referenceDoctypeDoc } = useDoc({
    doctype: "zodula__Doctype",
    id: referenceDoctype || ""
  }, [referenceDoctype]);

  // Get fields for the reference doctype
  const { docs: referenceFields } = useDocList({
    doctype: "zodula__Field",
    limit: -1,
    sort: "idx",
    order: "asc",
    q: "",
    filters: referenceDoctype ? [
      ["doctype", "=", referenceDoctype]
    ] : []
  }, [referenceDoctype]);
  const filters = useMemo(() => {
    // Check for child field property overrides first (from parent form scripts)
    const childExtendFieldPropertyOverrides = (props as any).childExtendFieldPropertyOverrides;
    const childTableFieldPropertyOverrides = (props as any).childTableFieldPropertyOverrides;
    
    if (props.fieldPath) {
      // Extract child field name, index (if Reference Table), and field name from fieldPath
      // fieldPath format for Reference Table: "sales_invoices_references.0.sales_invoice"
      // fieldPath format for Extend: "address.city"
      const pathParts = props.fieldPath.split('.');
      const lastIndex = pathParts.length - 1;
      
      if (pathParts.length >= 2 && pathParts[0] && lastIndex >= 0 && pathParts[lastIndex]) {
        const childFieldName = pathParts[0]; // e.g., "sales_invoices_references" or "address"
        const fieldName = pathParts[lastIndex]; // e.g., "sales_invoice" or "city"
        
        // Check if it's a Reference Table (has numeric index in path)
        if (pathParts.length >= 3) {
          const possibleIndex = parseInt(pathParts[1] || "0", 10);
          if (!isNaN(possibleIndex)) {
            // It's a Reference Table field
            const childOverrides = childTableFieldPropertyOverrides?.[childFieldName]?.[possibleIndex]?.[fieldName];
            if (childOverrides?.filters) {
              try {
                return typeof childOverrides.filters === 'string' 
                  ? JSON.parse(childOverrides.filters) 
                  : childOverrides.filters;
              } catch (e) {
                // Fall through to fieldOptions.filters
              }
            }
          }
        }
        
        // Check for Extend field overrides (no index in path)
        if (pathParts.length === 2) {
          const childOverrides = childExtendFieldPropertyOverrides?.[childFieldName]?.[fieldName];
          if (childOverrides?.filters) {
            try {
              return typeof childOverrides.filters === 'string' 
                ? JSON.parse(childOverrides.filters) 
                : childOverrides.filters;
            } catch (e) {
              // Fall through to fieldOptions.filters
            }
          }
        }
      }
    }
    
    // Fall back to field options filters
    try {
      return JSON.parse(props.fieldOptions.filters || "[]");
    } catch (e) {
      return [];
    }
  }, [props.fieldOptions.filters, (props as any).childExtendFieldPropertyOverrides, (props as any).childTableFieldPropertyOverrides, props.fieldPath]);
  useEffect(() => {
    async function getDoctype() {
      if (!isFocused) return;
      const reference = referenceDoctype;
      if (!reference) return;
      const doctype = await zodula.doc.get_doc(
        "zodula__Doctype",
        reference as any,
        {}
      );
      setDoctype(doctype);
    }
    getDoctype();
  }, [referenceDoctype, isFocused]);
  // Extract search query from value in multiple mode
  const getSearchQuery = (value: string): string => {
    if (!props.multiple) {
      return value || "";
    }
    
    // If empty, return empty query
    if (!value || value.trim() === "") {
      return "";
    }
    
    // Split by comma and get the last part
    const parts = value.split(",");
    const lastPart = parts[parts.length - 1]?.trim() || "";
    
    // If value ends with comma (last part is empty), return empty query
    if (value.endsWith(",")) {
      return "";
    }
    
    // Otherwise return the last part as search query
    return lastPart;
  };

  // Get previous values (all parts except the last one) in multiple mode
  const getPreviousValues = (value: string): string => {
    if (!props.multiple || !value || value.trim() === "") {
      return "";
    }
    
    const parts = value.split(",");
    // Remove the last part (the one being typed)
    const previousParts = parts.slice(0, -1);
    return previousParts.join(",");
  };

  // Append or replace value in multiple mode
  const appendValue = (currentValue: string, newValue: string): string => {
    if (!props.multiple) {
      return newValue;
    }
    
    if (!currentValue || currentValue.trim() === "") {
      return newValue;
    }
    
    // If value ends with comma, just append
    if (currentValue.endsWith(",")) {
      return `${currentValue}${newValue}`;
    }
    
    // Otherwise, replace the last part with the new value
    const previousValues = getPreviousValues(currentValue);
    if (previousValues) {
      return `${previousValues},${newValue}`;
    }
    // If no previous values, just return the new value
    return newValue;
  };

  async function search(value: string) {
    if (!doctype) return;
    const reference = zodula.utils.getFieldValueFromDoc(
      props.fieldOptions.reference as string,
      props.formData,
      props.fieldOptions
    );
    if (!reference) return;
    
    // Extract the search query based on multiple mode
    const searchQuery = getSearchQuery(value);
    
    // Get sort and order from field options, with defaults
    const sortField = props.fieldOptions.sort || "updated_at";
    const orderDirection = props.fieldOptions.order || "asc";
    
    const res = await zodula.doc.select_docs(reference as any, {
      q: searchQuery,
      limit: 10000,
      sort: sortField,
      order: orderDirection,
      filters: filters,
    });
    setOptions(
      res.docs.map((r) => ({
        id: r.id,
        title: r[doctype.display_field || "id"] || r.id,
        subtitle:
          doctype.search_fields
            ?.split("\n")
            .map((field: string) => r[field])
            .filter(
              (field: string) =>
                field !== undefined && field !== null && field !== ""
            )
            .join(", ") || "",
        doc: r.doc,
      }))
    );
  }
  useEffect(() => {
    if (!isFocused) return;
    search(props.value || "");
  }, [props.value, isFocused, doctype]);

  const actions = useMemo(() => {
    let _actions: SelectAction[] = [];
    if (filters?.length > 0) {
      _actions.push({
        label: "",
        disabled: true,
        description: `
              ${filters.map((filter: any) => `${filter[0]} ${filter[1]} ${filter[2]}`).join(", ")}
              `,
        icon: <FilterIcon />,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
      });
    }
    // Show sort and order if configured
    if (props.fieldOptions.sort || props.fieldOptions.order) {
      const sortField = props.fieldOptions.sort || "updated_at";
      const orderDirection = props.fieldOptions.order || "asc";
      _actions.push({
        label: "",
        disabled: true,
        description: `Sort: ${sortField}, Order: ${orderDirection}`,
        icon: <ArrowUpDown />,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
      });
    }
    if (
      !doctype?.is_single &&
      !doctype?.is_system_generated &&
      !!referenceDoctype
    ) {
      _actions.push({
        label: "Create",
        icon: <PlusIcon />,
        onClick: async () => {
          if (!referenceDoctype) return;
          
          // Unfocus the input when opening dialog
          setIsFocused(false);
          
          // Extract prefill data: match fields from current form that exist in target doctype
          const prefill: Record<string, any> = {};
          if (props.formData && referenceFields) {
            const targetFieldNames = new Set(
              referenceFields.map((field: any) => field.name).filter(Boolean)
            );
            
            // Match fields from current form to target doctype fields
            Object.keys(props.formData).forEach((fieldName) => {
              if (targetFieldNames.has(fieldName)) {
                const value = props.formData[fieldName];
                // Only include non-empty values
                if (value !== undefined && value !== null && value !== "") {
                  prefill[fieldName] = value;
                }
              }
            });
          }
          
          // Check if doctype is quick entry
          const isQuickEntry = referenceDoctypeDoc?.is_quick_entry === 1;
          
          if (isQuickEntry) {
            // Use quick entry dialog
            const result = await popup(QuickEntryDialog, undefined, {
              doctype: referenceDoctype,
              fields: referenceFields as any,
              org: organizationId,
              prefill: prefill
            });
            
            if (result?.id) {
              // Set the created document ID as the value
              if (props.multiple) {
                const newValue = appendValue(props.value || "", result.id);
                props.onChange?.(newValue);
              } else {
                props.onChange?.(result.id);
              }
            }
          } else {
            // Navigate to full form
            setIsFocused(false);
            router.push(`/desk/${organizationId}/doctypes/${referenceDoctype}/form`, {
              state: {
                cbUrl: window.location.pathname,
                fromField: props.fieldPath || props.fieldKey,
                fromDoc: props.formData,
                prefill: prefill
              },
            });
          }
        },
      });
    }
    return _actions;
  }, [doctype, props.fieldOptions.reference, referenceDoctype, referenceDoctypeDoc, referenceFields, organizationId, props.multiple, props.value, props.onChange, props.fieldPath, props.fieldKey, props.formData, router, setIsFocused]);
  return (
    <Select
      autocomplete={props.autocomplete}
      actions={actions}
      placeholder={""}
      value={props.value}
      options={options.map((option) => ({
        label: option.title,
        value: option.id,
        subtitle: option.subtitle,
      }))}
      onChange={(value) => {
        // Don't allow changes if readonly
        if (!props.readonly) {
          // In multiple mode, allow free text typing
          // The onSelect handler will handle appending when an option is selected
          props.onChange?.(value);
        }
      }}
      onSelect={(option) => {
        // When selecting an option in multiple mode, replace the last part with the selected value
        if (props.multiple && option) {
          const newValue = appendValue(props.value || "", option.value);
          props.onChange?.(newValue);
        } else if (!props.multiple) {
          props.onChange?.(option.value);
        }
      }}
      onFocus={() => {
        setIsFocused(true);
        if (!doctype) return;
        if (!props.value || options.length === 0) {
          search(props.value || "");
        }
      }}
      // onSelect={(option) => {
      //     props.onChange?.(option.value);
      // }}
      className={cn(
        "zd:rounded-md zd:border-l-3",
        !isVirtual ? "zd:hover:ring-primary zd:hover:ring-1" : ""
      )}
      onBlur={async () => {
        // Clear value if it doesn't match any existing option
        if (props.value && options.length <= 0 && !!referenceDoctype) {
          props.onChange?.("");
        }
        props.onBlur?.(props.value);
        setIsFocused(false);
      }}
      allowFreeText
      readOnly={props.readonly}
      clearable={true}
      hideChevron={true}
      suffix={
        <>
          {!!props.value && !props.multiple && (
            <Link
              to={`/desk/${organizationId}/doctypes/${referenceDoctype || ""}/form/${props.value || ""}`}
              className={cn(
                "no-print",
              )}
            >
              <ArrowRight />
            </Link>
          )}
        </>
      }
    />
  );
};

export const ReferencePlugin = new FormPlugin({
  types: ["Reference", "Virtual Reference"],
  supportOperators: ["=", "!=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"],
  render: (props) => {
    return <ReferenceInput {...props} />;
  },
  renderFilter: (props) => {
    return <ReferenceInput {...props} multiple={props.operator === "IN" || props.operator === "NOT IN"} />;
  }
});
