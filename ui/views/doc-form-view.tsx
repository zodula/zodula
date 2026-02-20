import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useRouter } from "@/zodula/ui/components/router";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { useForm } from "@/zodula/ui/hooks/use-form";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout } from "@/zodula/ui/layout/sidebar-layout";
import { Form } from "@/zodula/ui/components/form/form";
import { Button } from "@/zodula/ui/components/ui/button";
import {
  Save,
  Copy,
  ArrowLeft,
  ArrowRight,
  Printer,
  MoreHorizontal,
  Trash2,
  SaveIcon,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { ClientFieldHelper } from "@/zodula/client/field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/zodula/ui/components/ui/dropdown-menu";
import { zodula } from "@/zodula/client";
import { confirm, popup } from "@/zodula/ui/components/ui/popit";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { useAction } from "../hooks/use-action";
import { DocStatusBadge } from "../components/custom/doc-status-badge";
import { useAuth } from "../hooks/use-auth";
import { FormActions } from "@/zodula/ui/components/form/form-actions";
import { AuditTrail } from "@/zodula/ui/components/custom/audit-trail";
import { useTranslation } from "../hooks/use-translation";
import { useUIScriptStore } from "../zui";
import { useUIScript } from "../hooks/use-ui-script";
import { useDocStore } from "../hooks/use-doc-store";
import { PrintTemplateDialog } from "../components/dialogs/print-template-dialog";
import { MultiSelectDoctypeDialog } from "../components/dialogs/multi-select-doctype-dialog";
import { useUserName } from "../hooks/use-user-name";
import ErrorView from "./error-view";
import { useParams } from "react-router";
import { toast } from "../components/ui/toast";
import { useCreateFormPersistenceStore } from "../hooks/use-create-form-persistence";

const UserLink = ({ userId, name }: { userId: string; name: string }) => {
  const { org } = useParams();
  return (
    <Link
      to={`/desk/${org}/doctypes/zodula__User/form/${userId}`}
      className="zd:hover:text-primary zd:transition-colors zd:text-sm"
    >
      {name}
    </Link>
  );
};

interface DocFormViewProps {
  doctype: Zodula.DoctypeName;
  id?: string;
  prefill?: Record<string, any>;
  mode?: "create" | "edit";
  cbUrl?: string;
  fromField?: string;
  fromDoc?: Record<string, any>;
  resetForm?: boolean;
}

let checked = false;

// Helper function to compare values (handles different types)
// Moved outside component to prevent recreation on every render
function valuesAreEqual(val1: any, val2: any): boolean {
  // Fast path: same reference
  if (val1 === val2) return true;
  
  // Handle null/undefined
  if (val1 == null && val2 == null) return true;
  if (val1 == null || val2 == null) return false;
  
  // Handle arrays and objects - use shallow comparison first for performance
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    // Fast path: if they're arrays, check length first
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) return false;
      // For arrays, only do deep comparison if lengths match
      if (val1.length === 0) return true;
      // For small arrays, do shallow comparison first
      if (val1.length <= 10) {
        for (let i = 0; i < val1.length; i++) {
          if (val1[i] !== val2[i]) {
            // Only do deep comparison if shallow fails
            return JSON.stringify(val1) === JSON.stringify(val2);
          }
        }
        return true;
      }
    }
    // For objects, use JSON.stringify (necessary for deep comparison)
    return JSON.stringify(val1) === JSON.stringify(val2);
  }
  
  // Handle primitive types
  return val1 === val2;
}

