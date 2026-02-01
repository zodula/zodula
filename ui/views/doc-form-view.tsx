import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import { useCmd } from "../hooks/use-cmd";
import {
  KeyboardShortcuts,
  KeyboardShortcutsDialog,
} from "../components/custom/keyboard-shortcuts";
import { PrintTemplateDialog } from "../components/dialogs/print-template-dialog";
import { useUserName } from "../hooks/use-user-name";
import ErrorView from "./error-view";
import { useParams } from "react-router";

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

// Constants
const KEYBOARD_SHORTCUTS = {
  SAVE: "ctrl+s",
  UPDATE: "ctrl+u",
  SUBMIT: "ctrl+enter",
  CANCEL: "ctrl+shift+c",
  DELETE: "ctrl+delete",
  DUPLICATE: "ctrl+d",
  RELOAD: "ctrl+r",
  PRINT: "ctrl+p",
  NEW: "ctrl+n",
  LIST: "ctrl+l",
  RESET: "ctrl+shift+r",
  HELP: "f1",
} as const;

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

export function DocFormView({
  doctype,
  id,
  prefill,
  cbUrl,
  fromField,
  fromDoc,
  resetForm,
  mode = "edit",
}: DocFormViewProps) {
  // ===== ROUTER & STATE =====
  const { push, replace, pathname, location } = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { org } = useParams();
  // ===== AUTH & TRANSLATION =====
  const { roles, user } = useAuth();
  const { t } = useTranslation();

  // ===== DOCTYPE & DOC DATA =====
  const { doc: doctypeDoc } = useDocAll({
    doctype: "zodula__Doctype",
    id: doctype
  });

  const { doc, loading, error, reload, relatives } = useDoc(
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

  // ===== RELATIVES COUNT =====
  const {
    data: relativeCount,
    loading: relativeCountLoading,
    error: relativeCountError,
    reload: reloadRelativeCount,
  } = useAction(
    "zodula.core.count",
    {
      data: {
        docFilters: relatives.reduce(
          (acc, relative) => {
            acc[relative.child_doctype] = [
              [relative.child_field_name, "=", doc?.id],
            ];
            return acc;
          },
          {} as Record<string, [string, string, any][]>
        ),
      },
    },
    [doc, relatives]
  );

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
      limit: 1000000,
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

        processedFields[field.name] = {
          ...field,
          label: t(field.label || field.name || ""),
          // Set readonly based on update permission
          readonly: fieldReadonly ? 1 : (field.readonly || 0),
        };
      }
    });

    return processedFields;
  }, [fields, doctypeDoc, t, fieldPermissions, isOwn, roles, user]);

  // Compute formId based on mode and document ID
  const formId = useMemo(() => {
    if (mode === "create") {
      return `create-${doctype}`;
    }
    return `edit-${doctype}-${id || ""}`;
  }, [doctype, id, mode]);

  const { formData, handleChange, setValues, reset, getFormData } = useForm({
    formId,
    initialValues: undefined,
    fields: formFields,
  });

  // ===== FORM EFFECTS =====
  // Track previous doc ID to prevent unnecessary updates
  const prevDocIdRef = React.useRef<string | undefined>(undefined);
  
  React.useEffect(() => {
    if (mode === "edit" && doc) {
      const currentDocId = doc.id;
      
      // Only update form values if doc ID changed (new document loaded)
      // This prevents overwriting user input while typing
      if (prevDocIdRef.current !== currentDocId) {
        const valuesToSet = { ...doc };
        if (prefill) {
          Object.assign(valuesToSet, prefill);
        }
        setValues(valuesToSet);
        prevDocIdRef.current = currentDocId;
      }
    }
  }, [doc?.id, setValues, prefill, mode]);

  React.useEffect(() => {
    if (mode === "create" && fields && doctypeDoc) {
      const defaultValues: Record<string, any> = {};

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

      if (prefill) {
        Object.assign(defaultValues, prefill);
      }

      setValues(defaultValues);
    }
  }, [fields, doctypeDoc, setValues, prefill, mode, doctype]);

  // Handle form reset when resetForm prop is true
  React.useEffect(() => {
    if (resetForm && mode === "create") {
      reset();
      replace(pathname, { state: { ...location.state, resetForm: false } });
    }
  }, [resetForm, reset, mode]);

  // ===== EVENT HANDLERS =====
  const handleReload = () => {
    reload();
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

  const handlePrint = async () => {
    if (!id && doctypeDoc?.is_single !== 1) return;

    try {
      const result = await popup(
        PrintTemplateDialog,
        {
          title: "Select Print Template",
          description: `Choose a print template for ${doctypeDoc?.label} document with id ${id}`,
        },
        {
          doctype: doctype as Zodula.DoctypeName,
          docIds: [id || doctype],
          org: org || ""
        }
      );
    } catch (error) {
      console.error("Error opening print dialog:", error);
    }
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
        await zodula.doc.submit_doc(doctype, id || "").then(() => {
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
        await zodula.doc.cancel_doc(doctype, id || "").then(() => {
          reload();
        });
      }
    } catch (error) {
      console.error("Error canceling doc:", error);
    }
  };

  // Helper function to get changed fields and standard fields
  const getUpdatePayload = useCallback(() => {
    // Always get the latest form data directly from the store
    // This ensures we have the most current values even after ID changes
    const latestFormData = getFormData();

    if (!doc) {
      // For create mode, return all form data
      return latestFormData;
    }

    const standardFieldNames = Object.keys(ClientFieldHelper.standardFields());
    const changedFields: Record<string, any> = {};

    // Include all standard fields
    standardFieldNames.forEach((fieldName) => {
      if (latestFormData[fieldName] !== undefined) {
        changedFields[fieldName] = latestFormData[fieldName];
      }
    });

    // Get all field names from both doc and latestFormData
    const allFieldNames = new Set([
      ...Object.keys(latestFormData),
      ...Object.keys(doc as any)
    ]);

    // Include only changed non-standard fields
    allFieldNames.forEach((fieldName) => {
      if (standardFieldNames.includes(fieldName)) {
        return; // Skip standard fields (already handled above)
      }

      const oldValue = (doc as any)[fieldName];
      const newValue = latestFormData[fieldName];
      
      // Check if value has changed
      if (!valuesAreEqual(oldValue, newValue)) {
        changedFields[fieldName] = newValue;
      }
    });

    return changedFields;
  }, [getFormData, doc])

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

  // Helper function to compare values (handles different types)
  const valuesAreEqual = (val1: any, val2: any): boolean => {
    // Handle null/undefined
    if (val1 == null && val2 == null) return true;
    if (val1 == null || val2 == null) return false;
    
    // Handle arrays and objects
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      return JSON.stringify(val1) === JSON.stringify(val2);
    }
    
    // Handle primitive types
    return val1 === val2;
  };

  const handleSave = useCallback(async () => {
    const payload = getUpdatePayload();
    const updatedDoc = await zodula.doc.update_doc(doctype, id || "", payload);

    if (updatedDoc.id !== id && !isSingle) {
      // ID changed - navigate to new URL
      replace(`/desk/${org}/doctypes/${doctype}/form/${updatedDoc.id}`);
    } else {
      // ID unchanged - just reload
      reload();
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
      
      const createdDoc = await zodula.doc.create_doc(
        doctype as Zodula.DoctypeName,
        latestFormData
      );
      if (createdDoc) {
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
          replace(cbUrl, {
            state: {
              prefill: obj,
            },
          });
          reset();
        } else {
          reset();
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
        push(`/desk/${org}/doctypes/${doctype}/list`);
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
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modifierKey = isMac ? "Ctrl" : "Ctrl";

  // ===== SIDEBAR CONTENT =====
  const sidebarContent = (
    <div className="zd:space-y-6">
      {mode === "create" ? (
        /* New Doc Info */
        <div className="zd:space-y-3">
          <h3 className="zd:text-sm zd:font-medium zd:text-muted-foreground">
            New Document
          </h3>
          <div className="zd:space-y-2">
            <div className="zd:text-xs zd:text-muted-foreground">
              <div>Creating new {doctype} document</div>
              <div>Fill in the required fields and save to create</div>
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
              {relatives.map((relative) => {
                const filterQuery = encodeURIComponent(
                  `[["${relative.child_field_name}", "=", "${id}"]]`
                );
                return (
                  <Link
                    className="zd:text-xs zd:opacity-50 zd:hover:opacity-100"
                    to={`/desk/${org}/doctypes/${relative.child_doctype}/list?filters=${filterQuery}`}
                    key={relative.id}
                  >
                    {relative.child_doctype} (
                    {relativeCount?.results?.find(
                      (result: any) => result.doctype === relative.child_doctype
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
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ===== FORM STATE =====
  const isDirty = useMemo(() => {
    if (mode === "create") {
      return Object.values(formData).some(
        (value) => value !== undefined && value !== null && value !== ""
      );
    }
    const _isDirty = JSON.stringify(formData) !== JSON.stringify(doc);
    return _isDirty;
  }, [formData, doc, mode]);

  useEffect(() => {
    if (!isDirty) {
      handleReload();
    }
  }, []);

  // ===== KEYBOARD SHORTCUTS =====
  const shortcuts = [
    {
      keys: `${modifierKey} + S`,
      description: mode === "create" ? "Create" : "Save",
    },
    { keys: `${modifierKey} + U`, description: "Update" },
    { keys: `${modifierKey} + Enter`, description: "Submit" },
    { keys: `${modifierKey} + Shift + C`, description: "Cancel" },
    { keys: `${modifierKey} + Delete`, description: "Delete" },
    { keys: `${modifierKey} + D`, description: "Duplicate" },
    { keys: `${modifierKey} + R`, description: "Reload" },
    { keys: `${modifierKey} + P`, description: "Print" },
    { keys: `${modifierKey} + N`, description: "New" },
    { keys: `${modifierKey} + L`, description: "List" },
    { keys: "Escape", description: "Back to List" },
    // { keys: `${modifierKey} + Shift + R`, description: "Reset" },
  ];

  useCmd(
    KEYBOARD_SHORTCUTS.SAVE,
    mode === "create" ? handleCreate : handleSave,
    { disabled: isSystemGenerated }
  );
  useCmd(KEYBOARD_SHORTCUTS.UPDATE, handleUpdate, {
    disabled: isSystemGenerated,
  });
  useCmd(KEYBOARD_SHORTCUTS.SUBMIT, handleSubmit, {
    disabled: isSystemGenerated,
  });
  useCmd(KEYBOARD_SHORTCUTS.CANCEL, handleCancel, {
    disabled: isSystemGenerated,
  });
  useCmd(KEYBOARD_SHORTCUTS.DELETE, handleDelete, {
    disabled: isSystemGenerated,
  });
  useCmd(KEYBOARD_SHORTCUTS.DUPLICATE, handleDuplicate, {
    disabled: isSystemGenerated,
  });
  useCmd(KEYBOARD_SHORTCUTS.RELOAD, handleReload, {
    disabled: isSystemGenerated,
  });
  useCmd(KEYBOARD_SHORTCUTS.PRINT, handlePrint, {
    disabled: isSystemGenerated,
  });
  useCmd(
    KEYBOARD_SHORTCUTS.NEW,
    () =>
      push(`/desk/${org}/doctypes/${doctype}/form`, {
        state: { resetForm: true },
      }),
    { disabled: isSystemGenerated }
  );
  useCmd(
    KEYBOARD_SHORTCUTS.LIST,
    () => push(`/desk/${org}/doctypes/${doctype}/list`),
    { disabled: isSystemGenerated }
  );
  //   useCmd(KEYBOARD_SHORTCUTS.RESET, reset, { disabled: isSystemGenerated });
  useCmd(
    KEYBOARD_SHORTCUTS.HELP,
    async () => {
      popup(
        KeyboardShortcutsDialog,
        {
          title: "Keyboard Shortcuts",
          description: "Available keyboard shortcuts for this page",
        },
        {
          shortcuts,
        }
      );
    },
    { disabled: isSystemGenerated }
  );

  // ===== RENDER COMPONENTS =====
  const primaryButtonRender = useCallback(() => {
    if (mode === "create") {
      return (
        <Button
          onClick={handleCreate}
          disabled={isLoading || !isDirty}
          variant="solid"
        >
          <Save className="zd:w-4 zd:h-4 zd:mr-1" />
          {isLoading ? "Creating..." : "Create"}
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
          {t("Update")}
          <SaveIcon />
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
  }, [mode, isLoading, isDirty, doc?.doc_status, doctypeDoc?.is_submittable, handleSave, handleSubmit, handleUpdate, t]);

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

  if (mode === "edit" && error) {
    return (
      <NavbarLayout>
        <ErrorView message={error} status={500} />
      </NavbarLayout>
    );
  }

  if (mode === "edit" && !doc) {
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
              ? "New Document"
              : isSingle
                ? doctypeLabel
                : doc?.id || "New Doc"}
            <span className="zd:flex zd:gap-2 zd:items-center no-print">
              {doctypeDoc?.is_submittable === 1 && (
                <DocStatusBadge status={doc?.doc_status || 0} />
              )}
            </span>
          </div>
        }
        subtitle={isSingle ? "" : t(doctypeLabel)}
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
                  <Button variant="outline" onClick={handlePrint}>
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
              <KeyboardShortcuts shortcuts={shortcuts} />
              {primaryButtonRender()}
            </div>
          )
        }
      >
        {/* Form Content */}
        <div className="zd:flex zd:flex-col zd:gap-8">
          <Form
            translate
            debug={roles?.includes("System Admin") || false}
            docId={id || ""}
            readonly={doctypeDoc?.is_system_generated === 1}
            fields={formFields}
            values={formData}
            onChange={handleChange}
            doctype={doctype}
            tabs={doctypeDoc?.tabs ? JSON.parse(doctypeDoc.tabs) : []}
            enableScripts={true}
          />
          <div className="">
            <AuditTrail doctype={doctype} docId={id!} />
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
                  <span>
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
