import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FormPlugin } from "../plugin";
import { Select, type SelectAction } from "../../ui/select";
import { ArrowRight, FilterIcon, PlusIcon, ArrowUpDown, XIcon } from "lucide-react";
import { Link, useRouter } from "../../router";
import { useParams } from "react-router";
import { zodula } from "@/zodula/client";
import { cn } from "../../../lib/utils";
import { popup } from "../../ui/popit";
import { QuickEntryDialog } from "../../dialogs/quick-entry-dialog";
import { useDoc } from "../../../hooks/use-doc";
import { useDocListAll } from "../../../hooks/use-doc-list-all";

const ReferenceInput = (props: {
  fieldOptions: Zodula.Field;
  value?: any;
  onChange?: (fieldPath: string, value: any) => void;
  onBlur?: (fieldPath: string, value: any) => void;
  readonly?: boolean;
  multiple?: boolean;
  fieldKey?: string;
  formData?: any;
  fieldPath?: string;
  autocomplete?: "on" | "off";
  org?: string;
  doctype?: Zodula.DoctypeConfig;
  placeholder?: string;
}) => {
  const router = useRouter();
  const { org } = router.params;
  const organizationId = props.org || org || "";
  const [options, setOptions] = useState<
    { id: string; title: string; subtitle: string; doc: any }[]
  >([]);
  const [doctype, setDoctype] =
    useState<Zodula.SelectDoctype<"Doctype"> | null>(null);
  /** Temp string shown in input while user is searching; only committed via onChange when they select an option. */
  const [searchText, setSearchText] = useState<string | undefined>(undefined);
  const isVirtual = props.fieldOptions.type === "Virtual Reference";

  const referenceDoctype = useMemo(() => {
    const reference = zodula.utils.getFieldValueFromDoc(
      props.fieldOptions.reference as string,
      props.formData,
      props.fieldOptions
    ) as Zodula.DoctypeName | undefined;
    if (reference?.includes("{{")) return "";
    return reference;
  }, [props.fieldOptions.reference, props.formData, props.fieldOptions]);

  const { doc: referenceDoctypeDoc } = useDoc(
    { doctype: "Doctype", id: referenceDoctype || "" },
    [referenceDoctype]
  );

  const { docs: allFields } = useDocListAll({ doctype: "Field" });
  const referenceFields = useMemo(
    () =>
      referenceDoctype
        ? (allFields ?? []).filter(
          (f) => (f as any).doctype === referenceDoctype
        )
        : [],
    [allFields, referenceDoctype]
  );

  const filters = useMemo(() => {
    const childExtendFieldPropertyOverrides = (props as any)
      .childExtendFieldPropertyOverrides;
    const childTableFieldPropertyOverrides = (props as any)
      .childTableFieldPropertyOverrides;
    let rawFilters: any[] = [];

    if (props.fieldPath) {
      const pathParts = props.fieldPath.split(".");
      const lastIndex = pathParts.length - 1;
      if (
        pathParts.length >= 2 &&
        pathParts[0] &&
        lastIndex >= 0 &&
        pathParts[lastIndex]
      ) {
        const childFieldName = pathParts[0];
        const fieldName = pathParts[lastIndex];
        if (pathParts.length >= 3) {
          const possibleIndex = parseInt(pathParts[1] || "0", 10);
          if (!isNaN(possibleIndex)) {
            const childOverrides =
              childTableFieldPropertyOverrides?.[childFieldName]?.[
              possibleIndex
              ]?.[fieldName] ??
              childTableFieldPropertyOverrides?.[childFieldName]?.[-1]?.[
              fieldName
              ] ??
              childExtendFieldPropertyOverrides?.[fieldName];
            if (childOverrides?.filters) {
              try {
                rawFilters =
                  typeof childOverrides.filters === "string"
                    ? JSON.parse(childOverrides.filters)
                    : childOverrides.filters;
              } catch {
                // fall through
              }
            }
          }
        }
        if (pathParts.length === 2 && rawFilters.length === 0) {
          const childOverrides =
            childExtendFieldPropertyOverrides?.[childFieldName]?.[fieldName];
          if (childOverrides?.filters) {
            try {
              rawFilters =
                typeof childOverrides.filters === "string"
                  ? JSON.parse(childOverrides.filters)
                  : childOverrides.filters;
            } catch {
              // fall through
            }
          }
        }
      }
    }

    if (rawFilters.length === 0) {
      try {
        rawFilters = JSON.parse(props.fieldOptions.filters || "[]");
      } catch {
        return [];
      }
    }

    const formData = props.formData;
    if (!formData || !Array.isArray(rawFilters)) return rawFilters;
    return rawFilters.map((filter: any) => {
      if (!Array.isArray(filter) || filter.length < 3) return filter;
      const [fieldPath, operator, filterValue] = filter;
      if (
        typeof filterValue !== "string" ||
        !filterValue.includes("{{")
      )
        return filter;
      const resolved = zodula.utils.getFieldValueFromDoc(
        filterValue,
        formData,
        props.fieldOptions
      );
      return [fieldPath, operator, resolved];
    });
  }, [
    props.fieldOptions.filters,
    props.formData,
    (props as any).childExtendFieldPropertyOverrides,
    (props as any).childTableFieldPropertyOverrides,
    props.fieldPath,
  ]);

  useEffect(() => {
    if (!referenceDoctype) return;
    zodula.doc
      .get_doc("Doctype", referenceDoctype as any, {})
      .then(setDoctype);
  }, [referenceDoctype]);

  const getSearchQuery = useCallback(
    (value: string): string => {
      if (!props.multiple) return value || "";
      if (!value || value.trim() === "") return "";
      const parts = value.split(",");
      const lastPart = parts[parts.length - 1]?.trim() || "";
      if (value.endsWith(",")) return "";
      return lastPart;
    },
    [props.multiple]
  );

  const appendOrReplaceOnSelect = useCallback(
    (currentValue: string, newId: string): string => {
      if (!props.multiple) return newId;
      if (!currentValue || !currentValue.trim()) return newId;
      if (currentValue.endsWith(",")) return `${currentValue}${newId}`;
      const optionIds = new Set(options.map((o) => o.id));
      const parts = currentValue
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const lastPart = parts[parts.length - 1] ?? "";
      const isLastPartSearchTerm =
        lastPart && !optionIds.has(lastPart);
      if (isLastPartSearchTerm) {
        const previous = parts.slice(0, -1).join(",");
        return previous ? `${previous},${newId}` : newId;
      }
      const ids = new Set(parts);
      if (ids.has(newId)) return currentValue;
      return `${currentValue},${newId}`;
    },
    [props.multiple, options]
  );

  const getNestedValue = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((cur: any, key) => cur?.[key], obj);
  };

  const buildPrefillData = useCallback((): Record<string, any> => {
    const prefill: Record<string, any> = {};
    if (!referenceFields?.length || !referenceDoctype) return prefill;
    const fieldMap = new Map<string, any>();
    referenceFields.forEach((f: any) => {
      if (f.name) fieldMap.set(f.name, f);
    });

    if (filters && Array.isArray(filters)) {
      filters.forEach((filter: any) => {
        if (!Array.isArray(filter) || filter.length < 3) return;
        const [fieldPath, operator, filterValue] = filter;
        if (operator !== "=") return;
        if (fieldPath.includes(".")) {
          const [parentFieldName, ...rest] = fieldPath.split(".");
          const childFieldName = rest.join(".");
          const parentField = fieldMap.get(parentFieldName);
          // Emit flat key for form prefill: e.g. filters "links.link_type" = "Customer" -> "links.0.link_type": "Customer"
          const isRefTable = parentField ? parentField.type === "Reference Table" : true;
          const flatKey = isRefTable ? `${parentFieldName}.0.${childFieldName}` : `${parentFieldName}.${childFieldName}`;
          prefill[flatKey] = filterValue;
        } else {
          const field = fieldMap.get(fieldPath);
          if (field) {
            let v = filterValue;
            if (field.type === "Check")
              v =
                filterValue === 1 ||
                  filterValue === "1" ||
                  filterValue === true ||
                  filterValue === "true"
                  ? 1
                  : 0;
            else if (field.type === "Integer" || field.type === "Float") {
              v = Number(filterValue);
              if (isNaN(v)) v = filterValue;
            } else if (field.type === "Date" || field.type === "Datetime")
              v = String(filterValue);
            prefill[fieldPath] = v;
          }
        }
      });
    }
    if (props.formData) {
      const targetNames = new Set(fieldMap.keys());
      Object.keys(props.formData).forEach((fieldName) => {
        if (
          targetNames.has(fieldName) &&
          prefill[fieldName] === undefined
        ) {
          const v = props.formData[fieldName];
          if (v !== undefined && v !== null && v !== "")
            prefill[fieldName] = v;
        }
      });
    }
    if (filters && Array.isArray(filters) && props.formData) {
      filters.forEach((filter: any) => {
        if (!Array.isArray(filter) || filter.length < 3) return;
        const [fieldPath, operator] = filter;
        if (operator !== "=" || !fieldPath.includes(".")) return;
        const formVal = getNestedValue(props.formData, fieldPath);
        if (formVal === undefined || formVal === null || formVal === "") return;
        const [parentFieldName, ...rest] = fieldPath.split(".");
        const childFieldName = rest.join(".");
        const parentField = fieldMap.get(parentFieldName);
        const isRefTable = parentField ? parentField.type === "Reference Table" : true;
        const flatKey = isRefTable ? `${parentFieldName}.0.${childFieldName}` : `${parentFieldName}.${childFieldName}`;
        if (prefill[flatKey] === undefined) prefill[flatKey] = formVal;
      });
    }
    return prefill;
  }, [filters, referenceFields, referenceDoctype, props.formData]);

  const search = useCallback(
    async (query: string) => {
      if (!doctype || !referenceDoctype) return;
      const q = getSearchQuery(query);
      const sortField = props.fieldOptions.sort || "updated_at";
      const orderDirection = props.fieldOptions.order || "asc";
      const res = await zodula.doc.select_docs(referenceDoctype as any, {
        q: q,
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
              ?.map((field: string) => r[field])
              ?.filter(
                (field: string) =>
                  field !== undefined && field !== null && field !== ""
              )
              ?.join(", ") || "",
          doc: r.doc,
        }))
      );
    },
    [
      doctype,
      referenceDoctype,
      filters,
      props.fieldOptions.sort,
      props.fieldOptions.order,
      getSearchQuery,
    ]
  );

  // When committed value changes from parent, exit "search mode"
  useEffect(() => {
    setSearchText(undefined);
  }, [props.value]);

  // When doctype becomes available while user is searching, run search
  useEffect(() => {
    if (doctype && searchText !== undefined) search(searchText);
  }, [doctype, searchText, search]);

  const actions = useMemo((): SelectAction[] => {
    const out: SelectAction[] = [];
    if (filters?.length > 0) {
      out.push({
        label: "",
        disabled: true,
        description: filters
          .map((f: any) => `${f[0]} ${f[1]} ${f[2]}`)
          .join(", "),
        icon: <FilterIcon />,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
      });
    }
    if (props.fieldOptions.sort || props.fieldOptions.order) {
      out.push({
        label: "",
        disabled: true,
        description: `Sort: ${props.fieldOptions.sort || "updated_at"}, Order: ${props.fieldOptions.order || "asc"}`,
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
      out.push({
        label: "Create",
        icon: <PlusIcon />,
        onClick: async () => {
          if (!referenceDoctype) return;
          const isQuickEntry = referenceDoctypeDoc?.is_quick_entry === 1;
          if (isQuickEntry) {
            const prefill = buildPrefillData();
            const result = await popup(QuickEntryDialog, undefined, {
              doctype: referenceDoctype,
              fields: referenceFields as any,
              org: organizationId,
              cbUrl: window.location.pathname,
              fromField: props.fieldPath || props.fieldKey,
              prefill: Object.keys(prefill).length ? prefill : undefined,
            });
            if (result?.id) {
              if (props.multiple) {
                const cur = props.value || "";
                const newVal = cur ? `${cur},${result.id}` : result.id;
                props.onChange?.(props.fieldPath || "", newVal);
              } else {
                props.onChange?.(props.fieldPath || "", result.id);
              }
            }
          } else {
            const prefill = buildPrefillData();
            router.push(
              `/desk/${organizationId}/doctypes/${referenceDoctype}/form`,
              {
                state: {
                  cbUrl: window.location.pathname,
                  fromField: props.fieldPath || props.fieldKey,
                  ...(Object.keys(prefill).length ? { prefill } : {}),
                },
              }
            );
          }
        },
      });

      // push Clear Value Action
      out.push({
        label: "Clear",
        icon: <XIcon />,
        onClick: () => {
          props.onChange?.(props.fieldPath || "", "");
          props.onBlur?.(props.fieldPath || "", "");
        },
      });
    }
    return out;
  }, [
    doctype,
    referenceDoctype,
    referenceDoctypeDoc,
    referenceFields,
    organizationId,
    props.multiple,
    props.value,
    props.fieldPath,
    props.fieldKey,
    filters,
    props.fieldOptions.sort,
    props.fieldOptions.order,
    buildPrefillData,
    router,
  ]);

  const fieldPath = props.fieldPath || props.fieldKey || "";

  // Display value: temp search text while user is typing, otherwise committed value
  const displayValue =
    searchText !== undefined ? searchText : (props.value ?? "");

  const handleFocus = useCallback(() => {
    const initial = props.value ?? "";
    setSearchText(initial);
    if (doctype) search(initial);
  }, [doctype, search, props.value]);

  const handleChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (doctype) search(value);
    },
    [doctype, search]
  );

  const handleSelect = useCallback(
    (option: { value: string; label: string; subtitle?: string }) => {
      if (props.readonly) return;
      if (props.multiple) {
        const current = searchText ?? props.value ?? "";
        const newValue = appendOrReplaceOnSelect(current, option.value);
        props.onChange?.(fieldPath, newValue);
        setSearchText(undefined);
      } else {
        props.onChange?.(fieldPath, option.value);
        setSearchText(undefined);
      }
    },
    [
      props.readonly,
      props.multiple,
      props.value,
      props.onChange,
      fieldPath,
      searchText,
      appendOrReplaceOnSelect,
    ]
  );

  const handleBlur = useCallback(
    async (opts?: { reason: "selection" | "blur"; value: string }) => {
      if (opts?.reason === "selection") return;
      const currentValue = (opts?.value ?? searchText ?? "").trim();
      setSearchText(undefined);

      if (!currentValue) {
        props.onChange?.(fieldPath, "");
        props.onBlur?.(fieldPath, "");
        return;
      }

      if (!referenceDoctype) {
        props.onBlur?.(fieldPath, props.value);
        return;
      }

      if (props.multiple) {
        const ids = currentValue.split(",").map((s) => s.trim()).filter(Boolean);
        const existing: string[] = [];
        for (const id of ids) {
          try {
            const res = await zodula.doc.get_doc(
              referenceDoctype as Zodula.DoctypeName,
              id,
              {}
            );
            if (res?.id) existing.push(res.id);
          } catch {
            // skip invalid id
          }
        }
        const newValue = existing.join(",");
        props.onChange?.(fieldPath, newValue);
        props.onBlur?.(fieldPath, newValue);
      } else {
        try {
          const docs = await zodula.doc.select_docs(referenceDoctype as any, {
            limit: 1,
            sort: "updated_at",
            order: "asc",
            filters: [["id", "=", currentValue], ...filters],
          });
          const doc = docs.docs[0];
          if (doc?.id) {
            props.onChange?.(fieldPath, doc.id);
            props.onBlur?.(fieldPath, doc.id);
          } else {
            props.onChange?.(fieldPath, "");
            props.onBlur?.(fieldPath, "");
          }
        } catch {
          props.onChange?.(fieldPath, "");
          props.onBlur?.(fieldPath, "");
        }
      }
    },
    [
      fieldPath,
      referenceDoctype,
      props.multiple,
      props.onChange,
      props.onBlur,
      searchText,
    ]
  );

  const className = useMemo(
    () =>
      cn(
        "zd:rounded zd:border-l-3 zd:font-bold",
        !isVirtual ? "zd:hover:ring-primary zd:hover:ring-1" : ""
      ),
    [isVirtual]
  );

  if (props.readonly) {
    return (
      <span className="zd:text-muted-foreground zd:h-8 zd:flex zd:items-center zd:gap-1 zd:bg-muted/50 zd:rounded-md zd:p-2">
        <Link
          to={`/desk/${organizationId}/doctypes/${referenceDoctype || ""}/form/${props.value || ""}`}
          className="zd:text-primary zd:hover:underline  zd:whitespace-nowrap zd:truncate"
        >
          {props.value}
        </Link>
      </span>
    );
  }

  return (
    <Select
      autocomplete={props.autocomplete}
      actions={actions}
      placeholder={props.placeholder || ""}
      value={displayValue}
      options={options.map((o) => ({
        label: o.title,
        value: o.id,
        subtitle: o.subtitle,
      }))}
      onChange={handleChange}
      onBlur={handleBlur}
      onSelect={handleSelect}
      onFocus={handleFocus}
      className={className}
      allowFreeText
      readOnly={props.readonly}
      clearable={false}
      hideChevron
      searchable
      suffix={
        !!props.value && !props.multiple ? (
          <Link
            to={`/desk/${organizationId}/doctypes/${referenceDoctype || ""}/form/${props.value || ""}`}
            className="no-print"
          >
            <ArrowRight />
          </Link>
        ) : undefined
      }
    />
  );
};

export const ReferencePlugin = new FormPlugin({
  types: ["Reference", "Virtual Reference"],
  supportOperators: [
    "=",
    "!=",
    "LIKE",
    "NOT LIKE",
    "IN",
    "NOT IN",
    "IS NULL",
    "IS NOT NULL",
  ],
  render: (props) => <ReferenceInput {...props} />,
  renderFilter: (props) => (
    <ReferenceInput
      {...props}
      multiple={props.operator === "IN" || props.operator === "NOT IN"}
    />
  ),
});
