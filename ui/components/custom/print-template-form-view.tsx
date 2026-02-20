import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { useParams } from "react-router";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { PrintTemplateBuilder } from "@/zodula/ui/components/custom/print-template-builder";
import type { PrintTemplateElement } from "@/zodula/ui/components/custom/print-template-builder";
import { itemToElement, elementToItemPayload, letterHeadItemToElement, elementToLetterHeadItemPayload } from "@/zodula/ui/components/custom/print-template-utils";
import { Button } from "@/zodula/ui/components/ui/button";
import { Input } from "@/zodula/ui/components/ui/input";
import { Select } from "@/zodula/ui/components/ui/select";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { Checkbox } from "@/zodula/ui/components/ui/checkbox";
import { zodula } from "@/zodula/client";
import { Save, ArrowLeft, Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/zodula/ui/components/ui/popover";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { BASE_URL } from "@/zodula/client/utils";

export type PrintTemplateFormViewType = "print_template" | "letter_head";

interface PrintTemplateFormViewProps {
  type: PrintTemplateFormViewType;
  docId?: string;
  onSave?: () => void;
}

export function PrintTemplateFormView({ type, docId, onSave }: PrintTemplateFormViewProps) {
  const { push, replace } = useRouter();
  const { org } = useParams();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  
  const isPrintTemplate = type === "print_template";
  const doctype = isPrintTemplate ? "Print Template" : "Letter Head";
  const itemDoctype = isPrintTemplate ? "Print Template Item" : "Letter Head Item";
  const listPath = `/desk/${org}/doctypes/${doctype}/list`;
  
  // Load doc if editing
  const { doc, loading, reload } = useDoc({
    doctype,
    id: docId || "",
  }, [docId]);

  // Form data state
  const [formData, setFormData] = useState<{
    name: string;
    doctype?: string;
    is_default?: 0 | 1;
    disabled?: 0 | 1;
    format?: "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid" | "Custom" | "210x30mm" | "30x30mm";
    custom_width?: number;
    custom_height?: number;
    margin_top?: number;
    margin_right?: number;
    margin_bottom?: number;
    margin_left?: number;
    align?: "left" | "middle" | "right";
    is_fixed_position?: 0 | 1;
    default_lang?: string;
    default_letter_head?: string;
  }>({
    name: "",
    doctype: "",
    is_default: 0,
    format: isPrintTemplate ? "A4" : "210x30mm",
    custom_width: 210,
    custom_height: isPrintTemplate ? 297 : 30,
    margin_top: 10,
    margin_right: 10,
    margin_bottom: 10,
    margin_left: 10,
    align: "left",
    is_fixed_position: 0,
  });
  
  const [layout, setLayout] = useState<PrintTemplateElement[]>([]);
  const [guidedBackground, setGuidedBackground] = useState<string | File | null>(null);
  
  // Track initial state for change detection
  const initialFormDataRef = useRef(formData);
  const initialLayoutRef = useRef<PrintTemplateElement[]>([]);
  const initialGuidedBackgroundRef = useRef<string | File | null>(null);

  // Store the URL id before save so we can replace the URL with the generated id after create
  const urlIdBeforeSaveRef = useRef<string | undefined>(undefined);
  
  // Get doctypes for selection (only for Print Template)
  const { docs: doctypes } = useDocList({
    doctype: "Doctype",
    limit: 10000,
    sort: "name",
    order: "asc",
  }, [isPrintTemplate]);

  // Get doctype field definition for FormControl
  const doctypeField = useMemo(() => {
    if (!isPrintTemplate) return null;
    return {
      type: "Reference",
      name: "doctype",
      label: t("Doctype"),
      reference: "Doctype",
      required: 1,
    };
  }, [isPrintTemplate, t]);

  // Get fields for selected doctype (only for Print Template)
  const { docs: fields } = useDocList({
    doctype: "Field",
    limit: 10000,
    sort: "idx",
    order: "asc",
    filters: formData.doctype ? [["doctype", "=", formData.doctype]] : [],
  }, [isPrintTemplate, formData.doctype]);

  // Initialize form data from doc
  useEffect(() => {
    if (docId && doc) {
      const newFormData: any = {
        name: doc.name || "",
        is_default: doc.is_default || 0,
        format: (doc.format as any) || (isPrintTemplate ? "A4" : "210x30mm"),
        custom_width: doc.custom_width || 210,
        custom_height: doc.custom_height || (isPrintTemplate ? 297 : 30),
        margin_top: doc.margin_top != null ? doc.margin_top : 10,
        margin_right: doc.margin_right != null ? doc.margin_right : 10,
        margin_bottom: doc.margin_bottom != null ? doc.margin_bottom : 10,
        margin_left: doc.margin_left != null ? doc.margin_left : 10,
      };
      
      if (isPrintTemplate) {
        newFormData.doctype = (doc as any).doctype || "";
        newFormData.is_fixed_position = (doc as any).is_fixed_position || 0;
        newFormData.default_lang = (doc as any).default_lang ?? "";
        newFormData.default_letter_head = (doc as any).default_letter_head ?? "";
      } else {
        newFormData.disabled = (doc as any).disabled || 0;
        newFormData.align = (doc as any).align || "left";
      }
      
      // Load guided background (for both Print Template and Letter Head)
      if (doc.guided_background && docId) {
        const bgUrl = `${BASE_URL}/files/${(doc as any)?.organization ?? org}/${doctype}/${docId}/guided_background/${doc.guided_background}`;
        setGuidedBackground(bgUrl);
        initialGuidedBackgroundRef.current = bgUrl;
      } else {
        setGuidedBackground(null);
        initialGuidedBackgroundRef.current = null;
      }
      
      setFormData(newFormData);
      initialFormDataRef.current = { ...newFormData };
      
      // Load items based on is_fixed_position
      // Default to 'items' for backward compatibility if is_fixed_position is not set
      const itemsField = newFormData.is_fixed_position === 1 ? 'fixed_position_items' : 'items';
      const items = (doc as any)[itemsField];
      if (items && Array.isArray(items) && items.length > 0) {
        const sortedItems = items.sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0));
        const elements = sortedItems.map((item: any) => isPrintTemplate ? itemToElement(item) : letterHeadItemToElement(item));
        
        // Fix group references: map group codes to group database ids
        // Create a mapping from code to database id for group elements (type: "anchor")
        const groupCodeToId = new Map<string, string>();
        elements.forEach((el) => {
          if (el.type === "anchor" && el.code) {
            // Map code to database id
            groupCodeToId.set(el.code, el.id);
            // Also map id to id (for backward compatibility)
            groupCodeToId.set(el.id, el.id);
          }
        });
        
        // Update children's group references from code to database id
        elements.forEach((el) => {
          if (el.group) {
            // Try to find the group by matching code
            const groupId = groupCodeToId.get(el.group);
            if (groupId) {
              // Update group reference to use the database id
              el.group = groupId;
            } else {
              // If not found by code, try to find by id (backward compatibility)
              const groupElement = elements.find((g) => 
                g.type === "anchor" && g.id === el.group
              );
              if (groupElement) {
                el.group = groupElement.id;
              }
            }
          }
        });
        
        setLayout(elements);
        initialLayoutRef.current = JSON.parse(JSON.stringify(elements));
      } else {
        setLayout([]);
        initialLayoutRef.current = [];
      }
    } else if (!docId) {
      // Reset for new doc
      const defaultFormData: any = {
        name: "",
        is_default: 0,
        format: isPrintTemplate ? "A4" : "210x30mm",
        custom_width: 210,
        custom_height: isPrintTemplate ? 297 : 30,
        margin_top: 10,
        margin_right: 10,
        margin_bottom: 10,
        margin_left: 10,
      };
      if (isPrintTemplate) {
        defaultFormData.doctype = "";
        defaultFormData.is_fixed_position = 0;
        defaultFormData.default_lang = "";
        defaultFormData.default_letter_head = "";
      } else {
        defaultFormData.align = "left";
      }
      setFormData(defaultFormData);
      initialFormDataRef.current = { ...defaultFormData };
      setLayout([]);
      initialLayoutRef.current = [];
      setGuidedBackground(null);
      initialGuidedBackgroundRef.current = null;
    }
  }, [doc, docId, isPrintTemplate, doctype]);

  // Track previous is_fixed_position to detect changes
  const prevIsFixedPositionRef = useRef<number | undefined>(undefined);
  
  // Handle switching between fixed and non-fixed position modes
  useEffect(() => {
    if (docId && doc && prevIsFixedPositionRef.current !== undefined && prevIsFixedPositionRef.current !== formData.is_fixed_position) {
      // Only reload when is_fixed_position actually changes (not on initial load)
      const itemsField = formData.is_fixed_position === 1 ? 'fixed_position_items' : 'items';
      const items = (doc as any)[itemsField];
      
      if (items && Array.isArray(items) && items.length > 0) {
        const sortedItems = items.sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0));
        const elements = sortedItems.map((item: any) => isPrintTemplate ? itemToElement(item) : letterHeadItemToElement(item));
        
        // Fix group references: map group codes to group database ids
        const groupCodeToId = new Map<string, string>();
        elements.forEach((el) => {
          if (el.type === "anchor" && el.code) {
            groupCodeToId.set(el.code, el.id);
            groupCodeToId.set(el.id, el.id);
          }
        });
        
        // Update children's group references from code to database id
        elements.forEach((el) => {
          if (el.group) {
            const groupId = groupCodeToId.get(el.group);
            if (groupId) {
              el.group = groupId;
            } else {
              const groupElement = elements.find((g) => 
                g.type === "anchor" && g.id === el.group
              );
              if (groupElement) {
                el.group = groupElement.id;
              }
            }
          }
        });
        
        setLayout(elements);
        initialLayoutRef.current = JSON.parse(JSON.stringify(elements));
      } else {
        setLayout([]);
        initialLayoutRef.current = [];
      }
    }
    // Update the ref after the effect runs
    prevIsFixedPositionRef.current = formData.is_fixed_position;
  }, [formData.is_fixed_position, docId, doc, isPrintTemplate]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!docId) {
      // For new docs, check if any field is filled
      return formData.name !== "" || 
             (isPrintTemplate && formData.doctype !== "") ||
             layout.length > 0;
    }
    
    // For existing docs, compare with initial state
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
    const layoutChanged = JSON.stringify(layout) !== JSON.stringify(initialLayoutRef.current);
    const guidedBackgroundChanged = guidedBackground !== initialGuidedBackgroundRef.current;
    
    return formChanged || layoutChanged || guidedBackgroundChanged;
  }, [formData, layout, guidedBackground, docId, isPrintTemplate]);

  const handleSave = async () => {
    if (!formData.name) {
      alert(t("Name is required"));
      return;
    }
    
    if (isPrintTemplate && !formData.doctype) {
      alert(t("Doctype is required"));
      return;
    }

    setIsSaving(true);
    try {
      if (docId) {
        urlIdBeforeSaveRef.current = docId;
        // Update existing doc - include items in payload so parent fields auto-populate
        const payload: any = { ...formData };
        if (isPrintTemplate) {
          payload.is_fixed_position = formData.is_fixed_position ?? 0;
          if (formData.default_lang !== undefined) payload.default_lang = formData.default_lang || null;
          if (formData.default_letter_head !== undefined) payload.default_letter_head = formData.default_letter_head || null;
        }

        // For Letter Head, include align field
        if (!isPrintTemplate && formData.align) {
          payload.align = formData.align;
        }
        
        // Handle guided background if it's a File (new upload) - for both Print Template and Letter Head
        if (guidedBackground instanceof File) {
          payload.guided_background = guidedBackground;
        }
        
        // Create a map from group id to group code for reference conversion
        const groupIdToCode = new Map<string, string>();
        layout.forEach((el) => {
          // Groups are elements with type "anchor" (or could be identified by having children)
          if (el.type === "anchor" && el.code) {
            groupIdToCode.set(el.id, el.code);
          }
        });
        
        // Convert layout elements to item payloads and include in main payload
        // Parent fields (parentid, parenttype, parentfield) will be auto-populated by the server
        // Convert group references from id to code before saving
        // Use the appropriate items field based on is_fixed_position
        const itemsField = payload.is_fixed_position === 1 ? 'fixed_position_items' : 'items';
        payload[itemsField] = layout.map((element, idx) => {
          // If element has a group reference, convert it from id to code
          const elementToSave = { ...element };
          if (elementToSave.group && groupIdToCode.has(elementToSave.group)) {
            elementToSave.group = groupIdToCode.get(elementToSave.group)!;
          }
          
          return isPrintTemplate
            ? elementToItemPayload(elementToSave, docId, idx)
            : elementToLetterHeadItemPayload(elementToSave, docId, idx);
        });
        
        // Clear the other items field to avoid confusion
        const otherItemsField = payload.is_fixed_position === 1 ? 'items' : 'fixed_position_items';
        payload[otherItemsField] = [];
        
        const updated = await zodula.doc.update_doc(doctype, docId, payload);
        if (updated?.id && updated.id !== docId) {
          // Server returned a new id (e.g. generated) – replace URL so we use the new id on next save
          if (onSave) onSave();
          replace(`/desk/${org}/doctypes/${doctype}/form/${updated.id}`);
        }else{
          if (onSave) onSave();
          await reload();
        }

      } else {
        // Create new doc - store current URL id so we can replace with generated id after save
        urlIdBeforeSaveRef.current = docId ?? undefined;
        const payload: any = { ...formData };
        if (isPrintTemplate) {
          payload.is_fixed_position = formData.is_fixed_position ?? 0;
          if (formData.default_lang !== undefined) payload.default_lang = formData.default_lang || null;
          if (formData.default_letter_head !== undefined) payload.default_letter_head = formData.default_letter_head || null;
        }

        // For Letter Head, include align field
        if (!isPrintTemplate && formData.align) {
          payload.align = formData.align;
        }
        
        // Handle guided background if it's a File (new upload) - for both Print Template and Letter Head
        if (guidedBackground instanceof File) {
          payload.guided_background = guidedBackground;
        }
        
        // Create a map from group id to group code for reference conversion
        const groupIdToCode = new Map<string, string>();
        layout.forEach((el) => {
          // Groups are elements with type "anchor" (or could be identified by having children)
          if (el.type === "anchor" && el.code) {
            groupIdToCode.set(el.id, el.code);
          }
        });
        
        // Include items in payload for new doc creation - parent fields will be auto-populated
        // Convert group references from id to code before saving
        // Use the appropriate items field based on is_fixed_position
        if (layout.length > 0) {
          const itemsField = payload.is_fixed_position === 1 ? 'fixed_position_items' : 'items';
          payload[itemsField] = layout.map((element, idx) => {
            // If element has a group reference, convert it from id to code
            const elementToSave = { ...element };
            if (elementToSave.group && groupIdToCode.has(elementToSave.group)) {
              elementToSave.group = groupIdToCode.get(elementToSave.group)!;
            }
            
            return isPrintTemplate
              ? elementToItemPayload(elementToSave, "", idx) // docId not needed for new docs
              : elementToLetterHeadItemPayload(elementToSave, "", idx);
          });
        }
        
        const created = await zodula.doc.create_doc(doctype, payload);
        if (created) {
          replace(`/desk/${org}/doctypes/${doctype}/form/${created.id}`);
          if (onSave) onSave();
        }
      }
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      alert(t(`Error saving ${isPrintTemplate ? "print template" : "letter head"}`));
    } finally {
      setIsSaving(false);
    }
  };

  if (docId && loading) {
    return (
      <NavbarLayout contentClassName="zd:p-0!" hideNavbar={true}>
        <div className="zd:flex zd:items-center zd:justify-center zd:h-64">
          <div className="zd:text-muted-foreground">{t("Loading...")}</div>
        </div>
      </NavbarLayout>
    );
  }

  if (docId && !doc) {
    return (
      <NavbarLayout contentClassName="zd:p-0!" hideNavbar={true}>
        <div className="zd:flex zd:items-center zd:justify-center zd:h-64">
          <div className="zd:text-muted-foreground">{t(`${isPrintTemplate ? "Print Template" : "Letter Head"} not found`)}</div>
        </div>
      </NavbarLayout>
    );
  }

  const title = docId 
    ? (doc?.name || t(isPrintTemplate ? "Print Template" : "Letter Head"))
    : t(isPrintTemplate ? "Create Print Template" : "Create Letter Head");

  return (
    <NavbarLayout contentClassName="zd:p-0!" hideNavbar={true}>
      <div className="zd:flex zd:flex-col zd:h-screen zd:overflow-hidden">
        {/* Header */}
        <div className="zd:bg-background zd:border-b zd:border-muted zd:px-4 zd:py-3 zd:flex zd:items-center zd:justify-between">
          <div className="zd:flex zd:items-center zd:gap-4">
            <Button
              variant="ghost"
              onClick={() => push(listPath)}
            >
              <ArrowLeft className="zd:w-4 zd:h-4" />
            </Button>
            <h1 className="zd:text-xl zd:font-semibold">{title}</h1>
          </div>
          <div className="zd:flex zd:items-center zd:gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" title={t("Options")} className="zd:p-2">
                  <Settings className="zd:w-4 zd:h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="zd:w-80 zd:max-h-[85vh] zd:overflow-y-auto" align="end">
                <div className="zd:space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="zd:space-y-2">
                    <label className="zd:text-sm zd:font-medium">{t("Format")}</label>
                    <Select
                      value={formData.format || "A4"}
                      onChange={(value) => setFormData({ ...formData, format: value as any })}
                      options={
                        isPrintTemplate
                          ? [
                              { value: "A4", label: "A4" },
                              { value: "A3", label: "A3" },
                              { value: "A5", label: "A5" },
                              { value: "Letter", label: "Letter" },
                              { value: "Legal", label: "Legal" },
                              { value: "Tabloid", label: "Tabloid" },
                              { value: "Custom", label: "Custom" },
                            ]
                          : [
                              { value: "210x30mm", label: "210x30mm" },
                              { value: "30x30mm", label: "30x30mm" },
                              { value: "Custom", label: "Custom" },
                            ]
                      }
                      className="zd:w-full"
                    />
                  </div>
                  {formData.format === "Custom" && (
                    <div className="zd:grid zd:grid-cols-2 zd:gap-2">
                      <div className="zd:space-y-1">
                        <label className="zd:text-sm zd:font-medium">{t("Width (mm)")}</label>
                        <Input
                          type="number"
                          value={formData.custom_width || 210}
                          onChange={(e) => setFormData({ ...formData, custom_width: Number(e.target.value) })}
                          className="zd:w-full"
                        />
                      </div>
                      <div className="zd:space-y-1">
                        <label className="zd:text-sm zd:font-medium">{t("Height (mm)")}</label>
                        <Input
                          type="number"
                          value={formData.custom_height || (isPrintTemplate ? 297 : 30)}
                          onChange={(e) => setFormData({ ...formData, custom_height: Number(e.target.value) })}
                          className="zd:w-full"
                        />
                      </div>
                    </div>
                  )}
                  <div className="zd:space-y-2">
                    <label className="zd:text-sm zd:font-medium">{t("Margins (mm)")}</label>
                    <div className="zd:grid zd:grid-cols-4 zd:gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={formData.margin_top ?? 10}
                        onChange={(e) => setFormData({ ...formData, margin_top: Number(e.target.value) })}
                        className="zd:w-full"
                        placeholder={t("Top")}
                        title={t("Top")}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={formData.margin_right ?? 10}
                        onChange={(e) => setFormData({ ...formData, margin_right: Number(e.target.value) })}
                        className="zd:w-full"
                        placeholder={t("Right")}
                        title={t("Right")}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={formData.margin_bottom ?? 10}
                        onChange={(e) => setFormData({ ...formData, margin_bottom: Number(e.target.value) })}
                        className="zd:w-full"
                        placeholder={t("Bottom")}
                        title={t("Bottom")}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={formData.margin_left ?? 10}
                        onChange={(e) => setFormData({ ...formData, margin_left: Number(e.target.value) })}
                        className="zd:w-full"
                        placeholder={t("Left")}
                        title={t("Left")}
                      />
                    </div>
                  </div>
                  {isPrintTemplate && (
                    <div className="zd:flex zd:items-center zd:space-x-2">
                      <Checkbox
                        checked={formData.is_fixed_position === 1}
                        onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_fixed_position: checked === true ? 1 : 0 })}
                      />
                      <label className="zd:text-sm zd:font-medium">{t("Use fixed position (arrange by index)")}</label>
                    </div>
                  )}
                  {isPrintTemplate && (
                    <div className="zd:space-y-2 zd:pt-2 zd:border-t zd:border-border">
                      <label className="zd:text-sm zd:font-medium">{t("Defaults")}</label>
                      <div className="zd:flex zd:items-center zd:space-x-2 zd:mb-2">
                        <Checkbox
                          checked={formData.is_default === 1}
                          onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_default: checked === true ? 1 : 0 })}
                        />
                        <label className="zd:text-sm">{t("Set as default template for this doctype")}</label>
                      </div>
                      <div className="zd:space-y-1">
                        <label className="zd:text-xs zd:text-muted-foreground">{t("Default Language")}</label>
                        <FormControl
                          field={{
                            type: "Reference",
                            name: "default_lang",
                            label: t("Default Language"),
                            reference: "Language",
                            description: "Default language to use when printing with this template",
                          }}
                          fieldKey="default_lang"
                          value={formData.default_lang ?? ""}
                          onChange={(_, value) => setFormData({ ...formData, default_lang: value ?? "" })}
                          hideFormControl={true}
                        />
                      </div>
                      <div className="zd:space-y-1">
                        <label className="zd:text-xs zd:text-muted-foreground">{t("Default Letter Head")}</label>
                        <FormControl
                          field={{
                            type: "Reference",
                            name: "default_letter_head",
                            label: t("Default Letter Head"),
                            reference: "Letter Head",
                            description: "Default letter head to use when printing with this template",
                          }}
                          fieldKey="default_letter_head"
                          value={formData.default_letter_head ?? ""}
                          onChange={(_, value) => setFormData({ ...formData, default_letter_head: value ?? "" })}
                          hideFormControl={true}
                        />
                      </div>
                    </div>
                  )}
                  {!isPrintTemplate && (
                    <div className="zd:space-y-2">
                      <label className="zd:text-sm zd:font-medium">{t("Alignment")}</label>
                      <Select
                        value={formData.align || "left"}
                        onChange={(value) => setFormData({ ...formData, align: value as "left" | "middle" | "right" })}
                        options={[
                          { value: "left", label: t("Left") },
                          { value: "middle", label: t("Middle") },
                          { value: "right", label: t("Right") },
                        ]}
                        className="zd:w-full"
                      />
                    </div>
                  )}
                  <div className="zd:space-y-2 zd:pt-2 zd:border-t zd:border-border">
                    <label className="zd:text-sm zd:font-medium">{t("Guided Background")}</label>
                    <FormControl
                      field={{
                        type: "File",
                        name: "guided_background",
                        label: t("Guided Background"),
                        doctype,
                        accept: "image/*",
                      }}
                      fieldKey="guided_background"
                      value={guidedBackground ?? ""}
                      onChange={(_fieldName, value) => setGuidedBackground((value as string | File | null) ?? null)}
                      docId={docId}
                      formData={{ organization: org }}
                      hideFormControl={true}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="zd:w-4 zd:h-4 zd:mr-2" />
              {t("Save")}
            </Button>
          </div>
        </div>

        {/* Form Fields - Name and Doctype only */}
        <div className="zd:bg-background zd:border-b zd:border-muted zd:px-4 zd:py-3 zd:flex zd:items-center zd:gap-4 zd:flex-wrap">
          <div className="zd:flex zd:items-center zd:gap-2">
            <label className="zd:text-sm zd:font-medium zd:w-24">{t("Name")}:</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="zd:w-48"
              placeholder={t(isPrintTemplate ? "Template Name" : "Letter Head Name")}
            />
          </div>
          {isPrintTemplate && doctypeField && (
            <div className="zd:flex zd:items-center zd:gap-2">
              <label className="zd:text-sm zd:font-medium zd:w-24">{t("Doctype")}:</label>
              <div className="zd:w-48">
                <FormControl
                  field={doctypeField}
                  fieldKey="doctype"
                  value={formData.doctype}
                  onChange={(fieldName, value) => {
                    setFormData({ ...formData, doctype: value });
                  }}
                  hideFormControl={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Builder */}
        {isPrintTemplate ? (
          formData.doctype ? (
            <div className="zd:flex-1 zd:overflow-hidden">
              <PrintTemplateBuilder
                layout={layout}
                onChange={setLayout}
                doctype={formData.doctype}
                fields={fields as any}
                format={formData.format}
                customWidth={formData.format === "Custom" ? formData.custom_width : undefined}
                customHeight={formData.format === "Custom" ? formData.custom_height : undefined}
                marginTop={formData.margin_top}
                marginRight={formData.margin_right}
                marginBottom={formData.margin_bottom}
                marginLeft={formData.margin_left}
                guidedBackground={guidedBackground || undefined}
                onGuidedBackgroundChange={(background) => setGuidedBackground(background)}
                onFormatChange={(format) => setFormData({ ...formData, format })}
                onCustomSizeChange={(width, height) => setFormData({ ...formData, custom_width: width, custom_height: height })}
                onMarginsChange={(margins) => setFormData({ ...formData, margin_top: margins.top, margin_right: margins.right, margin_bottom: margins.bottom, margin_left: margins.left })}
                onFixedPositionChange={(value) => setFormData({ ...formData, is_fixed_position: value ? 1 : 0 })}
                templateId={docId}
                organization={org}
                isFixedPosition={formData.is_fixed_position === 1}
                showSettingsInToolbar={false}
              />
            </div>
          ) : (
            <div className="zd:flex-1 zd:flex zd:items-center zd:justify-center zd:bg-muted/30">
              <div className="zd:text-center zd:text-muted-foreground">
                <p className="zd:text-lg zd:mb-2">{t("Select a doctype to start building")}</p>
                <p className="zd:text-sm">{t("Choose a doctype from the dropdown above to begin creating your print template")}</p>
              </div>
            </div>
          )
        ) : (
          <div className="zd:flex-1 zd:overflow-hidden">
            <PrintTemplateBuilder
              layout={layout}
              onChange={setLayout}
              readonly={false}
              format={formData.format}
              customWidth={formData.format === "Custom" ? formData.custom_width : undefined}
              customHeight={formData.format === "Custom" ? formData.custom_height : undefined}
              marginTop={formData.margin_top}
              marginRight={formData.margin_right}
              marginBottom={formData.margin_bottom}
              marginLeft={formData.margin_left}
              guidedBackground={guidedBackground || undefined}
              onGuidedBackgroundChange={(background) => setGuidedBackground(background)}
              onFormatChange={(format) => setFormData({ ...formData, format })}
              onCustomSizeChange={(width, height) => setFormData({ ...formData, custom_width: width, custom_height: height })}
              onMarginsChange={(margins) => setFormData({ ...formData, margin_top: margins.top, margin_right: margins.right, margin_bottom: margins.bottom, margin_left: margins.left })}
              templateId={docId}
              organization={org}
              isLetterHead={true}
              letterHeadAlign={(formData.align as "left" | "middle" | "right") || "left"}
              onLetterHeadAlignChange={(align) => setFormData({ ...formData, align })}
              showSettingsInToolbar={false}
            />
          </div>
        )}
      </div>
    </NavbarLayout>
  );
}

