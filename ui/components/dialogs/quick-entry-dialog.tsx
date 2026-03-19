import { useEffect, useMemo, useState } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { useRouter } from "@/zodula/ui/components/router";
import { zodula } from "@/zodula/client";
import { toast } from "@/zodula/ui/components/ui/toast";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { useOrganization } from "../../hooks/use-organization";
import { useDocListAll } from "../../hooks/use-doc-list-all";

type QuickEntryField = {
  name?: string;
  label?: string;
  type?: string;
  description?: string;
  idx?: number;
  required?: number;
  in_quick_entry?: number;
  default?: any;
  [key: string]: any;
};

interface QuickEntryDialogProps {
  isOpen: boolean;
  onClose: (result?: any) => void;
  initialData?: {
    doctype: Zodula.DoctypeName;
    fields: QuickEntryField[];
    cbUrl?: string;
    fromField?: string;
    prefill?: Record<string, any>;
  };
}

export function QuickEntryDialog({
  isOpen,
  onClose,
  initialData,
}: QuickEntryDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { organization} = useOrganization();

  const prefillKeys = useMemo(() => {
    const prefill = initialData?.prefill;
    if (!prefill || typeof prefill !== "object") return new Set<string>();
    const keys = new Set<string>();
    const collect = (obj: any, prefix = "") => {
      if (obj === null || obj === undefined) return;
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => collect(item, prefix ? `${prefix}.${i}` : String(i)));
        return;
      }
      if (typeof obj === "object" && Object.keys(obj).length) {
        Object.keys(obj).forEach((k) => {
          const path = prefix ? `${prefix}.${k}` : k;
          keys.add(path.split(".")[0] ?? k);
          if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
            collect(obj[k], path);
          }
        });
      }
    };
    collect(prefill);
    return keys;
  }, [initialData?.prefill]);

  const quickEntryFields = useMemo(() => {
    if (!initialData?.fields) return [];
    const selectedFields = initialData.fields.filter((field) => {
      const fieldName = field.name || "";
      const isStandard = zodula.utils.isStandardField(fieldName);
      const hasPrefill = prefillKeys.has(fieldName);
      return !isStandard && (field.required === 1 || field.in_quick_entry === 1 || hasPrefill);
    });
    return [...selectedFields].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  }, [initialData?.fields, prefillKeys]);

  const { docs: allFields } = useDocListAll({ doctype: "Field" });
  const referenceTableFields = useMemo(() => {
    const out: Record<string, QuickEntryField[]> = {};
    if (!allFields?.length || !quickEntryFields.length) return out;
    for (const field of quickEntryFields) {
      if (field.type === "Reference Table" && field.reference) {
        out[field.name || ""] = (allFields as any[]).filter(
          (f: any) => f.doctype === field.reference
        ).sort((a: any, b: any) => (a.idx ?? 0) - (b.idx ?? 0));
      }
    }
    return out;
  }, [allFields, quickEntryFields]);

  // Expand flat prefill keys (e.g. "links.0.link_type": "Customer") into nested formData so Reference Table gets formData.links = [{ link_type: "Customer" }]
  const expandPrefillIntoNested = (prefill: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(prefill)) {
      if (value === undefined) continue;
      const parts = key.split(".");
      if (parts.length === 1) {
        out[key] = value;
        continue;
      }
      const parent = parts[0];
      const second = parts[1];
      const rest = parts.slice(2);
      if (parent == null) continue;
      const index = parseInt(second ?? "", 10);
      const isTableRow = parts.length >= 3 && !isNaN(index);
      if (isTableRow) {
        if (!Array.isArray(out[parent])) out[parent] = [];
        while (out[parent].length <= index) out[parent].push({ idx: out[parent].length });
        const row = out[parent][index] as Record<string, any>;
        if (row.idx === undefined) row.idx = index;
        const childPath = rest.join(".");
        if (childPath) {
          const childParts = childPath.split(".");
          let current: any = row;
          for (let i = 0; i < childParts.length - 1; i++) {
            const p = childParts[i] as string;
            if (!(current[p] && typeof current[p] === "object")) current[p] = {};
            current = current[p];
          }
          const last = childParts[childParts.length - 1];
          if (last != null) current[last] = value;
        }
      } else {
        if (!(out[parent] && typeof out[parent] === "object")) out[parent] = {};
        const childPath = [second, ...rest].filter(Boolean).join(".");
        const childParts = childPath.split(".");
        let current: any = out[parent];
        for (let i = 0; i < childParts.length - 1; i++) {
          const p = childParts[i] as string;
          if (!(current[p] && typeof current[p] === "object")) current[p] = {};
          current = current[p];
        }
        const last = childParts[childParts.length - 1];
        if (last != null) current[last] = value;
      }
    }
    return out;
  };

  useEffect(() => {
    if (!isOpen || !initialData) return;
    const defaults: Record<string, any> = {};
    quickEntryFields.forEach((field) => {
      const fieldName = field.name || "";
      if (field.default !== undefined) {
        defaults[fieldName] = field.default || "";
      }
    });
    const prefill = initialData.prefill;
    if (prefill && typeof prefill === "object" && Object.keys(prefill).length) {
      const expanded = expandPrefillIntoNested(prefill);
      Object.keys(expanded).forEach((k) => {
        if (expanded[k] !== undefined) defaults[k] = expanded[k];
      });
    }
    setFormData(defaults);
    setFieldErrors({});
    setSubmitError(null);
  }, [isOpen, initialData?.doctype, initialData?.prefill, quickEntryFields]);

  const isEmpty = (value: any) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    quickEntryFields.forEach((field) => {
      if (field.required === 1) {
        const value = formData[field.name || ""];
        if (isEmpty(value)) {
          errors[field.name || ""] = t("Required");
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (fieldKey: string, value: any) => {
    const topKey = fieldKey.split(".")[0] ?? fieldKey;
    setFormData((prev) => {
      if (!fieldKey.includes(".")) return { ...prev, [fieldKey]: value };
      const parts = fieldKey.split(".");
      const tableName = parts[0];
      const index = parseInt(parts[1] ?? "", 10);
      const isTablePath = parts.length >= 3 && !isNaN(index) && tableName != null;
      if (isTablePath && tableName != null) {
        const childParts = parts.slice(2);
        const next = { ...prev };
        const arr = Array.isArray(next[tableName]) ? [...next[tableName]] : [];
        while (arr.length <= index) arr.push({ idx: arr.length });
        const row = { ...(arr[index] ?? {}), idx: arr[index]?.idx ?? index };
        let current: any = row;
        for (let i = 0; i < childParts.length - 1; i++) {
          const p = childParts[i] as string;
          current[p] = { ...(current[p] && typeof current[p] === "object" ? current[p] : {}) };
          current = current[p];
        }
        const last = childParts[childParts.length - 1];
        if (last != null) current[last] = value;
        arr[index] = row;
        next[tableName] = arr;
        return next;
      }
      if (parts.length === 2) {
        const parent = parts[0];
        const child = parts[1];
        if (parent != null && child != null) return { ...prev, [parent]: { ...(prev[parent] ?? {}), [child]: value } };
      }
      return { ...prev, [fieldKey]: value };
    });

    if (topKey && fieldErrors[topKey]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[topKey];
        return updated;
      });
    }
  };

  const handleSubmit = async () => {
    if (!initialData) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await zodula.doc.create_doc(
        initialData.doctype,
        formData
      );
      toast.success(t("Created"));
      onClose(created);
    } catch (error: any) {
      setSubmitError(error?.message || t("Failed to create document"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFullForm = () => {
    if (!initialData) return;
    const state: Record<string, any> = { resetForm: true };
    if (initialData.cbUrl) state.cbUrl = initialData.cbUrl;
    if (initialData.fromField) state.fromField = initialData.fromField;
    if (initialData.prefill && Object.keys(initialData.prefill).length) state.prefill = initialData.prefill;
    router.push(`/desk/doctypes/${initialData.doctype}/form`, { state });
    onClose();
  };

  if (!isOpen || !initialData) return null;

  return (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:pt-6">
      <div className="zd:space-y-3">
        <div className="zd:flex zd:items-start zd:justify-between">
          <div>
            <h3 className="zd:text-lg zd:font-semibold">
              {t("Quick Entry for")} {initialData.doctype}
            </h3>
            <p className="zd:text-sm zd:text-muted-foreground">
              {t("Fill the required details or open the full form to continue.")}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={handleOpenFullForm}
            className="zd:text-sm"
          >
            {t("Open full form")}
          </Button>
        </div>

        <div className="zd:grid zd:grid-cols-1 md:zd:grid-cols-2 zd:gap-4">
          {quickEntryFields.map((field) => (
            <FormControl
              key={field.name}
              label={field.label || field.name}
              field={field}
              fieldKey={field.name || ""}
              value={formData[field.name || ""]}
              required={field.required === 1}
              onChange={handleChange}
              error={fieldErrors[field.name || ""]}
              formData={formData}
              referenceTableFields={referenceTableFields}
              docId=""
            />
          ))}
        </div>

        {submitError && (
          <div className="zd:text-sm zd:text-destructive">{submitError}</div>
        )}
      </div>

      <div className="zd:flex zd:justify-end zd:gap-2 zd:pt-2 zd:border-t">
        <Button variant="outline" onClick={() => onClose()} disabled={isSubmitting}>
          {t("Cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? t("Creating...") : t("Create")}
        </Button>
      </div>
    </div>
  );
}

