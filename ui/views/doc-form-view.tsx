import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useRouter } from "@/zodula/ui/components/router";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { useForm } from "@/zodula/ui/hooks/use-form";
import { DeskNavbarLayout } from "@/zodula/ui/layout/desk-navbar-layout";
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
  Link2,
  Building2,
  FileText,
} from "lucide-react";
import { ClientFieldHelper } from "@/zodula/client/field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/zodula/ui/components/ui/dropdown-menu";
import { zodula } from "@/zodula/client";
import { alert, confirm, popup } from "@/zodula/ui/components/ui/popit";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { useAction } from "../hooks/use-action";
import { DocStatusBadge } from "../components/custom/doc-status-badge";
import { useAuth } from "../hooks/use-auth";
import { FormActions } from "@/zodula/ui/components/form/form-actions";
import { AuditTrail } from "@/zodula/ui/components/custom/audit-trail";
import { Attachments } from "@/zodula/ui/components/custom/attachments";
import { useTranslation } from "../hooks/use-translation";
import { useZui } from "@/zodula/ui";
import { useDocStore } from "../hooks/use-doc-store";
import { MultiSelectDoctypeDialog } from "../components/dialogs/multi-select-doctype-dialog";
import { useUserName } from "../hooks/use-user-name";
import ErrorView from "./error-view";
import { useParams } from "react-router";
import { toast } from "../components/ui/toast";
import { useCreateFormPersistenceStore } from "../hooks/use-create-form-persistence";
import { FormControl } from "../components/ui/form-control";
import { DynamicIcon } from "../components/ui/dynamic-icon";

/** In-memory cache: formId -> formData. Restores form when re-initializing (e.g. navigate back). */
const formDataCache: Record<string, Record<string, any> | undefined> = {};

function upsertTableRow(
  rows: { idx: number; fields: any[] }[],
  index: number,
  fieldName: string,
  property: string,
  value: any
) {
  const rowIndex = rows.findIndex(r => r.idx === index);

  if (rowIndex === -1) {
    return [
      ...rows,
      {
        idx: index,
        fields: [{ name: fieldName, [property]: value }]
      }
    ];
  }

  return rows.map(row => {
    if (row.idx !== index) return row;

    const fieldExists = row.fields.some(f => f.name === fieldName);

    return {
      ...row,
      fields: fieldExists
        ? row.fields.map(f =>
          f.name === fieldName ? { ...f, [property]: value } : f
        )
        : [...row.fields, { name: fieldName, [property]: value }]
    };
  });
}

function removeAndReorderRows<T extends { idx: number }>(
  rows: T[],
  indexToRemove: number
): T[] {
  return rows
    .filter((r) => r.idx !== indexToRemove)
    .map((row, i) => ({ ...row, idx: i }));
}

function referenceTableNamesFromFormFields(formFieldsOverride: Record<string, any>): Set<string> {
  const s = new Set<string>();
  for (const f of Object.values(formFieldsOverride) as any[]) {
    if (f?.type === "Reference Table" && f?.name) s.add(f.name);
  }
  return s;
}

/**
 * Ensures each child-table row has `idx` (array position if missing). Call on every form state write.
 * Uses Reference Table field names when known; otherwise rows with `parentfield === fieldName`.
 */
function ensureChildTableIdxOnDoc(
  data: Record<string, any>,
  referenceTableKeys?: Set<string>
): Record<string, any> {
  const out = { ...data };
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (!Array.isArray(val) || val.length === 0) continue;
    const first = val[0];
    if (!first || typeof first !== "object" || Array.isArray(first)) continue;

    const byParentField = first.parentfield === key;
    const byFormDef = referenceTableKeys != null && referenceTableKeys.has(key);
    if (!byParentField && !byFormDef) continue;

    out[key] = val.map((row: any, i: number) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      if (row.idx === -1) return row;
      const hasIdx = row.idx !== undefined && row.idx !== null && row.idx !== "";
      return { ...row, idx: hasIdx ? row.idx : i };
    });
  }
  return out;
}

/** Get value from doc by field path: "field" or "table.0.child" or "extend.child". */
function getNestedFormValue(data: Record<string, any> | null, field: string): any {
  if (!data || !field) return undefined;
  if (!field.includes(".")) return data[field];
  const p = field.split(".");
  if (p.length === 3) {
    const table = p[0], indexStr = p[1], child = p[2];
    if (table == null || indexStr == null || child == null) return undefined;
    const index = parseInt(indexStr, 10);
    if (!isNaN(index) && Array.isArray(data[table])) return data[table][index]?.[child];
  }
  if (p.length === 2) {
    const parent = p[0], child = p[1];
    if (parent == null || child == null) return undefined;
    const parentVal = data[parent];
    return parentVal && typeof parentVal === "object" ? parentVal[child] : undefined;
  }
  return data[field];
}

