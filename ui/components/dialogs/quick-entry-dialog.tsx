import { useEffect, useMemo, useState } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { useRouter } from "@/zodula/ui/components/router";
import { zodula } from "@/zodula/client";
import { toast } from "@/zodula/ui/components/ui/toast";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { useOrganization } from "../../hooks/use-organization";

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
    org: string;
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

  const quickEntryFields = useMemo(() => {
    if (!initialData?.fields) return [];

    const selectedFields = initialData.fields.filter((field) => {
      const fieldName = field.name || "";
      const isStandard = zodula.utils.isStandardField(fieldName);
      return !isStandard && (field.required === 1 || field.in_quick_entry === 1);
    });

    // Sort by idx to keep the same order as the doctype definition
    return [...selectedFields].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  }, [initialData?.fields]);

  // Reset form data and errors whenever the dialog opens with a new doctype
  useEffect(() => {
    if (!isOpen || !initialData) return;

    const defaults: Record<string, any> = {};
    
    // First, apply prefill values (if provided)
    if (initialData.prefill) {
      Object.keys(initialData.prefill).forEach((fieldName) => {
        const value = initialData.prefill![fieldName];
        // Only set if the field exists in quick entry fields
        const fieldExists = quickEntryFields.some(f => f.name === fieldName);
        if (fieldExists && value !== undefined && value !== null && value !== "") {
          defaults[fieldName] = value;
        }
      });
    }
    
    // Then, apply default values (prefill takes precedence)
    quickEntryFields.forEach((field) => {
      const fieldName = field.name || "";
      // Only set default if prefill didn't already set it
      if (defaults[fieldName] === undefined && field.default !== undefined) {
        defaults[fieldName] = field.default || "";
      }
    });

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
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));

    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldKey];
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
    router.push(`/desk/${initialData.org}/doctypes/${initialData.doctype}/form`, {
      state: { 
        resetForm: true,
        prefill: initialData.prefill
      },
    });
    onClose();
  };

  if (!isOpen || !initialData) return null;

  return (
    <div className="zd:min-w-[520px] zd:max-w-2xl zd:flex zd:flex-col zd:gap-4 zd:pt-6">
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
              org={organization?.id || ""}
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

