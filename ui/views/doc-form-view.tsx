import React, { useState, useMemo, useEffect } from "react";
import { Link, useRouter } from "@/zodula/ui/components/router";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
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

const UserLink = ({ userId, name }: { userId: string; name: string }) => {
  return (
    <Link
      to={`/desk/doctypes/zodula__User/form/${userId}`}
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

  // ===== AUTH & TRANSLATION =====
  const { roles } = useAuth();
  const { t } = useTranslation();

  // ===== DOCTYPE & DOC DATA =====
  const { doc: doctypeDoc } = useDoc(
    {
      doctype: "zodula__Doctype",
      id: doctype,
    },
    [doctype]
  );

  const { doc, loading, error, reload, relatives } = useDoc(
    {
      doctype: doctype as Zodula.DoctypeName,
      id: id,
    },
    [id, doctype, doctypeDoc, mode]
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
  const { docs: fields, reload: reloadFields } = useDocList(
    {
      doctype: "zodula__Field",
      limit: 1000000,
      sort: "idx",
      order: "asc",
      filters: [["doctype", "=", doctype]],
    },
    [doctypeDoc]
  );

  // ===== FORM LOGIC =====
  const formFields = useMemo(() => {
    if (!fields || !doctypeDoc) return {};

    const processedFields: Record<string, any> = {};

    fields.forEach((field) => {
      if (field.doctype === doctype) {
        if (!field.name) {
          return;
        }
        if (
          Object.keys(ClientFieldHelper.standardFields()).includes(field.name)
        )
          return {};
        processedFields[field.name] = {
          ...field,
          label: t(field.label || field.name || ""),
        };
      }
    });

    return processedFields;
  }, [fields, doctypeDoc, t]);

  const formId = useMemo(() => {
    return mode === "create" ? `new-${doctype}` : `edit-${doctype}-${id}`;
  }, [doctype, id, mode]);

  const { formData, handleChange, setValues, reset } = useForm({
    formId: `${mode === "create" ? "create" : "edit"}-${doctype}-${formId}`,
    initialValues: mode === "create" ? undefined : doc || undefined,
    fields: formFields,
  });

  // ===== FORM EFFECTS =====
  React.useEffect(() => {
    if (mode === "edit" && doc) {
      const valuesToSet = { ...doc };
      if (prefill) {
        Object.assign(valuesToSet, prefill);
      }
      setValues(valuesToSet);
    }
  }, [doc, setValues, prefill, formId, mode]);

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
            defaultValues[field.name] = field.default;
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
      if (field.doctype === doctype && field.name && field.no_copy !== 1) {
        const fieldValue = (doc as Record<string, any>)[field.name];
        if (fieldValue !== undefined && fieldValue !== null) {
          prefillData[field.name] = fieldValue;
        }
      }
    });

    push(`/desk/doctypes/${doctype}/form`, {
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

  const handleUpdate = async () => {
    try {
      const payload = getUpdatePayload();
      await zodula.doc.update_doc(doctype, id || "", payload);
      reload();
    } finally {
      // Handle completion
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

  const handleSave = async () => {
    const payload = getUpdatePayload();
    const updatedDoc = await zodula.doc.update_doc(doctype, id || "", payload);

    if (updatedDoc.id !== id && !isSingle) {
      replace(`/desk/doctypes/${doctype}/form/${updatedDoc.id}`);
    } else {
      reload();
    }
  };

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
      const createdDoc = await zodula.doc.create_doc(
        doctype as Zodula.DoctypeName,
        formData
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
          push(cbUrl, {
            state: {
              prefill: obj,
            },
          });
          reset();
        } else {
          reset();
          replace(`/desk/doctypes/${doctype}/form/${createdDoc.id}`);
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
        push(`/desk/doctypes/${doctype}/list`);
      } catch (error) {
        console.error("Error deleting doc:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Helper function to get changed fields and standard fields
  const getUpdatePayload = () => {
    if (!doc) return formData;

    const standardFieldNames = Object.keys(ClientFieldHelper.standardFields());
    const changedFields: Record<string, any> = {};

    // Include all standard fields
    standardFieldNames.forEach((fieldName) => {
      if (formData[fieldName] !== undefined) {
        changedFields[fieldName] = formData[fieldName];
      }
    });

    // Include only changed non-standard fields
    Object.keys(formData).forEach((fieldName) => {
      if (
        !standardFieldNames.includes(fieldName) &&
        formData[fieldName] !== (doc as any)[fieldName]
      ) {
        changedFields[fieldName] = formData[fieldName];
      }
    });

    return changedFields;
  };

  // ===== COMPUTED VALUES =====
  const isSingle = doctypeDoc?.is_single === 1;
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
          <h3 className="zd:text-sm zd:font-medium zd:text-muted-foreground">
            Relatives
          </h3>
          <div className="zd:flex zd:flex-col zd:gap-2">
            {relatives.map((relative) => {
              const filterQuery = encodeURIComponent(
                `[["${relative.child_field_name}", "=", "${id}"]]`
              );
              return (
                <Link
                  className="zd:text-xs zd:opacity-50 zd:hover:opacity-100"
                  to={`/desk/doctypes/${relative.child_doctype}/list?filters=${filterQuery}`}
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
      push(`/desk/doctypes/${doctype}/form`, { state: { resetForm: true } }),
    { disabled: isSystemGenerated }
  );
  useCmd(
    KEYBOARD_SHORTCUTS.LIST,
    () => push(`/desk/doctypes/${doctype}/list`),
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
  const primaryButtonRender = () => {
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
    } else if (doc?.doc_status === 0) {
      return (
        <Button onClick={handleSave} className="zd:h-8" disabled={!isDirty}>
          <SaveIcon />
          {t("Save")}{" "}
        </Button>
      );
    }
  };

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
                      <DropdownMenuItem onClick={handleDuplicate}>
                        <Copy className="zd:w-4 zd:h-4 zd:mr-1" />
                        <span className="zd:flex-1">{t("Duplicate")}</span>
                        <kbd className="zd:ml-2 zd:px-1 zd:py-0.5 zd:text-xs zd:bg-muted zd:rounded">
                          Ctrl + D
                        </kbd>
                      </DropdownMenuItem>
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
                  <UserLink
                    userId={doc.updated_by}
                    name={getUserName(doc.updated_by) || doc.updated_by}
                  />
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