function isEmptyValue(value: any): boolean {
  if (value == null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateRequiredFields(
  data: Record<string, any>,
  formFields: Record<string, any>,
  referenceTableFields: Record<string, { name: string; label?: string | null; required?: number }[]>,
  extendFields: Record<string, { name: string; label?: string | null; required?: number }[]>
): { valid: true } | { valid: false; message: string } {
  for (const fieldName of Object.keys(formFields)) {
    const f = formFields[fieldName];
    if (ClientFieldHelper.isStandardField(fieldName)) continue;
    if (f?.type === "Reference Table" || f?.type === "Extend") continue;
    if (f?.required !== 1) continue;
    const val = data[fieldName];
    if (isEmptyValue(val)) {
      const label = f?.label || fieldName;
      return { valid: false, message: `Required field "${label}" is empty.` };
    }
  }
  for (const [tableName, childFields] of Object.entries(referenceTableFields)) {
    const rows = Array.isArray(data[tableName]) ? data[tableName] : [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] && typeof rows[i] === "object" ? rows[i] : {};
      for (const cf of childFields) {
        if (ClientFieldHelper.isStandardField(cf.name)) continue;
        if (cf?.required !== 1) continue;
        const val = row[cf.name];
        if (isEmptyValue(val)) {
          const label = cf?.label || cf.name;
          return { valid: false, message: `Required field "${label}" is empty (row ${i + 1}).` };
        }
      }
    }
  }
  for (const [extendName, childFields] of Object.entries(extendFields)) {
    const extendObj = data[extendName] && typeof data[extendName] === "object" ? data[extendName] : {};
    for (const cf of childFields) {
      if (cf?.required !== 1) continue;
      const val = extendObj[cf.name];
      if (isEmptyValue(val)) {
        const label = cf?.label || cf.name;
        return { valid: false, message: `Required field "${label}" is empty.` };
      }
    }
  }
  return { valid: true };
}

const UserLink = ({ userId, name }: { userId: string; name: string }) => {
  return (
    <Link
      to={`/desk/doctypes/User/form/${userId}`}
      className="zd:hover:text-primary zd:transition-colors zd:text-sm"
    >
      {name}
    </Link>
  );
};

interface DocFormViewProps {
  doctype: Zodula.DoctypeName;
  prefill?: Record<string, any>;
  id?: string;
  mode?: "create" | "edit";
  cbUrl?: string;
  fromField?: string;
  resetForm?: boolean;
  formId: string;
}

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
  cbUrl,
  prefill,
  fromField,
  mode = "edit",
  formId,
}: DocFormViewProps) {
  // ===== ROUTER & STATE =====
  const { push, replace, pathname, location, back } = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter()
  // ===== AUTH & TRANSLATION =====
  const { roles, user } = useAuth();
  const { t } = useTranslation();
  // ===== FORM PERSISTENCE =====
  const { saveFormValues, getFormValues, clearFormValues } = useCreateFormPersistenceStore();

  // ===== DOCTYPE & DOC DATA =====
  const { doc: doctypeDoc } = useDocAll({
    doctype: "Doctype",
    id: doctype
  });

  const effectiveDocId = id?.startsWith("temp-") ? "" : id || "";
  const [doc, setDoc] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFormDoc = useCallback(async (dt: Zodula.DoctypeName, docId: string) => {
    if (!docId) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await zodula.doc.get_doc(dt, docId);
      setDoc(result as Record<string, any>);
      return result as Record<string, any>;
    } catch (e: any) {
      const errMsg = e?.message || "Failed to load doc";
      setError(errMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!effectiveDocId || !doctype) return null;
    const result = await fetchFormDoc(doctype as Zodula.DoctypeName, effectiveDocId);
    return result;
  }, [doctype, effectiveDocId, fetchFormDoc]);

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
  const badgeConfigs = useRef<Record<string, { variant?: string | null; size?: string | null; getValue?: (doc: any, t?: (key: string) => string) => any }>>({});

  // ===== SECONDARY BUTTONS =====
  const zui = useZui();


  // ===== FIELDS =====
  // Fetch all fields with persistent caching, then filter client-side
  const { docs: allFields, reload: reloadFields } = useDocListAll({
    doctype: "Field"
  });

  // Fetch Doctype Permission for this doctype and user's roles (for field-level readonly/hidden)
  const userRoles = useMemo(() => [...(roles || []), "Authenticated"].filter(Boolean), [roles]);
  const { docs: doctypePermissions } = useDocList({
    doctype: "Doctype Permission",
    limit: 200,
    sort: "idx",
    order: "asc",
    filters: doctype && userRoles.length > 0
      ? [["doctype", "=", doctype], ["role", "IN", userRoles] as any]
      : [],
  }, [doctype, userRoles.join(",")]);

  // Filter fields by doctype and sort by idx
  const fields = useMemo(() => {
    return allFields
      .filter((field) => field.doctype === doctype && !ClientFieldHelper.isStandardField(field.name))
      .sort((a, b) => (a.idx || 0) - (b.idx || 0));
  }, [allFields, doctype]);

  const [formFields, setFormFields] = useState<Record<string, any>>({});
  const [referenceTableFields, setReferenceTableFields] = useState<Record<string, Zodula.SelectDoctype<"Field">[]>>({});
  const [referenceTableIndexFields, setReferenceTableIndexFields] = useState<Record<string, { idx: number; fields: Zodula.SelectDoctype<"Field">[] }[]>>({});
  const [extendFields, setExtendFields] = useState<Record<string, Zodula.SelectDoctype<"Field">[]>>({});

  const [formData, setFormData] = useState<Record<string, any>>(() =>
    ensureChildTableIdxOnDoc(formDataCache[formId] ?? {}, undefined)
  );

  const commitFormData = useCallback(
    (next: Record<string, any>, fieldsOverride?: Record<string, any>) => {
      const keys = referenceTableNamesFromFormFields(fieldsOverride ?? formFields);
      const n = ensureChildTableIdxOnDoc(next, keys.size > 0 ? keys : undefined);
      formDataCache[formId] = n;
      setFormData(n);
      return n;
    },
    [formId, formFields]
  );

  // Refs to keep handleFieldChange stable and avoid running scripts on every keystroke
  const formDataRef = useRef<Record<string, any>>(formData);
  const scriptDebounceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fieldPath: string }>({ timer: null, fieldPath: "" });
  const buildFormContextRef = useRef<(overrides?: any) => any>(() => ({}));
  const appliedPrefillRef = useRef(false);
  const afterInitializeRef = useRef<{ formDataResult: Record<string, any>; fields: Record<string, any> } | null>(null);
  const afterInitializeRanRef = useRef(false);
  formDataRef.current = formData;

  // ===== SCRIPT & FETCH HELPERS =====
  const { fetchDoc, getDoc } = useDocStore();

  // Centralized field change handler: fetch_from + scripts + form store update
  const handleFieldChange = useCallback(
    async (fieldPath: keyof typeof formFields, value: any, options?: {
      noScripts?: boolean;
      noFetchFrom?: boolean;
    }) => {
      if (!formFields || Object.keys(formFields).length === 0) {
        return;
      }

      const data = formDataCache[formId] ?? {};
      const oldValue = data[fieldPath as string];
      const parts = fieldPath.split(".");
      const parentFieldName = parts[0] || "";
      const index = parseInt(parts[1] ?? "0", 10);
      const childFieldName = parts[2] as string;
      const isTable = parts?.length === 3 && !isNaN(parseInt(parts[1] ?? "NaN", 10));
      const isExtend = parts?.length === 2 && isNaN(parseInt(parts[1] ?? "NaN", 10));

      if (isTable) {
        const childFieldConfig = referenceTableFields[parentFieldName]?.find((field) => field.name === childFieldName);
        const fieldName = parentFieldName;
        // Build doc with this change applied so scripts see the new value
        let tableRows = Array.isArray(data[parentFieldName]) ? [...data[parentFieldName]] : [];
        if (!tableRows[index]) tableRows[index] = {} as any;
        tableRows[index] = { ...tableRows[index], [childFieldName]: value };
        let updatedDoc = { ...data, [parentFieldName]: tableRows };
        let newFields = { ...data };
        if (!newFields[fieldName]) {
          newFields = { ...newFields, [fieldName]: [] };
        }
        if (!newFields?.[fieldName]?.[index]) {
          if (index === newFields[fieldName].length) {
            newFields[fieldName].push({ [childFieldName]: value, idx: index });
          }
        }
        newFields[fieldName][index][childFieldName] = value;
        newFields[fieldName] = removeAndReorderRows(newFields[fieldName], -1);
        commitFormData(newFields);

        if (childFieldName === "idx") {
          setReferenceTableIndexFields(prev => {
            const newFields = { ...prev };
            newFields[fieldName] = removeAndReorderRows(newFields[fieldName] || [], index);
            return newFields;
          });
          if (value === -1) {
            const newRows = (updatedDoc[parentFieldName] || []).filter((item: any) => item.idx !== -1);
            updatedDoc = { ...updatedDoc, [parentFieldName]: newRows };
          }
        }

        const rowDoc = updatedDoc[parentFieldName][index];
        const childDoctype = formFields[parentFieldName]?.reference;
        const ctx = buildFormContextRef.current;
        // trigger reference table field
        if (!options?.noScripts) {
          await zui._.executeFormScripts(doctype as any, `${parentFieldName}.${childFieldName}`, ctx({
            doc: updatedDoc,
            get_value: (field: string) => getNestedFormValue(updatedDoc, field),
            idx: index,
          }) as any);
          await zui._.executeFormScripts(childDoctype as any, childFieldName, ctx({
            doctype: childDoctype,
            doc: rowDoc,
            id: rowDoc?.id,
            idx: index,
            get_value: (field: string) => rowDoc?.[field],
            set_value: (field: string, value: any) => handleFieldChange(`${parentFieldName}.${index}.${field}`, value),
            set_df_property: (fieldPath: string, property: string, value: any) => handleSetDfProperty(`${parentFieldName}.${index}.${fieldPath}`, property, value),
            get_df_property: (fieldPath: string, property: string) => handleGetDfProperty(`${parentFieldName}.${index}.${fieldPath}`, property),
          }) as any);
        }
      } else if (isExtend) {
        const next = {
          ...data,
          [parentFieldName]: { ...(data[parentFieldName] || {}), [childFieldName]: value },
        };
        commitFormData(next);
      } else {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof File) {
          const next = { ...data, [fieldPath]: value };
          commitFormData(next);
          const doc = formDataCache[formId] ?? formDataRef.current;
          const ctx = buildFormContextRef.current({
            doc,
            get_value: (field: string) => getNestedFormValue(doc, field),
          });
          if (!options?.noScripts) {
            await zui._.executeFormScripts(doctype as any, fieldPath, ctx).catch((err: unknown) => console.error("form script error", err));
          }
        } else if (Array.isArray(value)) {
          // reorder the reference table index fields
          const oldIds = oldValue?.map((item: any) => item.id) || [];
          const newIds = value?.map((item: any) => item.id) || [];
          const changeIdx = [] as { from: number, to: number }[];
          for (let i = 0; i < oldIds.length; i++) {
            const oldId = oldIds[i];
            const newId = newIds[i];
            if (oldId !== newId) {
              changeIdx.push({ from: i, to: newIds.indexOf(oldId) });
            }
          }

          setReferenceTableIndexFields(prev => {
            const newFields = { ...prev };
            const parentRecord = prev[fieldPath] || [];
            let newRecord = parentRecord?.reduce((acc, curr) => {
              let record = { ...curr };
              record.idx = changeIdx.find((change) => change.from === record.idx)?.to || record.idx;
              acc[record.idx] = record;
              return acc;
            }, [] as { idx: number, fields: Zodula.SelectDoctype<"Field">[] }[])
            newFields[fieldPath] = newRecord;
            return newFields;
          })

          const indexToRemove = changeIdx.filter((change) => change.to === -1).map((change) => change.from);
          let newFields = { ...data };
          let newTableRows = newFields[fieldPath]?.filter((record: { idx: number }) => !indexToRemove.includes(record.idx)) || [];
          for (let i = 0; i < newTableRows.length; i++) {
            const oldIdx = newTableRows[i].idx;
            const newIdx = changeIdx.find((change) => change.from === oldIdx)?.to;
            if (newIdx !== newTableRows[i].idx) {
              newTableRows[i].idx = newIdx;
            }
          }
          newFields[fieldPath] = newTableRows;
          commitFormData(newFields);
        }
      }


      // handle fetch_from
      if (!options?.noFetchFrom) {
        if (isTable) {
          const childFieldName = fieldPath.split(".")[2];
          const childFieldConfig = referenceTableFields[parentFieldName]?.find((field) => field.name === childFieldName);

          const tableFields = referenceTableFields[parentFieldName] || [];
          for (const tableField of tableFields) {
            if (tableField.fetch_from && tableField.fetch_from.startsWith(childFieldName + ".")) {
              const fetchPath = tableField.fetch_from;
              const [fetchFromFieldName, fetchFromFieldPath] = fetchPath.split(".") || [];
              if (value && fetchFromFieldName && fetchFromFieldPath) {
                const fetchDocument = await zodula.doc.get_doc(childFieldConfig?.reference as any, value, { fields: [fetchFromFieldPath] });
                await handleFieldChange(`${parentFieldName}.${index}.${tableField.name}`, fetchDocument[fetchFromFieldPath], options);
              } else {
                await handleFieldChange(`${parentFieldName}.${index}.${tableField.name}`, null, options);
              }
            }
          }
        } else if (isExtend) {
          console.warn("handleFieldChange: not implemented for extended fields");
        } else {
          const fieldName = fieldPath.split(".")[0] || "";
          const fieldConfig = formFields[fieldName];
          for (const [targetFieldName, targetFieldConfig] of Object.entries(formFields)) {
            if (targetFieldConfig?.fetch_from && targetFieldConfig.fetch_from.startsWith(fieldName + ".")) {
              const fetchPath = targetFieldConfig.fetch_from;
              const [fetchFromFieldName, fetchFromFieldPath] = fetchPath.split(".");

              if (value) {
                const fetchDocument = await zodula.doc.get_doc(fieldConfig?.reference as any, value, { fields: [fetchFromFieldPath] });
                await handleFieldChange(targetFieldName as keyof typeof formFields, fetchDocument[fetchFromFieldPath], options);
              } else {
                await handleFieldChange(targetFieldName as keyof typeof formFields, "", options);
              }
            }
          }
        }
      }
    },
    [
      formFields,
      formId,
      referenceTableFields,
      fetchDoc,
      getDoc,
      doctype,
      zui,
      saveFormValues,
      commitFormData,
    ]
  );

  async function handleSetDfProperty(fieldPath: string, property: string, value: any) {
    if (fieldPath.includes(".")) {
      const parts = fieldPath.split(".");
      const parentFieldName = parts[0] || "";
      const index = parseInt(parts[1] || "0", 10);
      const childFieldName = parts[2] as string;
      const isTable = parts?.length > 2
      if (isTable) {
        const isDefault = index === -1;
        if (isDefault) {
          setReferenceTableFields(prev => {
            const newFields = { ...prev };
            const parentFields = prev[parentFieldName] || [];
            const fieldIndex = parentFields.findIndex((field) => field.name === childFieldName);
            let newParentField = [...parentFields];
            if (fieldIndex !== -1) {
              newParentField[fieldIndex] = { ...newParentField[fieldIndex], [property]: value } as Zodula.SelectDoctype<"Field">;
            }
            newFields[parentFieldName] = newParentField;
            return newFields;
          })
        } else {
          setReferenceTableIndexFields(prev => ({
            ...prev,
            [parentFieldName]: upsertTableRow(
              prev[parentFieldName] || [],
              index,
              childFieldName,
              property,
              value
            )
          }));
        }
      } else {
        console.warn("set_df_property: not implemented for extended fields");
      }
    } else {
      setFormFields((prev) => ({ ...prev, [fieldPath]: { ...prev[fieldPath], [property]: value } }));
    }
  }

  async function handleGetDfProperty(fieldPath: string, property: string) {
    if (fieldPath.includes(".")) {
      const parts = fieldPath.split(".");
      const parentFieldName = parts[0] || "";
      const index = parseInt(parts[1] || "0", 10);
      const childFieldName = parts[2] as string;
      const isTable = parts?.length > 2
      if (isTable) {
        const isDefault = index === -1;
        if (isDefault) {
          return referenceTableFields[parentFieldName]?.find((field) => field.name === childFieldName)?.[property as keyof Zodula.SelectDoctype<"Field">];
        } else {
          return referenceTableIndexFields[parentFieldName]?.find((record) => record.idx === index && record.fields.find((field) => field.name === childFieldName) !== undefined)?.fields.find((field) => field.name === childFieldName)?.[property as keyof Zodula.SelectDoctype<"Field">];
        }
      } else {
        console.warn("get_df_property: not implemented for extended fields");
        return undefined;
      }
    } else {
      return formFields[fieldPath]?.[property];
    }
  }

  // ===== EVENT HANDLERS =====
  const handleReload = async () => {
    const d = await reload();
    if (d) {
      // Update base doc + form data cache
      setDoc(d);
      setIsUserHasType(false);
      commitFormData(d);

      // Re‑apply field permissions so submitted docs become readonly as needed
      const computed = applyFieldPermissions(fields, d);
      if (computed) {
        setFormFields(computed.formFields);
        setReferenceTableFields(computed.referenceTableFields);
        setExtendFields(computed.extendFields);
      }
    }
  };

  const clearTable = useCallback((tableFieldName: string) => {
    const prev = formDataCache[formId] ?? {};
    commitFormData({ ...prev, [tableFieldName]: [] });
    setReferenceTableIndexFields((p) => ({ ...p, [tableFieldName]: [] }));
  }, [formId, commitFormData]);

  const buildFormContext = useCallback((overrides: {
    doctype?: any;
    doc?: any;
    get_value?: (field: string) => any;
    idx?: number;
    id?: string;
    set_value?: (field: string, value: any) => void;
    set_df_property?: (fieldPath: string, property: string, value: any) => void;
    get_df_property?: (fieldPath: string, property: string) => any;
    clear_table?: (tableFieldName: string) => void;
  } = {}) => ({
    doctype: overrides.doctype ?? (doctype as any),
    doc: overrides.doc ?? (formDataRef.current as any),
    id: overrides.id ?? id ?? "",
    idx: overrides.idx ?? -1,
    get_value: overrides.get_value ?? ((field: string) => getNestedFormValue(formDataRef.current, field)),
    set_value: overrides.set_value ?? ((field: string, value: any) => handleFieldChange(field, value)),
    set_df_property: overrides.set_df_property ?? handleSetDfProperty,
    get_df_property: overrides.get_df_property ?? handleGetDfProperty,
    reload: handleReload,
    clear_table: overrides.clear_table ?? clearTable,
  }), [doctype, id, handleFieldChange, handleSetDfProperty, handleGetDfProperty, handleReload, clearTable]);
  buildFormContextRef.current = buildFormContext;

  const secondaryButtons = useMemo(() => {
    const allDoctypeButtons = zui?._?.state?.ui_form_secondary_buttons?.filter((b) => b.doctype === doctype) || [];
    return allDoctypeButtons.filter((b) => !b.options?.condition || b.options.condition(buildFormContext() as any));
  }, [doctype, buildFormContext, formData, zui]);

  const fieldButtonsByField = useMemo(() => {
    const raw = zui?._?.state?.ui_form_field_buttons ?? [];
    const list = raw.filter((b) => b.doctype === doctype);
    const ctx = buildFormContext();
    const byField: Record<string, { label: string; run: () => void | Promise<void> }[]> = {};
    for (const b of list) {
      if (b.options?.condition && !b.options.condition(ctx as any)) continue;
      const fieldName = b.fieldName;
      if (!byField[fieldName]) byField[fieldName] = [];
      byField[fieldName].push({
        label: b.label,
        run: () => b.onClick(ctx as any),
      });
    }
    return byField;
  }, [doctype, zui, buildFormContext, formData]);


  async function runInitializeForm(
    docOverride: Record<string, any> | null | undefined,
    formFieldsOverride: Record<string, any>
  ): Promise<Record<string, any>> {
    const hasPrefill = prefill && typeof prefill === "object" && Object.keys(prefill).length > 0;
    let cached = formDataCache[formId];
    let cacheHasContent = cached != null && Object.keys(cached).length > 0;
    // Only reset to {} before prefill when there is no draft yet. Clearing always (old behavior)
    // wiped the form when returning from a child create (cbUrl): only fromField was re-applied.
    if (hasPrefill && !cacheHasContent) {
      commitFormData({}, formFieldsOverride);
      cached = formDataCache[formId];
      cacheHasContent = false;
    }
    let nextFormData: Record<string, any> = {};

    async function applyPrefillToCache() {
      for (const [fieldName, fieldValue] of Object.entries(prefill as Record<string, any>)) {
        await handleFieldChange(fieldName as keyof typeof formFields, fieldValue, { noScripts: true, noFetchFrom: true });
      }
      const latest = formDataCache[formId];
      if (latest && typeof latest === "object") {
        nextFormData = latest;
      }
    }

    if (mode === "create" && hasPrefill) {
      await applyPrefillToCache();
    } else if (mode === "edit" && id && docOverride?.id === id) {
      // Prefer fetched doc over formDataCache so child rows keep server fields (e.g. idx)
      nextFormData = { ...(docOverride as Record<string, any>) };
    } else if (formId in formDataCache && (mode === "create" || cacheHasContent)) {
      nextFormData = cached ?? {};
    } else if (mode === "edit" && id) {
      const docToUse = docOverride ?? doc;
      if (docToUse?.id === id) {
        nextFormData = docToUse as Record<string, any>;
      } else {
        const fetched = await zodula.doc.get_doc(doctype as any, id as any);
        nextFormData = fetched as Record<string, any>;
      }
    } else if (mode === "create") {
      nextFormData = {};
    } else {
      nextFormData = formDataCache[formId] ?? {};
    }

    if (hasPrefill) {
      // Preserve navigation context (e.g., cbUrl, fromField) while clearing prefill
      const currentState =
        location?.state && typeof location.state === "object"
          ? (location.state as Record<string, any>)
          : {};
      const { prefill: _ignoredPrefill, ...rest } = currentState;
      replace(pathname, { state: rest });
    }

    // get default value for every fields (only when current value is missing; do not overwrite loaded doc)
    for (const f of Object.values(formFieldsOverride) as any[]) {
      if (f?.type === "Reference Table" || f?.type === "Extend") continue;
      const current = nextFormData[f.name];
      if (current !== undefined && current !== null) continue;
      const def = zodula.utils.getDefaultValue(f);
      if (def !== undefined) nextFormData[f.name] = def;
    }

    if (mode === "create" && formFieldsOverride) {
      nextFormData = { ...nextFormData };
      for (const f of Object.values(formFieldsOverride) as any[]) {
        if (f?.type === "Reference Table" || f?.type === "Extend") continue;
        if (nextFormData[f.name] === undefined || nextFormData[f.name] === null) {
          const def = zodula.utils.getDefaultValue(f);
          if (def !== undefined) nextFormData[f.name] = def;
        }
      }
    }
    return commitFormData(nextFormData, formFieldsOverride);
  }

  async function runAfterInitializeForm(
    formDataForScripts: Record<string, any>,
    formFieldsForScripts: Record<string, any>
  ) {
    formDataRef.current = formDataForScripts;
    badgeConfigs.current = {};
    const ctx = {
      ...buildFormContext(),
      set_badge_config: (fieldKey: string, config: any) => {
        badgeConfigs.current[fieldKey] = config;
      },
    } as any;
    await zui._.executeFormScripts(doctype as any, "on_render", ctx);
    for (const [childTableFieldName, field] of Object.entries(formFieldsForScripts)) {
      if (field.type !== "Reference Table") continue;
      for (let i = 0; i < formDataForScripts[childTableFieldName]?.length; i++) {
        const row = formDataForScripts[childTableFieldName][i];
        await zui._.executeFormScripts(field.reference as any, "on_render", {
          doctype: field.reference as any,
          doc: row,
          id: row.id,
          idx: i,
          get_value: (fieldName: any) => row[fieldName] as any,
          set_value: (fieldName: any, value: any) => handleFieldChange(`${childTableFieldName}.${i}.${fieldName}`, value),
          set_df_property: (fieldPath: string, property: string, value: any) => handleSetDfProperty(`${childTableFieldName}.${i}.${fieldPath}`, property, value),
          get_df_property: (fieldPath: string, property: string) => handleGetDfProperty(`${childTableFieldName}.${i}.${fieldPath}`, property),
        });
      }
    }
  }

  // Init: 1) set formFields from fields; 2) apply perm-level readonly/hidden via ClientFieldHelper.checkPermLevelForField; 3) load formData (cache/doc/fetch); 4) run scripts
  const fieldPermissions = useMemo(() => {
    return ClientFieldHelper.getFieldLevelPermissions(
      doctypePermissions as Zodula.SelectDoctype<"Doctype Permission">[],
      fields.map((f) => ({ name: f.name || "", perm_level: f.perm_level ?? undefined })),
      userRoles
    );
  }, [doctypePermissions, fields, userRoles]);

  const isOwn = useMemo(() => !!doc && !!user && doc.owner === user.id, [doc, user]);
  const bypass = false;
  const isSystemAdmin = (roles || []).includes("System Admin");

  function applyFieldPermissions(
    fieldsToApply: Zodula.SelectDoctype<"Field">[],
    docForPerms: Record<string, any> | null
  ): {
    formFields: Record<string, any>;
    referenceTableFields: Record<string, Zodula.SelectDoctype<"Field">[]>;
    extendFields: Record<string, Zodula.SelectDoctype<"Field">[]>;
  } | null {
    if (fieldsToApply.length === 0 || !doctypeDoc) return null;
    const baseFields = fieldsToApply.reduce((acc, f) => (f.doctype === doctype ? { ...acc, [f.name]: f } : acc), {} as Record<string, any>);
    const withPerms: Record<string, any> = {};
    const docOwn = !!docForPerms && !!user && docForPerms.owner === user.id;
    for (const name of Object.keys(baseFields)) {
      const f = { ...baseFields[name] };
      const permLevel = f.perm_level ?? 0;
      const { canGet, canUpdate } = ClientFieldHelper.checkPermLevelForField(
        fieldPermissions,
        name,
        permLevel,
        docOwn,
        bypass,
        isSystemAdmin
      );
      if (!canGet) f.hidden = 1;
      else if (!canUpdate) f.readonly = 1;
      withPerms[name] = f;
    }
    const withSubmittedFields = { ...withPerms };
    for (const name of Object.keys(withPerms)) {
      const f = withPerms[name];
      if (docForPerms?.doc_status === "Submitted" && f.allow_on_submit !== 1 && f.readonly !== 1) {
        withSubmittedFields[name] = { ...f, readonly: 1 };
      }
    }
    const referenceTableFieldsResult: Record<string, Zodula.SelectDoctype<"Field">[]> = {};
    const extendFieldsResult: Record<string, Zodula.SelectDoctype<"Field">[]> = {};
    fieldsToApply.filter((f) => f.type === "Reference Table").forEach((f) => {
      const ref = f.reference;
      if (ref) referenceTableFieldsResult[f.name] = allFields.filter((x) => (x as any).doctype === ref);
    });
    fieldsToApply.filter((f) => f.type === "Extend").forEach((f) => {
      const ref = f.reference;
      if (ref) extendFieldsResult[f.name] = allFields.filter((x) => (x as any).doctype === ref);
    });
    return {
      formFields: withSubmittedFields,
      referenceTableFields: referenceTableFieldsResult,
      extendFields: extendFieldsResult,
    };
  }
  useEffect(() => {
    // Initialize form data useEffect
    if (!doctypeDoc || !fields?.length) return;
    if (location.state?.resetForm) {
      replace(pathname, { state: { ...location.state, resetForm: false } });
    }
    afterInitializeRanRef.current = false;
    afterInitializeRef.current = null;
    let cancelled = false;
    (async () => {
      let docForForm: Record<string, any> | null = null;
      if (mode === "edit" && effectiveDocId) {
        docForForm = await fetchFormDoc(doctype as Zodula.DoctypeName, effectiveDocId);
        if (!formDataCache[formId]) {
          const seeded = ensureChildTableIdxOnDoc(docForForm ?? {}, undefined);
          formDataCache[formId] = seeded;
          setFormData(seeded);
        }
        if (cancelled) return;
      }
      const computed = applyFieldPermissions(fields, docForForm ?? doc);
      if (!computed || cancelled) return;
      setFormFields(computed.formFields);
      setReferenceTableFields(computed.referenceTableFields);
      setExtendFields(computed.extendFields);
      const formDataResult = await runInitializeForm(docForForm ?? doc, computed.formFields);
      if (cancelled) return;
      afterInitializeRef.current = {
        formDataResult,
        fields: computed.formFields,
      };
    })();
    return () => { cancelled = true; };
  }, [doctype, id, mode, doctypeDoc, fields, formId]);

  // Apply prefill (if any) and then runAfterInitializeForm, once
  useEffect(() => {
    if (!afterInitializeRef.current || afterInitializeRanRef.current) return;
    if (!formFields || Object.keys(formFields).length === 0) return;

    (async () => {
      const hasPrefill =
        prefill && typeof prefill === "object" && Object.keys(prefill).length > 0;

      if (hasPrefill && !appliedPrefillRef.current) {
        appliedPrefillRef.current = true;
        const prefillObj = prefill as Record<string, any>;
        const keys = Object.keys(prefillObj).filter((k) => prefillObj[k] !== undefined);
        const byDots = (a: string, b: string) =>
          (a.split(".").length - 1) - (b.split(".").length - 1);
        keys.sort(byDots);
        const nestedKeys: string[] = [];

        for (const key of keys) {
          const isNestedPath = key.includes(".");
          if (isNestedPath) nestedKeys.push(key);
          await handleFieldChange(key as any, prefillObj[key], {
            // Run scripts for top-level fields, but keep nested table prefill scriptless
            // to avoid async reset races on child-table hydration.
            noScripts: isNestedPath,
            noFetchFrom: isNestedPath,
          });
        }

        // Second pass: now that top-level prefill scripts have stabilized form state,
        // trigger scripts for nested paths (e.g., references.0.reference_id) so row-level
        // handlers can calculate derived values.
        for (const key of nestedKeys) {
          await handleFieldChange(key as any, prefillObj[key], {
            noScripts: false,
            noFetchFrom: false,
          });
        }
      }

      const snapshot = afterInitializeRef.current;
      if (!snapshot) return;
      const docForScripts = formDataCache[formId] ?? snapshot.formDataResult;
      await runAfterInitializeForm(docForScripts, snapshot.fields);
      afterInitializeRanRef.current = true;
    })();
  }, [formFields, prefill, handleFieldChange, runAfterInitializeForm]);

  const duplicatePrefill = useCallback(() => {
    const primaryFields = fields.filter((f) => f.type !== "Reference Table" && f.type !== "Extend" && f.no_copy !== 1);
    const primaryFieldData = primaryFields.reduce((acc, f) => {
      acc[f.name] = formData[f.name];
      return acc;
    }, {} as Record<string, any>);
    let tableFieldData = {} as Record<string, any[]>;
    for (const [fieldName, fields] of Object.entries(referenceTableFields)) {
      const values = formData[fieldName];
      const parentField = allFields.find((f) => f.name === fieldName);
      if (parentField?.no_copy === 1) continue;
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (!tableFieldData[fieldName]) tableFieldData[fieldName] = [];
        if (!tableFieldData[fieldName][i]) tableFieldData[fieldName][i] = {};
        for (const field of fields) {
          if (field?.no_copy === 1) continue;
          tableFieldData[`${fieldName}.${i}.${field.name}`] = value[field.name];
        }
      }
    }
    let extendFieldData = {} as Record<string, any>;
    for (const [fieldName, fields] of Object.entries(extendFields)) {
      const value = formData[fieldName];
      const parentField = allFields.find((f) => f.name === fieldName);
      if (parentField?.no_copy === 1) continue;
      if (!extendFieldData[fieldName]) extendFieldData[fieldName] = {};
      for (const field of fields) {
        if (field?.no_copy === 1) continue;
        extendFieldData[`${fieldName}.${field.name}`] = value[field.name];
      }
    }

    const prefillObject = {
      ...primaryFieldData,
      ...tableFieldData,
      ...extendFieldData,
    };
    return prefillObject;
  }, [formData, fields]);

  const handleDuplicate = useCallback(() => {
    if (!doc || !fields) return;
    const prefill = duplicatePrefill();
    push(`/desk/doctypes/${doctype}/form`, {
      state: { prefill },
    });
  }, [doc, fields, doctype, duplicatePrefill]);

  const handleSubmit = async () => {
    const payload = getUpdatePayload();
    const result = validateRequiredFields(payload, formFields, referenceTableFields, extendFields);
    if (!result.valid) {
      alert({
        variant: "destructive",
        message: result.message,
      });
      return;
    }
    try {
      const con = await confirm({
        title: "Submit Document",
        message: `Are you sure you want to submit this ${doctypeDoc?.label || doctype} document? This action will change the document status.`,
        confirmText: "Submit",
        cancelText: "Cancel",
        variant: "default",
      });
      if (con) {
        await zodula.doc.submit_doc(doctype, id || "").catch((error: any) => {
          alert({
            variant: "destructive",
            message: error?.message,
          });
          return null;
        });
        handleReload();
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
        await zodula.doc.cancel_doc(doctype, id || "").catch((error: any) => {
          alert({
            variant: "destructive",
            message: error?.message,
          });
          return null;
        });
        handleReload();
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
      if (field?.type === "Reference Table" && !!Object.keys(data).find((f) => f === fieldName)) {
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
    const latestFormData = formData;

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
  }, [formData, doc, normalizeReferenceTableFields, formFields])

  const handleUpdate = useCallback(async () => {
    const payload = getUpdatePayload();

    const result = validateRequiredFields(payload, formFields, referenceTableFields, extendFields);
    if (!result.valid) {
      alert({
        variant: "destructive",
        message: result.message,
      });
      return;
    }
    try {
      await zodula.doc.update_doc(doctype, id || "", payload);
      handleReload();
    } catch (error) {
      console.error("Error updating doc:", error);
    }
  }, [doctype, id, getUpdatePayload, handleReload, formFields, referenceTableFields, extendFields]);

  const isSingle = doctypeDoc?.is_single === 1;

  const areObjectsEqual = useCallback((obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return obj1 == obj2;
    const keys1 = Object.keys(obj1), keys2 = Object.keys(obj2);
    if (Math.abs(keys1.length - keys2.length) > 10) return false;
    const allKeys = new Set([...keys1, ...keys2]);
    let keysToCheck = Array.from(allKeys);
    if (allKeys.size > 100) {
      for (const key of keysToCheck.slice(0, 20)) {
        if (!valuesAreEqual(obj1[key], obj2[key])) return false;
      }
      keysToCheck = keysToCheck.slice(20);
    }
    for (const key of keysToCheck) {
      const v1 = obj1[key], v2 = obj2[key];
      if (v1 === v2) continue;
      if ((v1 == null && v2 == null) || (v1 === undefined && v2 === undefined)) continue;
      if (!valuesAreEqual(v1, v2)) return false;
    }
    return true;
  }, []);

  const handleSave = async () => {
    const payload = getUpdatePayload();
    const result = validateRequiredFields(payload, formFields, referenceTableFields, extendFields);
    if (!result.valid) {
      alert({
        variant: "destructive",
        message: result.message,
      });
      return;
    }
    try {
      const updatedDoc = await zodula.doc.update_doc(doctype, id || "", payload).catch((error: any) => {
        alert({
          variant: "destructive",
          message: error?.message,
        });
        return null;
      });
      if (!updatedDoc) {
        return;
      }
      if (updatedDoc.id !== id && !isSingle) {
        formDataCache[formId] = undefined;
        formDataCache[updatedDoc.id] = updatedDoc as Record<string, any>;
        replace(`/desk/doctypes/${doctype}/form/${updatedDoc.id}`);
      } else {
        await handleReload();
      }
    } catch (error) {
      console.error("Error saving doc:", error);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      // Get the latest form data directly from the store to ensure we have the most recent values
      // This ensures we capture all user input, not just the memoized formData
      const latestFormData = formData;

      // Normalize Reference Table fields (empty arrays/undefined -> null)
      const normalizedFormData = normalizeReferenceTableFields(latestFormData);

      const result = validateRequiredFields(normalizedFormData, formFields, referenceTableFields, extendFields);
      if (!result.valid) {
        alert({
          variant: "destructive",
          message: result.message,
        });
        setIsLoading(false);
        return;
      }

      const createdDoc = await zodula.doc.create_doc(
        doctype as Zodula.DoctypeName,
        {
          ...normalizedFormData,
        }
      ).catch((error: any) => {
        alert({
          variant: "destructive",
          message: error?.message,
        });
        return null;
      });
      if (createdDoc) {
        handleReload();
        // Clear saved form values after successful creation
        clearFormValues(doctype);
        formDataCache[formId] = undefined;

        if (cbUrl) {
          const state = {
            prefill: !!fromField ? {
              [fromField]: createdDoc?.id
            } : undefined
          }
          replace(cbUrl, {
            state: state
          });
        } else {
          replace(`/desk/doctypes/${doctype}/form/${createdDoc.id}`);
        }
      }
    } catch (error) {
      console.error("Error creating doc:", error);
    } finally {
      setIsLoading(false);
    }
  };

  console.log("formData", formData);
  console.log("doc", doc);

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
        await zodula.doc.delete_doc(doctype, id).catch((error: any) => {
          alert({
            variant: "destructive",
            message: error?.message,
          });
          return null;
        });
        formDataCache[formId] = undefined;
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

  // ===== SIDEBAR CONTENT =====
  const contextState = useMemo(() => {
    const base =
      location?.state && typeof location.state === "object"
        ? (location.state as Record<string, any>)
        : {};
    const extra: Record<string, any> = {};
    if (cbUrl) extra.cbUrl = cbUrl;
    if (fromField) extra.fromField = fromField;
    if (mode === "create" && prefill) extra.prefill = prefill;
    return { ...base, ...extra };
  }, [location?.state, cbUrl, fromField, mode, prefill]);

  const hasContextState = Object.keys(contextState).length > 0;

  const sidebarContent = (
    <div className="zd:space-y-5">
      {mode === "create" ? (
        <>
          <div className="zd:rounded-lg zd:border zd:border-border zd:bg-muted/40 zd:p-4">
            <div className="zd:flex zd:gap-3">
              <div className="zd:flex zd:shrink-0 zd:mt-0.5 zd:w-8 zd:h-8 zd:rounded-md zd:bg-primary/10 zd:flex zd:items-center zd:justify-center">
                <FileText className="zd:w-4 zd:h-4 zd:text-primary" />
              </div>
              <div className="zd:space-y-1">
                <p className="zd:text-sm zd:font-medium zd:text-foreground">
                  {t("New document")}
                </p>
                <p className="zd:text-xs zd:text-muted-foreground zd:leading-relaxed">
                  Creating new {doctype} document. Fill in the required fields and save to create.
                </p>
              </div>
            </div>
          </div>
          {hasContextState && (
            <section className="zd:space-y-2">
              <h3 className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground">
                {t("Context")}
              </h3>
              <div className="zd:rounded-lg zd:border zd:border-border zd:bg-muted/30 zd:px-3 zd:py-2.5 zd:text-xs zd:text-muted-foreground zd:space-y-1">
                {Object.entries(contextState).map(([key, value]) => (
                  <div key={key} className="zd:flex zd:items-start zd:justify-between zd:gap-2">
                    <span className="zd:font-medium zd:text-foreground">{key}</span>
                    <span className="zd:text-right zd:break-all">
                      {typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean"
                        ? String(value)
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* Attachments — shown in edit mode whenever a doc is saved */}
          {doc?.id && (
            <Attachments doctype={doctype} docId={doc.id} />
          )}

          {connections.length > 0 && (
            <section className="zd:space-y-2">
              <h3 className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground">
                <Link2 className="zd:w-3.5 zd:h-3.5" />
                {t("Relatives")}
              </h3>
              <div className="zd:flex zd:flex-col zd:gap-1">
                {connections.map((connection, index) => {
                  const filterQuery = encodeURIComponent(
                    JSON.stringify(connection.filters)
                  );
                  const count =
                    connectionsCount?.results?.find(
                      (result: any) => result.doctype === connection.doctype
                    )?.count ?? 0;
                  return (
                    <Link
                      className="zd:flex zd:items-center zd:justify-between zd:gap-2 zd:rounded-md zd:px-3 zd:py-2 zd:text-sm zd:text-foreground zd:bg-muted/40 zd:border zd:border-transparent zd:hover:bg-muted/70 zd:hover:border-border zd:transition-colors"
                      to={`/desk/doctypes/${connection.doctype}/list?filters=${filterQuery}`}
                      key={`${connection.doctype}-${index}`}
                    >
                      <span className="zd:truncate zd:font-medium">
                        {connection.doctype}
                      </span>
                      <Badge variant="secondary" className="zd:shrink-0 zd:text-xs">
                        {count}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
          <section className="zd:space-y-2">
            <h3 className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground">
              <Building2 className="zd:w-3.5 zd:h-3.5" />
              {t("Metadata")}
            </h3>
            <div className="zd:rounded-lg zd:border zd:border-border zd:bg-muted/30 zd:divide-y zd:divide-border zd:overflow-hidden">
              <div className="zd:flex zd:flex-col zd:gap-0.5 zd:px-3 zd:py-2.5">
                <span className="zd:text-xs zd:text-muted-foreground">
                  {t("Owner")}
                </span>
                {doc?.owner ? (
                  <UserLink userId={doc.owner} name={getUserName(doc.owner) || doc.owner} />
                ) : (
                  <span className="zd:text-sm zd:italic zd:text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </section>
          {hasContextState && (
            <section className="zd:space-y-2">
              <h3 className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground">
                {t("Context")}
              </h3>
              <div className="zd:rounded-lg zd:border zd:border-border zd:bg-muted/30 zd:px-3 zd:py-2.5 zd:text-xs zd:text-muted-foreground zd:space-y-1">
                {Object.entries(contextState).map(([key, value]) => (
                  <div key={key} className="zd:flex zd:items-start zd:justify-between zd:gap-2">
                    <span className="zd:font-medium zd:text-foreground">{key}</span>
                    <span className="zd:text-right zd:break-all">
                      {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                        ? String(value)
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );

  const [isUserHasType, setIsUserHasType] = useState(false);
  // ===== FORM STATE =====
  // Optimized isDirty check with early bailouts to prevent jiggling
  const isDirty = useMemo(() => {
    if (!formData) return false;
    if (isUserHasType) return true;
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

    if (isSingle) {
      return (
        <Button

          onClick={handleSave}
          className="zd:h-8"
          disabled={!isDirty}
        >
          <SaveIcon />
          {t("Save")}{" "}
        </Button>
      );
    }

    if (doctypeDoc?.is_submittable === 1 && doc?.doc_status === "Draft" && !isDirty) {
      return (
        <Button

          onClick={handleSubmit}
          className="zd:h-8"
          disabled={isDirty}
        >
          {t("Submit")}
          <ArrowRight />
        </Button>
      );
    } else if (doctypeDoc?.is_submittable === 1 && doc?.doc_status === "Submitted") {
      return (
        <Button

          onClick={handleUpdate}
          className="zd:h-8"
          disabled={!isDirty}
        >
          <SaveIcon />
          {t("Update")}
        </Button>
      );
    } else if (doc?.doc_status == "Draft") {
      return (
        <Button

          onClick={handleSave}
          className="zd:h-8"
          disabled={!isDirty}
        >
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
      <DeskNavbarLayout>
        <div className="zd:flex zd:items-center zd:justify-center zd:h-64">
        </div>
      </DeskNavbarLayout>
    );
  }

  if (mode === "edit" && error && !isSingle) {
    return (
      <DeskNavbarLayout>
        <ErrorView message={error} status={500} />
      </DeskNavbarLayout>
    );
  }

  if (mode === "edit" && !doc && !isSingle && !loading) {
    return (
      <DeskNavbarLayout>
        <ErrorView message="Doc not found" status={404} />
      </DeskNavbarLayout>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <DeskNavbarLayout
      title={
        <div className="zd:flex zd:gap-2 zd:items-center">
          {mode === "create"
            ? `${t("New")} ${t(doctypeLabel)}`
            : isSingle
              ? `${t(doctypeLabel)}`
              : doc?.id || `${t("New")} ${t(doctypeLabel)}`}
          <span className="zd:flex zd:gap-2 zd:items-center no-print">
            {doctypeDoc?.is_submittable === 1 && mode === "edit" && (() => {
              const badgeConfig = badgeConfigs.current["doc_status"];
              if (badgeConfig && doc) {
                const valueOrObj = badgeConfig.getValue ? badgeConfig.getValue(doc, t) : doc.doc_status;

                // If getValue returns null, fall back to default DocStatusBadge
                if (valueOrObj === null) {
                  return <DocStatusBadge status={doc?.doc_status || "Draft"} />;
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
              return <DocStatusBadge status={doc?.doc_status || "Draft"} />;
            })()}
          </span>
        </div>
      }
      rightSidebar={sidebarContent}
      actionSection={
        doctypeDoc?.is_system_generated === 1 ? (
          <div>
            <span className="zd:text-sm zd:text-muted-foreground">
              This is a system generated doctype. You cannot{" "}
              {mode === "create" ? "create" : "edit"} this doctype.
            </span>
          </div>
        ) : (
          <div className="zd:flex zd:items-center zd:gap-1">
            {mode === "edit" && (
              <Button
                variant="ghost"
                href={`/desk/print?doctype=${encodeURIComponent(
                  doctype
                )}&ids=${encodeURIComponent(JSON.stringify([doc?.id ?? id ?? ""]))}`}
              >
                <Printer className="zd:w-4 zd:h-4" />
              </Button>
            )}
            {(mode === "edit" || secondaryButtons.length > 0) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="zd:relative zd:shrink-0"
                    title="More actions"
                    aria-label={
                      secondaryButtons.length > 0
                        ? `More actions, ${secondaryButtons.length} extra`
                        : "More actions"
                    }
                  >
                    <MoreHorizontal className="zd:w-4 zd:h-4" />
                    {secondaryButtons.length > 0 ? (
                      <span
                        className="zd:absolute zd:-top-0.5 zd:-right-0.5 zd:flex zd:h-4 zd:min-w-4 zd:items-center zd:justify-center zd:rounded-full zd:bg-primary zd:px-1 zd:text-[10px] zd:font-semibold zd:leading-none zd:text-primary-foreground"
                        aria-hidden
                      >
                        {secondaryButtons.length}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Secondary menu: UI script actions */}
                  {secondaryButtons.map((button, index) => (
                    <DropdownMenuItem key={index} onClick={async () => await button.onClick(buildFormContext() as any)}>
                      <DynamicIcon iconName={button.options?.icon || "MoreHorizontal"} className="zd:w-4 zd:h-4 zd:mr-1" />
                      {button.label}
                    </DropdownMenuItem>
                  ))}
                  {mode === "edit" && secondaryButtons.length > 0 && <DropdownMenuSeparator />}
                  {/* Doctype menu: Duplicate, Reload, Cancel, Delete */}
                  {mode === "edit" && (
                    <>
                      {!isSingle && (
                        <DropdownMenuItem onClick={handleDuplicate}>
                          <Copy className="zd:w-4 zd:h-4 zd:mr-1" />
                          <span className="zd:flex-1">{t("Duplicate")}</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={handleReload}>
                        <RotateCcw className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Reload")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleCancel}
                        className={cn(
                          "zd:text-red-600 zd:focus:text-red-600",
                          doc?.doc_status === "Submitted" ? "" : "zd:hidden"
                        )}
                      >
                        <Copy className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Cancel")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className={cn(
                          "zd:text-red-600 zd:focus:text-red-600",
                          doc?.doc_status !== "Submitted" ? "" : "zd:hidden"
                        )}
                      >
                        <Trash2 className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Delete")}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Custom form actions from useEnhanceDoctype */}
            <FormActions doctype={doctype} doc={doc} />
            <PrimaryButtonRender />
          </div>
        )
      }
    >
      <div data-form-doctype={doctype} data-form-is-dirty={isDirty ? "true" : "false"} className="zd:pb-16">
        {/* Form Content */}
        <div className="zd:flex zd:flex-col zd:gap-8">
          <Form
            isCreate={mode === "create"}
            translate
            debug={roles?.includes("System Admin") || false}
            docId={id || ""}
            readonly={doctypeDoc?.is_system_generated === 1}
            fields={formFields}
            values={formData}
            onChange={async (fieldName, data) => {
              await handleFieldChange(fieldName, data);
              setIsUserHasType(true);
            }}
            doctype={doctypeDoc as unknown as Zodula.DoctypeConfig}
            tabs={doctypeDoc?.tabs ? JSON.parse(doctypeDoc.tabs) : []}
            referenceTableFields={referenceTableFields}
            referenceTableIndexFields={referenceTableIndexFields}
            extendFields={extendFields}
            fieldButtons={fieldButtonsByField}
          />
          <div className="">
            {!!doc?.id && <AuditTrail doctype={doctype} docId={id!} />}
            {/* Created at / Updated at */}
            {doc?.id && (
              <div className="zd:mt-6 zd:pt-4 zd:border-t zd:border-border  zd:flex zd:items-center zd:gap-2 zd:justify-between">
                {/* Created row */}
                <div className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:text-muted-foreground">
                  {/* avatar */}
                  <div
                    className="zd:w-5 zd:h-5 zd:rounded-full zd:flex zd:items-center zd:justify-center zd:flex-shrink-0 zd:bg-primary/10 zd:ring-1 zd:ring-primary/20 zd:text-primary"
                    style={{ fontSize: "9px", fontWeight: 600 }}
                    title={doc.created_by ?? ""}
                  >
                    {(doc.created_by ?? "?")
                      .split(/[\s._@-]+/)
                      .slice(0, 2)
                      .map((p: string) => p[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                  <span>
                    {doc.created_by ? (
                      <UserLink
                        userId={doc.created_by}
                        name={getUserName(doc.created_by) || doc.created_by}
                      />
                    ) : (
                      <span>{t("Unknown")}</span>
                    )}
                  </span>
                  <span className="zd:text-muted-foreground/60">{t("Created At")}</span>
                  <span
                    className="zd:cursor-default"
                    title={
                      doc.created_at
                        ? new Date(doc.created_at).toLocaleString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : ""
                    }
                  >
                    {zodula.utils.formatTimeAgo(doc.created_at || "")}
                  </span>
                </div>

                {/* Updated row — only shown when updated_at differs meaningfully from created_at */}
                {doc.updated_at &&
                  new Date(doc.updated_at).getTime() - new Date(doc.created_at || "").getTime() > 60_000 && (
                    <div className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:text-muted-foreground">
                      {/* avatar */}
                      <div
                        className="zd:w-5 zd:h-5 zd:rounded-full zd:flex zd:items-center zd:justify-center zd:flex-shrink-0 zd:bg-muted zd:ring-1 zd:ring-border"
                        style={{ fontSize: "9px", fontWeight: 600 }}
                        title={doc.updated_by ?? ""}
                      >
                        {(doc.updated_by ?? doc.created_by ?? "?")
                          .split(/[\s._@-]+/)
                          .slice(0, 2)
                          .map((p: string) => p[0]?.toUpperCase() ?? "")
                          .join("")}
                      </div>
                      <span>
                        {doc.updated_by ? (
                          <UserLink
                            userId={doc.updated_by}
                            name={getUserName(doc.updated_by) || doc.updated_by}
                          />
                        ) : doc.created_by ? (
                          <UserLink
                            userId={doc.created_by}
                            name={getUserName(doc.created_by) || doc.created_by}
                          />
                        ) : (
                          <span>{t("Unknown")}</span>
                        )}
                      </span>
                      <span className="zd:text-muted-foreground/60">{t("Updated At")}</span>
                      <span
                        className="zd:cursor-default"
                        title={
                          doc.updated_at
                            ? new Date(doc.updated_at).toLocaleString(undefined, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : ""
                        }
                      >
                        {zodula.utils.formatTimeAgo(doc.updated_at || "")}
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DeskNavbarLayout>
  );
}