export function DocFormView({
  doctype,
  id,
  prefill,
  cbUrl,
  fromField,
  fromDoc,
  mode = "edit",
}: DocFormViewProps) {
  // ===== ROUTER & STATE =====
  const { push, replace, pathname, location, back } = useRouter();
  const { org } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  // ===== AUTH & TRANSLATION =====
  const { roles, user } = useAuth();
  const { t } = useTranslation();
  // ===== FORM PERSISTENCE =====
  const { saveFormValues, getFormValues, clearFormValues } = useCreateFormPersistenceStore();

  // ===== DOCTYPE & DOC DATA =====
  const { doc: doctypeDoc } = useDocAll({
    doctype: "zodula__Doctype",
    id: doctype
  });

  const { doc, loading, error, reload } = useDoc(
    {
      doctype: doctype as Zodula.DoctypeName,
      id: id || "",
    },
    [mode]
  );

  // ===== USER NAMES =====
  const userIds = useMemo(() => {
    if (!doc) return [];
    const ids = [];
    if (doc.created_by) ids.push(doc.created_by);
    if (doc.updated_by) ids.push(doc.updated_by);
    return [...new Set(ids)]; // Remove duplicates
  }, [doc]);

  const { getUserName } = useUserName({
    userIds,
    enabled: mode === "edit" && !!doc,
  });

  // ===== CONNECTIONS =====
  type Connection = {
    doctype: string;
    filters: [string, string, any][];
  };

  const {
    data: connectionsData,
    loading: connectionsLoading,
    error: connectionsError,
    reload: reloadConnections,
  } = useAction(
    "zodula.core.connections",
    {
      data: {
        doctype: doctype,
        id: id || "",
      },
    },
    [doctype, id]
  );

  const connections = useMemo<Connection[]>(() => {
    return (connectionsData?.connections || []) as Connection[];
  }, [connectionsData]);

  // ===== CONNECTIONS COUNT =====
  const {
    data: connectionsCount,
    loading: connectionsCountLoading,
    error: connectionsCountError,
    reload: reloadConnectionsCount,
  } = useAction(
    "zodula.core.count",
    {
      data: {
        docFilters: connections.map((connection: Connection) => ({
          doctype: connection.doctype,
          filters: connection.filters,
        })),
      },
    },
    [connections]
  );

  // ===== BADGE CONFIGURATIONS =====
  const badgeConfigs = useRef<Record<string, { variant?: string | null; size?: string | null; getValue?: (doc: any) => any }>>({});
  
  // ===== SECONDARY BUTTONS =====
  const secondaryButtons = useRef<Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: "outline" | "ghost" | "solid" | "subtle" | "success";
    icon?: React.ComponentType<any>;
    disabled?: boolean;
    items?: Array<{
      label: string;
      icon?: React.ComponentType<any>;
      onClick: () => void | Promise<void>;
      disabled?: boolean;
    }>;
  }>>([]);

  // Refs for form get/set so on_render script context can update form when e.g. "Add Delivery Orders" is clicked
  const formSetValueRef = useRef<(fieldName: string, value: any) => void>(() => {});
  const formGetFormDataRef = useRef<() => Record<string, any>>(() => ({}));

  // ===== FIELDS =====
  // Fetch all fields with persistent caching, then filter client-side
  const { docs: allFields, reload: reloadFields } = useDocListAll({
    doctype: "zodula__Field"
  });

  // Filter fields by doctype and sort by idx
  const fields = useMemo(() => {
    return allFields
      .filter((field) => field.doctype === doctype)
      .sort((a, b) => (a.idx || 0) - (b.idx || 0));
  }, [allFields, doctype]);

  // ===== FIELD-LEVEL PERMISSIONS =====
  const { docs: doctypePermissions } = useDocList(
    {
      doctype: "zodula__Doctype Permission",
      limit: -1,
      filters: [["doctype", "=", doctype]],
    },
    [fields]
  );

  // Map field-level permissions: field name -> permission record
  const fieldPermissions = useMemo(() => {
    if (!doctypePermissions || !fields || !roles) {
      return new Map<string, Zodula.SelectDoctype<"zodula__Doctype Permission">>();
    }

    // Include Authenticated and Anonymous roles (matching server-side logic)
    const allRoles = [
      ...roles,
      "Anonymous",
      user ? "Authenticated" : undefined,
    ].filter(Boolean) as string[];

    return ClientFieldHelper.getFieldLevelPermissions(
      doctypePermissions,
      fields.map((f) => ({ name: f.name, perm_level: f.perm_level || undefined })),
      allRoles
    );
  }, [doctypePermissions, fields, roles, user]);

  // Check if user owns the document
  const isOwn = useMemo(() => {
    return doc?.owner === (user?.id || null);
  }, [doc?.owner, user?.id]);

  // ===== FIELD PROPERTY OVERRIDES =====
  // Track field property overrides from UI scripts (set_df_property)
  const [fieldPropertyOverrides, setFieldPropertyOverrides] = useState<Record<string, Record<string, any>>>({});
  
  // Track child Extend field property overrides from UI scripts (set_df_child_extend_property)
  // Structure: { childFieldName: { fieldName: { property: value } } }
  const [childExtendFieldPropertyOverrides, setChildExtendFieldPropertyOverrides] = useState<Record<string, Record<string, Record<string, any>>>>({});
  
  // Track child Reference Table field property overrides from UI scripts (set_df_child_table_property)
  // Structure: { childFieldName: { idx: { fieldName: { property: value } } } }
  const [childTableFieldPropertyOverrides, setChildTableFieldPropertyOverrides] = useState<Record<string, Record<number, Record<string, Record<string, any>>>>>({});

  // Function to set field property (used by UI scripts)
  const setFieldProperty = useCallback((fieldName: string, property: string, value: any) => {
    setFieldPropertyOverrides((prev) => {
      const newOverrides = { ...prev };
      if (!newOverrides[fieldName]) {
        newOverrides[fieldName] = {};
      }
      newOverrides[fieldName][property] = value;
      return newOverrides;
    });
  }, []);

  // Function to set child Extend field property (used by UI scripts)
  const setChildExtendProperty = useCallback((childField: string, fieldName: string, property: string, value: any) => {
    setChildExtendFieldPropertyOverrides((prev) => {
      const newOverrides = { ...prev };
      if (!newOverrides[childField]) {
        newOverrides[childField] = {};
      }
      if (!newOverrides[childField][fieldName]) {
        newOverrides[childField][fieldName] = {};
      }
      newOverrides[childField][fieldName][property] = value;
      return newOverrides;
    });
  }, []);

  // Function to set child Reference Table field property (used by UI scripts)
  // If idx is null, apply to all rows. Updates are immutable so React re-renders with new filters.
  const setChildTableProperty = useCallback((childField: string, idx: number | null, fieldName: string, property: string, value: any) => {
    setChildTableFieldPropertyOverrides((prev) => {
      const targetIdx = idx === null ? -1 : idx;
      const prevChild = prev[childField] ?? {};
      const prevIdx = prevChild[targetIdx] ?? {};
      const prevField = prevIdx[fieldName] ?? {};
      const newField = { ...prevField, [property]: value };
      const newIdx = { ...prevIdx, [fieldName]: newField };
      const newChild = { ...prevChild, [targetIdx]: newIdx };
      return { ...prev, [childField]: newChild };
    });
  }, []);

  // ===== FORM LOGIC =====
  const formFields = useMemo(() => {
    if (!fields || !doctypeDoc) return {};

    const processedFields: Record<string, any> = {};
    const isSystemAdmin = roles?.includes("System Admin") || false;

    fields.forEach((field) => {
      if (field.doctype === doctype) {
        if (!field.name) {
          return;
        }
        if (
          Object.keys(ClientFieldHelper.standardFields()).includes(field.name)
        )
          return {};

        // Check field-level permissions
        const { canGet, canUpdate } = ClientFieldHelper.checkPermLevelForField(
          fieldPermissions,
          field.name,
          field.perm_level || undefined,
          isOwn,
          false, // bypass
          isSystemAdmin
        );

        // Skip field if user can't get it
        if (!canGet) {
          return;
        }

        // Determine if field should be readonly based on permissions
        const fieldReadonly = !canUpdate || field.readonly === 1;

        // Check doc_status based readonly conditions
        const docStatus = doc?.doc_status ?? 0;
        let statusBasedReadonly = false;
        
        // Access field config properties (allow_on_submit and only_once are direct properties on field)
        // Support both field.config.allow_on_submit (if config exists) and field.allow_on_submit (direct property)
        const allowOnSubmit = (field as any).config?.allow_on_submit ?? field.allow_on_submit;
        const onlyOnce = (field as any).config?.only_once ?? field.only_once;
        
        // Condition 1: doc_status == 1 && field.config.allow_on_submit !== 1
        if (docStatus === 1 && allowOnSubmit !== 1) {
          statusBasedReadonly = true;
        }
        // Condition 2: doc_status == 0 && field.config.only_once == 1
        else if (docStatus === 0 && onlyOnce === 1 && mode === "edit") {
          statusBasedReadonly = true;
        }
        // Condition 3: doc_status !== 1 && doc_status !== 0
        else if (docStatus !== 1 && docStatus !== 0) {
          statusBasedReadonly = true;
        }

        // Start with base field configuration
        let fieldConfig: any = {
          ...field,
          label: t(field.label || field.name || ""),
          // Set readonly based on update permission and status-based conditions
          readonly: (fieldReadonly || statusBasedReadonly) ? 1 : (field.readonly || 0),
        };

        // Apply property overrides from UI scripts
        const overrides = fieldPropertyOverrides[field.name];
        if (overrides) {
          // Handle common property overrides
          if (overrides.hidden !== undefined) {
            fieldConfig.hidden = overrides.hidden ? 1 : 0;
          }
          if (overrides.readonly !== undefined) {
            fieldConfig.readonly = overrides.readonly ? 1 : 0;
          }
          if (overrides.required !== undefined) {
            fieldConfig.required = overrides.required ? 1 : 0;
          }
          if (overrides.label !== undefined) {
            fieldConfig.label = overrides.label;
          }
          // Apply any other property overrides
          Object.keys(overrides).forEach((prop) => {
            if (!['hidden', 'readonly', 'required', 'label'].includes(prop)) {
              fieldConfig[prop] = overrides[prop];
            }
          });
        }

        processedFields[field.name] = fieldConfig;
      }
    });

    return processedFields;
  }, [fields, doctypeDoc, t, fieldPermissions, isOwn, roles, user, fieldPropertyOverrides, doc]);

  // Child doctype fields for Reference Table fetch_from enrichment (keyed by child doctype id)
  const refTableRefs = useMemo(
    () =>
      Object.values(formFields)
        .filter((f: any) => f?.type === "Reference Table" && f.reference)
        .map((f: any) => f.reference as string)
        .filter((r): r is string => !!r),
    [formFields]
  );
  const { docs: childFieldDocs } = useDocList(
    {
      doctype: "zodula__Field" as Zodula.DoctypeName,
      limit: -1,
      filters: refTableRefs.length > 0 ? (["doctype", "in", refTableRefs] as any) : [],
      sort: "idx",
      order: "asc",
    },
    [refTableRefs.join(",")]
  );
  const childFieldsByDoctype = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of childFieldDocs || []) {
      const d = (f as any).doctype;
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(f);
    }
    return map;
  }, [childFieldDocs]);

  // Compute formId based on mode and document ID
  const formId = useMemo(() => {
    if (mode === "create") {
      return `create-${doctype}`;
    }
    return `edit-${doctype}-${id || ""}`;
  }, [doctype, id, mode]);

  const {
    formData,
    handleChange: setFormFieldValue,
    setValues,
    reset,
    setValue,
    getFormData,
  } = useForm({
    formId,
    initialValues: undefined,
    fields: formFields,
  });

  formSetValueRef.current = setValue;
  formGetFormDataRef.current = getFormData;

  // ===== SCRIPT & FETCH HELPERS =====
  const { fetchDoc, getDoc } = useDocStore();

  const getNestedValue = useCallback((obj: any, path: string): any => {
    if (!obj || !path) return undefined;

    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }, []);

  // Enrich reference table rows with fetch_from from linked docs (e.g. setValue("items", [{ delivery_order: id }]) -> fill shipping_address, etc.)
  const enrichReferenceTableRows = useCallback(
    async (tableFieldName: string, rows: any[]): Promise<any[]> => {
      if (!Array.isArray(rows) || rows.length === 0) return rows;
      const tableField = formFields[tableFieldName] as any;
      if (!tableField || tableField?.type !== "Reference Table" || !tableField.reference) return rows;
      const childFields = childFieldsByDoctype[tableField.reference];
      if (!childFields?.length) return rows;
      const dependentFields: Array<{ fieldName: string; sourceFieldName: string; fetchPath: string }> = [];
      for (const f of childFields) {
        const fetchFrom = (f as any).fetch_from;
        if (fetchFrom && typeof fetchFrom === "string" && fetchFrom.includes(".")) {
          const [sourceFieldName, ...rest] = fetchFrom.split(".");
          const fetchPath = rest.join(".");
          if (sourceFieldName && fetchPath)
            dependentFields.push({ fieldName: (f as any).name, sourceFieldName, fetchPath });
        }
      }
      const firstDependent = dependentFields[0];
      if (!firstDependent) return rows;
      const sourceFieldName = firstDependent.sourceFieldName;
      const sourceFieldConfig = childFields.find((f: any) => f.name === sourceFieldName);
      const refDoctype = sourceFieldConfig?.reference as Zodula.DoctypeName | undefined;
      if (!refDoctype) return rows;
      const fetchFields = [...new Set(dependentFields.map((d) => d.fetchPath.split(".")[0]).filter((x): x is string => !!x))];
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const refId = row?.[sourceFieldName];
          if (!refId) return { ...row };
          try {
            await fetchDoc(refDoctype, refId, fetchFields);
            const cached = getDoc(refDoctype, refId);
            const fetchedDoc = cached?.data;
            if (!fetchedDoc) return { ...row };
            const next = { ...row };
            for (const d of dependentFields) {
              const v = getNestedValue(fetchedDoc, d.fetchPath);
              if (v !== undefined) next[d.fieldName] = v;
            }
            return next;
          } catch {
            return { ...row };
          }
        })
      );
      return enriched;
    },
    [formFields, childFieldsByDoctype, fetchDoc, getDoc, getNestedValue]
  );

  // Create parent FormContext for child forms and on_render scripts (with live getValue/setValue via refs)
  const parentFormContext = useMemo(() => {
    if (!doc) return null;
    const setValueWithEnrich = async (fieldName: string, value: any) => {
      const tableField = formFields[fieldName] as any;
      if (tableField?.type === "Reference Table" && Array.isArray(value)) {
        const enriched = await enrichReferenceTableRows(fieldName, value);
        formSetValueRef.current?.(fieldName, enriched);
      } else {
        formSetValueRef.current?.(fieldName, value);
      }
    };
    return {
      doctype,
      doc: doc as any,
      isCreate: mode === "create",
      isEdit: mode === "edit",
      getValue: <K extends string | number | symbol>(fieldName: K) => formGetFormDataRef.current?.()?.[fieldName as string],
      setValue: <K extends string | number | symbol>(fieldName: K, value: any) => setValueWithEnrich(fieldName as string, value) as any,
      set_child_table_value: async (fieldName: string, rows: any[]) => {
        const enriched = await enrichReferenceTableRows(fieldName, rows);
        formSetValueRef.current?.(fieldName, enriched);
      },
      set_child_extend_value: (fieldName: string, data: Record<string, any>) => {
        formSetValueRef.current?.(fieldName, data);
      },
      addBadge: (fieldName: keyof any | string, config: { variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "draft" | "submitted" | "cancelled" | "pending" | "approved" | "rejected" | "muted" | "info" | null; size?: "sm" | "md" | "lg" | "default"; getValue?: (doc: Partial<any>) => any }) => {
        badgeConfigs.current[String(fieldName)] = config;
      },
      addSecondaryButton: (label: string, onClick: () => void | Promise<void>, options?: {
        variant?: "outline" | "ghost" | "solid" | "subtle" | "success";
        icon?: React.ComponentType<any>;
        disabled?: boolean;
        items?: Array<{
          label: string;
          icon?: React.ComponentType<any>;
          onClick: () => void | Promise<void>;
          disabled?: boolean;
        }>;
      }) => {
        secondaryButtons.current.push({
          label,
          onClick,
          ...options
        });
      },
      navigate: (path: string, options?: { state?: any }) => {
        if (options?.state) {
          push(path, { state: options.state });
        } else {
          push(path);
        }
      },
      org: org || undefined,
      showDialog: async (component: any, dialogProps: any) => popup(component, dialogProps),
      open_multi_select_dialog: async (
        doctypeName: Zodula.DoctypeName,
        options?: {
          title?: string;
          defaultFilters?: any[];
          limit?: number;
          width?: number | string;
          list_view_fields?: string[];
        }
      ) => {
        const result = await popup(
          MultiSelectDoctypeDialog,
          { title: options?.title ?? "Select", width: options?.width },
          {
            doctype: doctypeName,
            defaultFilters: options?.defaultFilters ?? [],
            limit: options?.limit ?? 500,
            list_view_fields: options?.list_view_fields,
          }
        );
        return result ?? null;
      },
    };
  }, [doctype, doc, mode, org, push, formFields, enrichReferenceTableRows]);

  const { execute } = useUIScript(doctype, {
    formData,
    setValue,
    setValues,
    getValue: (fieldName) => getFormData()[fieldName],
    getValues: getFormData,
    setFieldProperty,
    setChildExtendProperty,
    setChildTableProperty,
    parentContext: parentFormContext as any,
    docId: id,
    isCreate: mode === "create" || !doc?.doc_status,
    isEdit: mode === "edit",
    showDialog: async (component, dialogProps) => popup(component, dialogProps),
    navigate: (path) => push(path),
    showToast: (message, type = "info") => toast[type](message),
  });

  // Execute form scripts for on_render event (after parentFormContext is defined)
  useEffect(() => {
    if (!doc || !parentFormContext) return;
    secondaryButtons.current = [];
    const store = useUIScriptStore.getState();
    const executeRenderScripts = async () => {
      await store.executeScripts(doctype, "on_render", parentFormContext);
    };
    executeRenderScripts();
  }, [doctype, doc, mode, parentFormContext]);

  // Handler for nested field changes (e.g., "tax_and_charges.rate")
  const handleNestedFieldChange = useCallback(
    async (nestedFieldPath: string, value: any, oldValue: any, idx?: number) => {
      // Parse nested field path (e.g., "tax_and_charges.rate")
      const parts = nestedFieldPath.split('.', 2);
      const tableField = parts[0];
      const childField = parts[1];
      if (!tableField || !childField) return;

      // Get current table data
      const currentData = getFormData();
      const tableData = (currentData[tableField] || []) as any[];
      
      // Update the specific row's field value BEFORE building updatedFormData
      // This ensures scripts see the updated value
      const updatedTableData = [...tableData];
      if (idx !== undefined && idx >= 0) {
        if (!updatedTableData[idx]) {
          updatedTableData[idx] = {};
        }
        updatedTableData[idx] = {
          ...updatedTableData[idx],
          [childField]: value
        };
      }
      
      // Build updated form data snapshot for scripts with the updated table data
      const updatedFormData = {
        ...currentData,
        [tableField]: updatedTableData
      };
      
      // Also update the form store immediately so getValue returns the latest data
      setFormFieldValue(tableField as keyof typeof formFields, updatedTableData);

      // Execute UI scripts for nested field change
      await execute("field_change", nestedFieldPath, {
        fieldName: nestedFieldPath,
        value,
        oldValue,
        formData: updatedFormData,
        getValue: (name: string) => {
          // Handle nested field paths
          if (name.includes('.')) {
            const parts = name.split('.', 2);
            const tableFieldName = parts[0];
            const childFieldName = parts[1];
            if (tableFieldName && childFieldName) {
              const table = updatedFormData[tableFieldName] as any[];
              if (Array.isArray(table)) {
                // For paths like "tax_and_charges.rate", get from current row (idx)
                if (idx !== undefined && idx >= 0 && table[idx]) {
                  return (table[idx] as any)?.[childFieldName];
                }
                // Fallback: return first row's value
                return (table[0] as any)?.[childFieldName];
              }
            }
          }
          return updatedFormData[name];
        },
        getValues: () => updatedFormData,
        idx: idx
      });
    },
    [getFormData, execute, setFormFieldValue, formFields]
  );

  // Centralized field change handler: fetch_from + scripts + form store update
  const handleFieldChange = useCallback(
    async (fieldName: keyof typeof formFields, value: any) => {
      if (!formFields || Object.keys(formFields).length === 0) {
        return;
      }

      const currentData = getFormData();
      const oldValue = currentData?.[fieldName as string];

      // Find dependent fields that use fetch_from on this field
      const dependentFields: Array<{ fieldName: string; fetchPath: string }> =
        [];
      Object.entries(formFields).forEach(([key, field]) => {
        if (
          field.fetch_from &&
          field.fetch_from.startsWith((fieldName as string) + ".")
        ) {
          const fetchPath = field.fetch_from.substring(
            (fieldName as string).length + 1
          );
          dependentFields.push({
            fieldName: key,
            fetchPath,
          });
        }
      });

      const dependentUpdates: Record<string, any> = {};

      // Helper: find dependents of a source field (fields whose fetch_from starts with sourceFieldName.)
      const getDependentsOf = (sourceFieldName: string) => {
        const deps: Array<{ fieldName: string; fetchPath: string }> = [];
        Object.entries(formFields).forEach(([key, field]) => {
          if (
            field.fetch_from &&
            field.fetch_from.startsWith(sourceFieldName + ".")
          ) {
            const fetchPath = field.fetch_from.substring(
              sourceFieldName.length + 1
            );
            deps.push({ fieldName: key, fetchPath });
          }
        });
        return deps;
      };

      // Helper: compute updates for one source field (reference or extend)
      const computeFetchUpdatesForSource = async (
        sourceFieldName: string,
        sourceValue: any,
        mergedData: Record<string, any>
      ): Promise<Record<string, any>> => {
        const updates: Record<string, any> = {};
        const deps = getDependentsOf(sourceFieldName);
        if (deps.length === 0) return updates;

        const sourceField = formFields[sourceFieldName as string];
        if (!sourceValue) {
          deps.forEach((d) => {
            updates[d.fieldName] = null;
          });
          return updates;
        }

        if (sourceField?.type === "Extend") {
          try {
            for (const d of deps) {
              const v = getNestedValue(sourceValue, d.fetchPath);
              updates[d.fieldName] =
                v !== undefined && v !== null ? v : null;
            }
          } catch {
            deps.forEach((d) => {
              updates[d.fieldName] = null;
            });
          }
          return updates;
        }

        if (sourceField?.reference) {
          try {
            const rootFields = deps
              .map((d) => d.fetchPath.split(".")[0])
              .filter((v): v is string => !!v);
            const fetchFields = [...new Set(rootFields)];
            await fetchDoc(
              sourceField.reference as Zodula.DoctypeName,
              sourceValue,
              fetchFields
            );
            const cachedDoc = getDoc(
              sourceField.reference as Zodula.DoctypeName,
              sourceValue
            );
            if (!cachedDoc?.data) {
              deps.forEach((d) => {
                updates[d.fieldName] = null;
              });
              return updates;
            }
            const fetchedDoc = cachedDoc.data;
            for (const d of deps) {
              const receivingFieldConfig = formFields[d.fieldName];
              if (!receivingFieldConfig) {
                updates[d.fieldName] = null;
                continue;
              }
              const fetchedValue = getNestedValue(fetchedDoc, d.fetchPath);
              const isImagePreviewField =
                receivingFieldConfig.type === "Image Preview";
              if (
                isImagePreviewField &&
                fetchedValue !== undefined &&
                fetchedValue !== null &&
                fetchedValue !== ""
              ) {
                const fetchPathParts = d.fetchPath.split(".");
                const parentFieldName =
                  fetchPathParts[fetchPathParts.length - 1];
                const organization =
                  mergedData?.organization || "System Panel";
                updates[d.fieldName] = `/files/${organization}/${sourceField.reference}/${sourceValue}/${parentFieldName}/${fetchedValue}`;
              } else if (
                fetchedValue !== undefined &&
                fetchedValue !== null
              ) {
                updates[d.fieldName] = fetchedValue;
              } else {
                updates[d.fieldName] = null;
              }
            }
          } catch (error) {
            console.warn(
              `Failed to fetch data for field ${String(sourceFieldName)}:`,
              error
            );
            deps.forEach((d) => {
              updates[d.fieldName] = null;
            });
          }
        }
        return updates;
      };

      // Handle fetch_from logic before running scripts (with nested/chained fetch support)
      if (dependentFields.length > 0 && value) {
        let accumulatedUpdates: Record<string, any> = {};
        let mergedData: Record<string, any> = {
          ...currentData,
          [fieldName as string]: value,
        };

        // First round: dependents of the changed field
        const firstRound = await computeFetchUpdatesForSource(
          fieldName as string,
          value,
          mergedData
        );
        accumulatedUpdates = { ...firstRound };
        mergedData = { ...mergedData, ...accumulatedUpdates };

        // Subsequent rounds: any field we just filled may itself be a source for other fetch_from
        let sourcesToProcess = Object.keys(firstRound);
        const maxRounds = 10; // prevent infinite chains
        for (let round = 0; round < maxRounds && sourcesToProcess.length > 0; round++) {
          const nextRound: Record<string, any> = {};
          for (const sourceKey of sourcesToProcess) {
            const sourceVal = mergedData[sourceKey];
            const updates = await computeFetchUpdatesForSource(
              sourceKey,
              sourceVal,
              mergedData
            );
            Object.assign(nextRound, updates);
          }
          if (Object.keys(nextRound).length === 0) break;
          accumulatedUpdates = { ...accumulatedUpdates, ...nextRound };
          mergedData = { ...mergedData, ...nextRound };
          sourcesToProcess = Object.keys(nextRound);
        }

        if (Object.keys(accumulatedUpdates).length > 0) {
          setValues(accumulatedUpdates);
        }
      } else if (dependentFields.length > 0 && !value) {
        // Clear direct dependents, then recursively clear any nested dependents
        const clearDependents = (sourceFieldName: string) => {
          const deps = getDependentsOf(sourceFieldName);
          const updates: Record<string, any> = {};
          deps.forEach((d) => {
            updates[d.fieldName] = null;
          });
          return updates;
        };
        dependentFields.forEach((df) => {
          dependentUpdates[df.fieldName] = null;
        });
        let accumulatedNulls = { ...dependentUpdates };
        let sourcesToProcess = Object.keys(accumulatedNulls);
        const maxRounds = 10;
        for (let round = 0; round < maxRounds && sourcesToProcess.length > 0; round++) {
          const nextRound: Record<string, any> = {};
          for (const sourceKey of sourcesToProcess) {
            Object.assign(nextRound, clearDependents(sourceKey));
          }
          if (Object.keys(nextRound).length === 0) break;
          accumulatedNulls = { ...accumulatedNulls, ...nextRound };
          sourcesToProcess = Object.keys(nextRound);
        }
        setValues(accumulatedNulls);
      }

      // Build updated form data snapshot for scripts
      const updatedFormData = {
        ...getFormData(),
        ...dependentUpdates,
        [fieldName as string]: value,
      };

      // Execute UI scripts for field change
      await execute("field_change", fieldName as string, {
        fieldName: fieldName as string,
        value,
        oldValue,
        formData: updatedFormData,
        getValue: (name: string) => updatedFormData[name],
        getValues: () => updatedFormData,
      });

      // Persist main field change after scripts
      setFormFieldValue(fieldName as string, value);
      
      // Save form values to persistence store in create mode
      if (mode === "create" && org) {
        const latestFormData = getFormData();
        saveFormValues(doctype, org, latestFormData);
      }
    },
    [
      formFields,
      getFormData,
      getNestedValue,
      fetchDoc,
      getDoc,
      setValues,
      execute,
      setFormFieldValue,
      mode,
      org,
      doctype,
      saveFormValues,
    ]
  );

  // Run refresh once per document/context
  const refreshExecutedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = mode === "create" ? "create" : id || "new";
    if (!doctype) return;
    if (refreshExecutedRef.current === key) return;
    refreshExecutedRef.current = key;
    execute("refresh");
  }, [mode, id, doctype, execute]);

  // Hydrate initial values: trigger dependent fetches and scripts once per doc
  const fieldHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = mode === "create" ? `create-${formId}` : `doc-${id || "new"}`;
    if (fieldHydratedRef.current === key) return;
    if (!formData) return;
    if (!formFields || Object.keys(formFields).length === 0) return;
    fieldHydratedRef.current = key;

    const hydrate = async () => {
      for (const [fieldName, value] of Object.entries(formData)) {
        if (value === undefined || value === null) continue;
        await handleFieldChange(fieldName as keyof typeof formFields, value);
      }
    };

    hydrate();
  }, [mode, id, formId, formData, formFields, handleFieldChange]);

  // ===== FORM EFFECTS =====
  // Track previous doc ID to prevent unnecessary updates
  const prevDocIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (doc) {
      const currentDocId = doc.id;

      // Only update form values if doc ID changed (new document loaded)
      // This prevents overwriting user input while typing
      if (prevDocIdRef.current !== currentDocId) {
        const valuesToSet = { ...doc };
        if (prefill) {
          Object.assign(valuesToSet, prefill);
        }
        for (const [key, value] of Object.entries(valuesToSet)) {
          setValue(key as keyof typeof valuesToSet, value);
        }
        prevDocIdRef.current = currentDocId;
        // Reset so hydrate effect runs with new formData and triggers fetch_from
        fieldHydratedRef.current = null;
      }
    }
  }, [doc?.id, setValue, prefill, mode]);

  // Note: Default values and prefill for create mode are now handled in handleResetForm
  // This ensures proper sequencing: reset -> defaults -> prefill -> refresh script

  // Helper function to reset form and apply default values
  const handleResetForm = useCallback(async () => {
    // Step 1: Reset the form first (clears all values)
    reset();
    
    // Step 2: Wait for reset to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Step 3: Apply default values, saved values, and prefill after reset
    if (mode === "create" && fields?.length > 0 && doctypeDoc) {
      const defaultValues: Record<string, any> = {};

      // If prefill exists, clear saved values first (reset before prefill)
      if (prefill && org) {
        clearFormValues(doctype, org);
      }

      // First, apply field defaults
      fields.forEach((field) => {
        if (
          field.doctype === doctype &&
          field.default !== undefined &&
          field.default !== null &&
          field.name !== "doc_status"
        ) {
          if (["Integer", "Float", "Check"].includes(field.type)) {
            defaultValues[field.name] = +field.default;
          } else {
            defaultValues[field.name] = zodula.utils.getDefaultValue(
              field as Zodula.Field
            );
          }
        }
      });

      // Then, restore saved form values ONLY if there's no prefill
      // (If prefill exists, saved values were already cleared above)
      if (!prefill && org) {
        const savedValues = getFormValues(doctype, org);
        if (savedValues) {
          Object.assign(defaultValues, savedValues);
        }
      }

      // Finally, apply prefill (prefill overrides defaults and saved values)
      if (prefill) {
        Object.assign(defaultValues, prefill);
      }

      // Step 4: Set all values at once (defaults + prefill)
      setValues(defaultValues);
      // Reset so hydrate effect runs with new formData and triggers fetch_from for prefill/defaults
      fieldHydratedRef.current = null;

      // Step 4.5: Wait for form state to update and verify values are set
      // Use a longer delay to ensure React has fully processed the state update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify that prefill values are actually in the form store
      const verifyFormData = getFormData();
      const missingPrefillFields: string[] = [];
      if (prefill) {
        Object.keys(prefill).forEach((key) => {
          // Skip reference table fields as they're handled differently
          // Check if the value is missing (undefined) or if it doesn't match the prefill value
          const currentValue = verifyFormData[key];
          const prefillValue = prefill[key];
          if (key !== 'references' && 
              prefillValue !== undefined && 
              prefillValue !== null && 
              currentValue !== prefillValue) {
            missingPrefillFields.push(key);
          }
        });
        
        // If any prefill values are missing, set them again
        if (missingPrefillFields.length > 0) {
          const missingValues: Record<string, any> = {};
          missingPrefillFields.forEach((key) => {
            missingValues[key] = prefill[key];
          });
          setValues(missingValues);
          // Wait again after setting missing values
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Step 4.6: Clear prefill from location state after applying it
      // This prevents prefill from being re-applied on re-renders
      if (prefill && location.state?.prefill && !prefillAppliedRef.current) {
        prefillAppliedRef.current = true;
        // Use setTimeout to avoid state updates during render
        setTimeout(() => {
          replace(pathname, {
            state: {
              ...location.state,
              prefill: undefined
            }
          });
        }, 0);
      }

      // Step 5: Execute refresh script with the latest form data
      // Get the latest form data after all values have been set
      const latestFormData = getFormData();
      
      // Store prefill values that might be cleared by refresh script
      const prefillValuesToRestore: Record<string, any> = {};
      if (prefill) {
        // Store important prefill values that refresh scripts might clear
        Object.keys(prefill).forEach((key) => {
          if (key !== 'references' && latestFormData[key] !== undefined && latestFormData[key] !== null) {
            prefillValuesToRestore[key] = latestFormData[key];
          }
        });
      }
      
      // Execute refresh script with the latest form data
      // Override formData, getValue, and getValues to always use the latest form store state
      // This ensures frm.get_value() returns current values and frm.set_value() updates correctly
      await execute("refresh", undefined, {
        formData: latestFormData,
        getValue: (fieldName: string) => {
          // Always get the latest value from the form store
          return getFormData()[fieldName];
        },
        getValues: () => {
          // Always return the latest form data from the store
          return getFormData();
        },
      });
      
      // Step 6: Restore prefill values that might have been cleared by refresh script
      // Some refresh scripts clear fields (like party) even when they should be preserved
      if (Object.keys(prefillValuesToRestore).length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const afterRefreshData = getFormData();
        const valuesToRestore: Record<string, any> = {};
        
        Object.keys(prefillValuesToRestore).forEach((key) => {
          // Only restore if the value was cleared (undefined/null/empty) but we had a prefill value
          const currentValue = afterRefreshData[key];
          const prefillValue = prefillValuesToRestore[key];
          if ((currentValue === undefined || currentValue === null || currentValue === "") && 
              prefillValue !== undefined && prefillValue !== null && prefillValue !== "") {
            valuesToRestore[key] = prefillValue;
          }
        });
        
        if (Object.keys(valuesToRestore).length > 0) {
          setValues(valuesToRestore);
        }
      }
    } else {
      // For edit mode, wait for reset to complete then execute refresh
      await Promise.resolve().then(async () => {
        const latestFormData = getFormData();
        await execute("refresh", undefined, {
          formData: latestFormData,
          getValue: (fieldName: string) => latestFormData[fieldName],
          getValues: () => latestFormData,
        });
      });
    }
  }, [mode, fields, doctypeDoc, doctype, prefill, setValues, execute, reset, getFormData, replace, pathname, location, org, getFormValues, clearFormValues]);

  // ===== EVENT HANDLERS =====
  const handleReload = async () => {
    reload().then((doc) => {
      setValues(doc as Record<string, any>);
    });
  };

  const handleDuplicate = () => {
    if (!doc || !fields) return;

    const prefillData: Record<string, any> = {};

    fields.forEach((field) => {
      if (field.doctype === doctype && field.name) {
        // Skip fields with no_copy flag, except for Reference Table and Extend fields
        if (field.no_copy === 1 && field.type !== "Reference Table" && field.type !== "Extend") {
          return;
        }

        const fieldValue = (doc as Record<string, any>)[field.name];
        if (fieldValue !== undefined && fieldValue !== null) {
          // Handle Reference Table fields (arrays of child documents)
          if (field.type === "Reference Table" && Array.isArray(fieldValue)) {
            // Copy child documents but remove IDs so new ones are created
            prefillData[field.name] = fieldValue.map((childDoc: any) => {
              const { id, ...rest } = childDoc;
              return rest;
            });
          }
          // Handle Extend fields (single child document)
          else if (field.type === "Extend" && typeof fieldValue === "object" && fieldValue !== null) {
            // Copy child document but remove ID so a new one is created
            const { id, ...rest } = fieldValue;
            prefillData[field.name] = rest;
          }
          // Handle regular fields
          else {
            prefillData[field.name] = fieldValue;
          }
        }
      }
    });

    push(`/desk/${org}/doctypes/${doctype}/form`, {
      state: { prefill: prefillData },
    });
  };

  const handleSubmit = async () => {
    try {
      const con = await confirm({
        title: "Submit Document",
        message: `Are you sure you want to submit this ${doctypeDoc?.label || doctype} document? This action will change the document status.`,
        confirmText: "Submit",
        cancelText: "Cancel",
        variant: "default",
      });
      if (con) {
        await zodula.doc.submit_doc(doctype, id || "").then((submittedDoc: Zodula.SelectDoctype<Zodula.DoctypeName>) => {
          setValues(submittedDoc as Record<string, any>);
          reload();
        });
      }
    } catch (error) {
      console.error("Error submitting doc:", error);
    }
  };

  const handleCancel = async () => {
    try {
      const con = await confirm({
        message:
          "Are you sure you want to cancel this document ? This action cannot be undone. The changes you made will be lost.",
        variant: "destructive",
      });
      if (con) {
        await zodula.doc.cancel_doc(doctype, id || "").then((canceledDoc: Zodula.SelectDoctype<Zodula.DoctypeName>) => {
          setValues(canceledDoc as Record<string, any>);
          reload();
        });
      }
    } catch (error) {
      console.error("Error canceling doc:", error);
    }
  };

  // Helper function to normalize Reference Table fields (empty arrays/undefined -> null)
  const normalizeReferenceTableFields = useCallback((data: Record<string, any>) => {
    const normalized = { ...data };
    
    // Find all Reference Table fields
    Object.keys(formFields).forEach((fieldName) => {
      const field = formFields[fieldName];
      if (field?.type === "Reference Table") {
        const value = normalized[fieldName];
        // Convert undefined or empty array to null
        if (value === undefined || (Array.isArray(value) && value.length === 0)) {
          normalized[fieldName] = "";
        }
      }
    });
    
    return normalized;
  }, [formFields]);

  // Helper function to get all field values for update/save
  const getUpdatePayload = useCallback(() => {
    // Always get the latest form data directly from the store
    // This ensures we have the most current values even after ID changes
    const latestFormData = getFormData();

    if (!doc) {
      // For create mode, return all form data with normalized Reference Table fields
      return normalizeReferenceTableFields(latestFormData);
    }

    // For edit mode, return all field values from form data
    // Include all fields that exist in either doc or latestFormData
    const allFieldNames = new Set([
      ...Object.keys(latestFormData),
      ...Object.keys(doc as any)
    ]);

    const allFields: Record<string, any> = {};

    // Include all fields from latestFormData (prefer form data values)
    allFieldNames.forEach((fieldName) => {
      const formValue = latestFormData[fieldName];
      const docValue = (doc as any)[fieldName];
      
      // Use form value if it exists, otherwise use doc value
      if (formValue !== undefined) {
        allFields[fieldName] = formValue;
      } else if (docValue !== undefined) {
        allFields[fieldName] = docValue;
      }
    });

    // Normalize Reference Table fields before returning
    const normalized = normalizeReferenceTableFields(allFields);
    return normalized;
  }, [getFormData, doc, normalizeReferenceTableFields, formFields])

  const handleUpdate = useCallback(async () => {
    try {
      const payload = getUpdatePayload();
      await zodula.doc.update_doc(doctype, id || "", payload);
      reload();
    } catch (error) {
      console.error("Error updating doc:", error);
    }
  }, [doctype, id, getUpdatePayload, reload]);

  // ===== COMPUTED VALUES =====
  const isSingle = doctypeDoc?.is_single === 1;

  // Helper function to deeply compare two objects for dirty checking
  // Optimized with early bailouts for better performance
  const areObjectsEqual = useCallback((obj1: any, obj2: any): boolean => {
    // Fast path: same reference
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return obj1 == obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    // Early bailout: if key counts differ, they might still be equal (undefined vs missing)
    // But if difference is large, likely different
    if (Math.abs(keys1.length - keys2.length) > 10) {
      return false;
    }
    
    // Get all unique keys from both objects
    const allKeys = new Set([...keys1, ...keys2]);
    
    // For very large objects, do a quick sample check first to bail out early
    let keysToCheck = Array.from(allKeys);
    if (allKeys.size > 100) {
      const sampleKeys = keysToCheck.slice(0, 20);
      for (const key of sampleKeys) {
        const val1 = obj1[key];
        const val2 = obj2[key];
        if (val1 === undefined && val2 === undefined) continue;
        if (val1 === undefined && val2 == null) continue;
        if (val1 == null && val2 === undefined) continue;
        if (!valuesAreEqual(val1, val2)) return false;
      }
      // If sample passes, only check remaining keys (skip the sample keys)
      keysToCheck = keysToCheck.slice(20);
    }
    
    for (const key of keysToCheck) {
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      // Fast path: same reference
      if (val1 === val2) continue;
      
      // Handle undefined - treat as equal if both are undefined or missing
      if (val1 === undefined && val2 === undefined) continue;
      if (val1 === undefined && val2 == null) continue;
      if (val1 == null && val2 === undefined) continue;
      
      // Use valuesAreEqual for comparison
      if (!valuesAreEqual(val1, val2)) {
        return false;
      }
    }
    
    return true;
  }, []);

  const handleSave = useCallback(async () => {
    const payload = getUpdatePayload();
    const updatedDoc = await zodula.doc.update_doc(doctype, id || "", payload);

    if (updatedDoc.id !== id && !isSingle) {
      // ID changed - navigate to new URL
      setValues(updatedDoc as Record<string, any>);
      replace(`/desk/${org}/doctypes/${doctype}/form/${updatedDoc.id}`);
    } else {
      // ID unchanged - just reload
      handleReload();
    }
  }, [doctype, id, org, replace, reload, isSingle, getUpdatePayload])

  // Helper function to set nested field values
  const setNestedField = (obj: any, fieldPath: string, value: any) => {
    const parts = fieldPath.split(".");
    let current = obj;

    // Navigate to the parent of the target field
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && !current[part]) {
        current[part] = {};
      }
      if (part) {
        current = current[part];
      }
    }

    // Set the final field value
    const finalField = parts[parts.length - 1];
    if (finalField) {
      current[finalField] = value;
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      // Get the latest form data directly from the store to ensure we have the most recent values
      // This ensures we capture all user input, not just the memoized formData
      const latestFormData = getFormData();
      
      // Normalize Reference Table fields (empty arrays/undefined -> null)
      const normalizedFormData = normalizeReferenceTableFields(latestFormData);
      
      const createdDoc = await zodula.doc.create_doc(
        doctype as Zodula.DoctypeName,
        normalizedFormData
      );
      if (createdDoc) {
        // Clear saved form values after successful creation
        if (org) {
          clearFormValues(doctype, org);
        }
        
        if (cbUrl) {
          let obj = fromDoc || {};
          if (fromField) {
            // Handle nested field paths like "invoice_items.0.account"
            if (fromField.includes(".")) {
              setNestedField(obj, fromField, createdDoc.id);
            } else {
              obj[fromField] = createdDoc.id;
            }
          }
          for(const [key, value] of Object.entries(obj)) {
            if(value === null || value === undefined) {
              delete obj[key];
            }
          }
          handleResetForm();
          replace(cbUrl, {
            state: {
              prefill: obj,
            },
          });
        } else {
          handleResetForm();
          replace(`/desk/${org}/doctypes/${doctype}/form/${createdDoc.id}`);
        }
      }
    } catch (error) {
      console.error("Error creating doc:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    const confirmed = await confirm({
      title: "Delete Document",
      message: `Are you sure you want to delete this ${doctype} document? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (confirmed) {
      setIsLoading(true);
      try {
        await zodula.doc.delete_doc(doctype, id);
        back();
      } catch (error) {
        console.error("Error deleting doc:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // ===== COMPUTED VALUES =====
  const doctypeLabel = doctypeDoc?.label || doctype;
  const isSystemGenerated = doctypeDoc?.is_system_generated === 1;
  useEffect(() => {
    if(!doctypeDoc) return;
    if(fields?.length <= 0) return;
    if(!mode) return;
    if (checked) return;
    checked = true; 
    const navEntry = performance.getEntriesByType("navigation")[0] as any
    let type = "reload"
    if (navEntry?.type === "reload") {
      type = "reload";
    } else {
      type = "navigate";
    }
    if(location.state?.resetForm || type === "reload") {
      handleResetForm();
      replace(pathname, { state: { ...location.state, resetForm: false } });
    }
  }, [location.state, doctype, mode, doctypeDoc, fields, handleResetForm]);

  // Always reset form when in create mode
  const createModeResetRef = useRef<string | null>(null);
  const prefillAppliedRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (mode === "create" && fields && doctypeDoc) {
      // Create a unique key based on doctype and prefill to track if we've reset for this session
      // Only include prefill in the key if it hasn't been applied yet
      const prefillKey = prefillAppliedRef.current ? {} : (prefill || {});
      const resetKey = `${doctype}-${JSON.stringify(prefillKey)}`;
      
      // Only reset if we haven't already reset for this create session
      if (createModeResetRef.current !== resetKey) {
        createModeResetRef.current = resetKey;
        // Mark prefill as not applied yet (will be set to true in handleResetForm)
        if (prefill) {
          prefillAppliedRef.current = false;
        }
        handleResetForm();
      }
    } else if (mode !== "create") {
      // Clear the refs when not in create mode
      createModeResetRef.current = null;
      prefillAppliedRef.current = false;
    }
  }, [mode, doctype, prefill, fields, doctypeDoc, handleResetForm]);

  // Save form values to persistence store in create mode (for changes via setValues/setValue)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (mode === "create" && org && formData) {
      // Debounce saves to avoid excessive localStorage writes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveFormValues(doctype, org, formData);
      }, 300); // Save 300ms after last change
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mode, org, doctype, formData, saveFormValues]);

  // ===== SIDEBAR CONTENT =====
  const sidebarContent = (
    <div className="zd:space-y-6">
      {mode === "create" ? (
        /* New Doc Info */
        <div className="zd:space-y-3">
          <div className="zd:space-y-2">
            <div className="zd:text-xs zd:text-muted-foreground">
            Creating new {doctype} document. Fill in the required fields and save to create
            </div>
          </div>
        </div>
      ) : (
        /* Activity Log */
        <div className="zd:space-y-3">
          <div className="zd:space-y-3">
            <h3 className="zd:text-sm zd:font-medium zd:text-muted-foreground">
              {t("Relatives")}
            </h3>
            <div className="zd:flex zd:flex-col zd:gap-2">
              {connections.map((connection, index) => {
                const filterQuery = encodeURIComponent(
                  JSON.stringify(connection.filters)
                );
                return (
                  <Link
                    className="zd:text-xs zd:opacity-50 zd:hover:opacity-100"
                    to={`/desk/${org}/doctypes/${connection.doctype}/list?filters=${filterQuery}`}
                    key={`${connection.doctype}-${index}`}
                  >
                    {connection.doctype} (
                    {connectionsCount?.results?.find(
                      (result: any) => result.doctype === connection.doctype
                    )?.count || 0}
                    )
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="zd:space-y-3">
            <h3 className="zd:text-sm zd:font-medium zd:text-muted-foreground">
              {t("Metadata")}
            </h3>
            <div className="zd:flex zd:flex-col zd:gap-2">
              <label className="zd:text-xs zd:text-muted-foreground">
                {t("Organization")}
              </label>
              <div className={cn(
                "zd:text-xs",
                !doc?.organization ? "zd:italic" : ""
              )}>
                {doc?.organization || "Unknown"}
              </div>
              <label className="zd:text-xs zd:text-muted-foreground">
                {t("Owner")}
              </label>
              <div className={cn(
                "zd:text-xs",
                !doc?.owner ? "zd:italic" : ""
              )}>
                {doc?.owner || "Unknown"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ===== FORM STATE =====
  // Optimized isDirty check with early bailouts to prevent jiggling
  const isDirty = useMemo(() => {
    if (mode === "create") {
      return Object.values(formData).some(
        (value) => value !== undefined && value !== null && value !== ""
      );
    }
    if (!doc) return false;
    
    // Quick shallow comparison first - if references match, definitely not dirty
    if (formData === doc) return false;
    
    // Early bailout: if key counts differ significantly, likely dirty
    const formKeys = Object.keys(formData);
    const docKeys = Object.keys(doc);
    if (Math.abs(formKeys.length - docKeys.length) > 5) {
      return true; // Likely dirty if key counts differ significantly
    }
    
    // Compare formData with doc using optimized deep comparison
    return !areObjectsEqual(formData, doc);
  }, [formData, doc, mode, areObjectsEqual]);

  useEffect(() => {
    if (!isDirty) {
      handleReload();
    }
  }, []);

  // ===== RENDER COMPONENTS =====
  const PrimaryButtonRender = React.memo(() => {
    if (mode === "create") {
      return (
        <Button
          onClick={handleCreate}
          disabled={isLoading || !isDirty}
          variant="solid"
        >
          <Save className="zd:w-4 zd:h-4 zd:mr-1" />
          {t("Create")}
        </Button>
      );
    }

    if(isSingle) {
      return (
        <Button onClick={handleSave} className="zd:h-8" disabled={isDirty}>
          <SaveIcon />
          {t("Save")}{" "}
        </Button>
      );
    }

    if (doctypeDoc?.is_submittable === 1 && doc?.doc_status === 0 && !isDirty) {
      return (
        <Button onClick={handleSubmit} className="zd:h-8" disabled={isDirty}>
          {t("Submit")}
          <ArrowRight />
        </Button>
      );
    } else if (doctypeDoc?.is_submittable === 1 && doc?.doc_status === 1) {
      return (
        <Button onClick={handleUpdate} className="zd:h-8" disabled={!isDirty}>
          <SaveIcon />
          {t("Update")}
        </Button>
      );
    } else if (doc?.doc_status == 0) {
      return (
        <Button onClick={handleSave} className="zd:h-8" disabled={!isDirty}>
          <SaveIcon />
          {t("Save")}{" "}
        </Button>
      );
    }
    
    return null;
  });

  // ===== LOADING & ERROR STATES =====
  if (mode === "edit" && loading) {
    return (
      <NavbarLayout>
        <div className="zd:flex zd:items-center zd:justify-center zd:h-64">
          <div className="zd:text-muted-foreground">Loading...</div>
        </div>
      </NavbarLayout>
    );
  }

  if (mode === "edit" && error && !isSingle) {
    return (
      <NavbarLayout>
        <ErrorView message={error} status={500} />
      </NavbarLayout>
    );
  }

  if (mode === "edit" && !doc && !isSingle) {
    return (
      <NavbarLayout>
        <ErrorView message="Doc not found" status={404} />
      </NavbarLayout>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <NavbarLayout>
      <SidebarLayout
        title={
          <div className="zd:flex zd:gap-2 zd:items-center">
            {mode === "create"
              ? `${t("New")} ${t(doctypeLabel)}`
              : isSingle
                ? doctypeLabel
                : doc?.id || "New Doc"}
            <span className="zd:flex zd:gap-2 zd:items-center no-print">
              {doctypeDoc?.is_submittable === 1 && mode === "edit" && (() => {
                const badgeConfig = badgeConfigs.current["doc_status"];
                if (badgeConfig && doc) {
                  const valueOrObj = badgeConfig.getValue ? badgeConfig.getValue(doc) : doc.doc_status;
                  
                  // If getValue returns null, fall back to default DocStatusBadge
                  if (valueOrObj === null) {
                    return <DocStatusBadge status={doc?.doc_status || 0} />;
                  }
                  
                  // Handle both string values and objects with status/variant
                  const Badge = require("../components/ui/badge").Badge;
                  const displayValue = typeof valueOrObj === 'object' && valueOrObj !== null ? valueOrObj.status : valueOrObj;
                  const variant = typeof valueOrObj === 'object' && valueOrObj !== null ? valueOrObj.variant : badgeConfig.variant;
                  return (
                    <Badge variant={variant as any} size={badgeConfig.size as any}>
                      {displayValue || ""}
                    </Badge>
                  );
                }
                // Default: show doc_status badge
                return <DocStatusBadge status={doc?.doc_status || 0} />;
              })()}
            </span>
          </div>
        }
        sidebarContent={sidebarContent}
        actionSection={
          doctypeDoc?.is_system_generated === 1 ? (
            <div>
              <span className="zd:text-sm zd:text-muted-foreground">
                This is a system generated doctype. You cannot{" "}
                {mode === "create" ? "create" : "edit"} this doctype.
              </span>
            </div>
          ) : (
            <div className="zd:flex zd:items-center zd:gap-2">
              {mode === "edit" && (
                <>
                  <Button variant="outline" href={`/desk/${org}/print?doctype=${doctype}&ids=["${id}"]`}>
                    <Printer className="zd:w-4 zd:h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <MoreHorizontal className="zd:w-4 zd:h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isSingle && (
                        <DropdownMenuItem onClick={handleDuplicate}>
                          <Copy className="zd:w-4 zd:h-4 zd:mr-1" />
                          <span className="zd:flex-1">{t("Duplicate")}</span>
                          <kbd className="zd:ml-2 zd:px-1 zd:py-0.5 zd:text-xs zd:bg-muted zd:rounded">
                            Ctrl + D
                          </kbd>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={handleReload}>
                        <RotateCcw className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Reload")}</span>
                        <kbd className="zd:ml-2 zd:px-1 zd:py-0.5 zd:text-xs zd:bg-muted zd:rounded">
                          Ctrl + R
                        </kbd>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleCancel}
                        className={cn(
                          "zd:text-red-600 zd:focus:text-red-600",
                          doc?.doc_status === 1 ? "" : "zd:hidden"
                        )}
                      >
                        <Copy className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Cancel")}</span>
                        <kbd className="zd:ml-2 zd:px-1 zd:py-0.5 zd:text-xs zd:bg-muted zd:rounded">
                          Ctrl + Shift + C
                        </kbd>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className={cn(
                          "zd:text-red-600 zd:focus:text-red-600",
                          doc?.doc_status !== 1 ? "" : "zd:hidden"
                        )}
                      >
                        <Trash2 className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Delete")}</span>
                        <kbd className="zd:ml-2 zd:px-1 zd:py-0.5 zd:text-xs zd:bg-muted zd:rounded">
                          Ctrl + Delete
                        </kbd>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              {/* Custom form actions from useEnhanceDoctype */}
              <FormActions doctype={doctype} doc={doc} />
              {/* Secondary buttons from UI scripts */}
              {secondaryButtons.current.map((button, index) => {
                // If button has items, render as dropdown
                if (button.items && button.items.length > 0) {
                  const Icon = button.icon;
                  return (
                    <DropdownMenu key={index}>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant={button.variant || "outline"} 
                          className="zd:h-8"
                          disabled={button.disabled}
                        >
                          {Icon && <Icon className="zd:w-4 zd:h-4 zd:mr-1" />}
                          {button.label}
                          <ChevronDown className="zd:w-4 zd:h-4 zd:ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {button.items.map((item, itemIndex) => {
                          const ItemIcon = item.icon;
                          return (
                            <DropdownMenuItem
                              key={itemIndex}
                              onClick={item.onClick}
                              disabled={item.disabled}
                            >
                              {ItemIcon && <ItemIcon className="zd:w-4 zd:h-4 zd:mr-1" />}
                              {item.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }
                // Regular button
                const Icon = button.icon;
                return (
                  <Button
                    key={index}
                    variant={button.variant || "outline"}
                    onClick={button.onClick}
                    disabled={button.disabled}
                    className="zd:h-8"
                  >
                    {Icon && <Icon className="zd:w-4 zd:h-4 zd:mr-1" />}
                    {button.label}
                  </Button>
                );
              })}
              <PrimaryButtonRender />
            </div>
          )
        }
      >
        {/* Form Content */}
        <div className="zd:flex zd:flex-col zd:gap-8 zd:border zd:rounded zd:p-4">
          <Form
            translate
            debug={roles?.includes("System Admin") || false}
            docId={id || ""}
            readonly={doctypeDoc?.is_system_generated === 1}
            fields={formFields}
            values={formData}
            onChange={handleFieldChange}
            doctype={doctypeDoc as unknown as Zodula.DoctypeConfig}
            tabs={doctypeDoc?.tabs ? JSON.parse(doctypeDoc.tabs) : []}
            childExtendFieldPropertyOverrides={childExtendFieldPropertyOverrides}
            childTableFieldPropertyOverrides={childTableFieldPropertyOverrides}
            parentContext={(parentFormContext as any) || undefined}
            onNestedFieldChange={handleNestedFieldChange}
          />
          <div className="">
            {!!doc?.id && <AuditTrail doctype={doctype} docId={id!} />}
            {/* Create at and Updated at */}
            <div className="zd:flex zd:gap-2 zd:items-center zd:mt-2">
              <span className="zd:text-sm zd:text-muted-foreground">
                {doc?.created_by ? (
                  <UserLink
                    userId={doc.created_by}
                    name={getUserName(doc.created_by) || doc.created_by}
                  />
                ) : (
                  "Unknown"
                )}{" "}
                {t("Created At")}{" "}
                {zodula.utils.formatTimeAgo(doc?.created_at || "")}
              </span>
              {/* center dot */}
              <span className="zd:text-sm zd:text-muted-foreground">•</span>
              <span className="zd:text-sm zd:text-muted-foreground">
                {doc?.updated_by ? (
                  <span className="zd:text-sm zd:text-muted-foreground">
                    {getUserName(doc.updated_by) || doc.updated_by}
                    </span>
                ) : (
                  "Unknown"
                )}{" "}
                {t("Updated At")}{" "}
                {zodula.utils.formatTimeAgo(doc?.updated_at || "")}
              </span>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </NavbarLayout>
  );
}
