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
import { zodula } from "@/zodula/client";
import { Save, ArrowLeft } from "lucide-react";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

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
  const doctype = isPrintTemplate ? "zodula__Print Template" : "zodula__Letter Head";
  const itemDoctype = isPrintTemplate ? "zodula__Print Template Item" : "zodula__Letter Head Item";
  const listPath = `/desk/${org}/doctypes/${doctype}/list`;
  
  // Load doc if editing
  const { doc, loading, reload } = useDoc({
    doctype,
    id: docId,
  }, [docId]);

  // Form data state
  const [formData, setFormData] = useState<{
    name: string;
    doctype?: string;
    is_default?: 0 | 1;
    disabled?: 0 | 1;
    format?: "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid" | "Custom";
    custom_width?: number;
    custom_height?: number;
    margin_top?: number;
    margin_right?: number;
    margin_bottom?: number;
    margin_left?: number;
  }>({
    name: "",
    doctype: "",
    is_default: 0,
    format: "A4",
    custom_width: 210,
    custom_height: 297,
    margin_top: 10,
    margin_right: 10,
    margin_bottom: 10,
    margin_left: 10,
  });
  
  const [layout, setLayout] = useState<PrintTemplateElement[]>([]);
  const [css, setCss] = useState("");
  
  // Track initial state for change detection
  const initialFormDataRef = useRef(formData);
  const initialLayoutRef = useRef<PrintTemplateElement[]>([]);
  const initialCssRef = useRef("");
  
  // Get doctypes for selection (only for Print Template)
  const { docs: doctypes } = useDocList({
    doctype: "zodula__Doctype",
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
      reference: "zodula__Doctype",
      required: 1,
    };
  }, [isPrintTemplate, t]);

  // Get fields for selected doctype (only for Print Template)
  const { docs: fields } = useDocList({
    doctype: "zodula__Field",
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
        disabled: doc.disabled || 0,
      };
      
      if (isPrintTemplate) {
        newFormData.doctype = doc.doctype || "";
        newFormData.format = (doc.format as any) || "A4";
        newFormData.custom_width = doc.custom_width || 210;
        newFormData.custom_height = doc.custom_height || 297;
        newFormData.margin_top = doc.margin_top || 10;
        newFormData.margin_right = doc.margin_right || 10;
        newFormData.margin_bottom = doc.margin_bottom || 10;
        newFormData.margin_left = doc.margin_left || 10;
      } else {
        setCss(doc.css_content || "");
      }
      
      setFormData(newFormData);
      initialFormDataRef.current = { ...newFormData };
      
      // Load items
      if (doc.items && Array.isArray(doc.items) && doc.items.length > 0) {
        const elements = doc.items
          .sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0))
          .map(isPrintTemplate ? itemToElement : letterHeadItemToElement);
        setLayout(elements);
        initialLayoutRef.current = JSON.parse(JSON.stringify(elements));
      } else {
        setLayout([]);
        initialLayoutRef.current = [];
      }
      
      if (!isPrintTemplate) {
        initialCssRef.current = doc.css_content || "";
      }
    } else if (!docId) {
      // Reset for new doc
      const defaultFormData: any = {
        name: "",
        is_default: 0,
        format: "A4",
        custom_width: 210,
        custom_height: 297,
        margin_top: 10,
        margin_right: 10,
        margin_bottom: 10,
        margin_left: 10,
      };
      if (isPrintTemplate) {
        defaultFormData.doctype = "";
      }
      setFormData(defaultFormData);
      initialFormDataRef.current = { ...defaultFormData };
      setLayout([]);
      initialLayoutRef.current = [];
      setCss("");
      initialCssRef.current = "";
    }
  }, [doc, docId, isPrintTemplate]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!docId) {
      // For new docs, check if any field is filled
      return formData.name !== "" || 
             (isPrintTemplate && formData.doctype !== "") ||
             layout.length > 0 ||
             (!isPrintTemplate && css !== "");
    }
    
    // For existing docs, compare with initial state
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
    const layoutChanged = JSON.stringify(layout) !== JSON.stringify(initialLayoutRef.current);
    const cssChanged = !isPrintTemplate && css !== initialCssRef.current;
    
    return formChanged || layoutChanged || cssChanged;
  }, [formData, layout, css, docId, isPrintTemplate]);

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
        // Update existing doc
        const payload: any = { ...formData };
        if (!isPrintTemplate) {
          payload.css_content = css || "";
        }
        
        await zodula.doc.update_doc(doctype, docId, payload);

        // Save items
        {
          // Get current items
          const { docs: currentItems } = await zodula.doc.select_docs(itemDoctype, {
            filters: [[isPrintTemplate ? "print_template" : "letter_head", "=", docId]],
            limit: 10000,
            sort: "idx",
            order: "asc",
          });

          const currentItemIds = new Set(currentItems.map((item) => item.id));
          const newItemIds = new Set(layout.map((el) => el.id));

          // Delete removed items
          const itemsToDelete = currentItems.filter((item) => !newItemIds.has(item.id));
          if (itemsToDelete.length > 0) {
            for (const item of itemsToDelete) {
              await zodula.doc.delete_doc(itemDoctype, item.id);
            }
          }

          // Create or update items
          const itemsToCreate: any[] = [];
          const itemsToUpdate: Array<{ id: string; payload: any }> = [];

          layout.forEach((element, idx) => {
            const payload = isPrintTemplate
              ? elementToItemPayload(element, docId, idx)
              : elementToLetterHeadItemPayload(element, docId, idx);
            if (currentItemIds.has(element.id)) {
              // Update existing item
              const key = isPrintTemplate ? "print_template" : "letter_head";
              const { [key]: _, ...updatePayload } = payload;
              itemsToUpdate.push({ id: element.id, payload: updatePayload });
            } else {
              // Create new item
              itemsToCreate.push(payload);
            }
          });

          // Create new items
          if (itemsToCreate.length > 0) {
            const created = await zodula.doc.create_docs(itemDoctype, itemsToCreate);
            // Update layout with new IDs
            if (created && created.length > 0) {
              let newItemCounter = 0;
              const finalLayout = layout.map((el) => {
                if (!currentItemIds.has(el.id)) {
                  if (newItemCounter < created.length) {
                    const newId = created[newItemCounter]?.id;
                    if (newId) {
                      newItemCounter++;
                      return { ...el, id: newId };
                    }
                  }
                }
                return el;
              });
              setLayout(finalLayout);
            }
          }

          // Update existing items
          for (const { id: itemId, payload } of itemsToUpdate) {
            await zodula.doc.update_doc(itemDoctype, itemId, payload);
          }
        }

        await reload();
        if (onSave) onSave();
      } else {
        // Create new doc
        const payload: any = { ...formData };
        if (!isPrintTemplate) {
          payload.css_content = css || "";
        }
        
        const created = await zodula.doc.create_doc(doctype, payload);
        if (created) {
          // Save items
          if (layout.length > 0) {
            const itemsToCreate = layout.map((element, idx) =>
              isPrintTemplate
                ? elementToItemPayload(element, created.id, idx)
                : elementToLetterHeadItemPayload(element, created.id, idx)
            );
            await zodula.doc.create_docs(itemDoctype, itemsToCreate);
          }
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
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="zd:w-4 zd:h-4 zd:mr-2" />
              {t("Save")}
            </Button>
          </div>
        </div>

        {/* Form Fields */}
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
          
          {isPrintTemplate && (
            <>
              <div className="zd:flex zd:items-center zd:gap-2">
                <label className="zd:text-sm zd:font-medium zd:w-24">{t("Format")}:</label>
                <Select
                  value={formData.format || "A4"}
                  onChange={(value) => setFormData({ ...formData, format: value as any })}
                  options={[
                    { value: "A4", label: "A4" },
                    { value: "A3", label: "A3" },
                    { value: "A5", label: "A5" },
                    { value: "Letter", label: "Letter" },
                    { value: "Legal", label: "Legal" },
                    { value: "Tabloid", label: "Tabloid" },
                    { value: "Custom", label: "Custom" },
                  ]}
                  className="zd:w-32"
                />
              </div>
              {formData.format === "Custom" && (
                <>
                  <div className="zd:flex zd:items-center zd:gap-2">
                    <label className="zd:text-sm zd:font-medium">{t("Width (mm)")}:</label>
                    <Input
                      type="number"
                      value={formData.custom_width || 210}
                      onChange={(e) => setFormData({ ...formData, custom_width: Number(e.target.value) })}
                      className="zd:w-24"
                    />
                  </div>
                  <div className="zd:flex zd:items-center zd:gap-2">
                    <label className="zd:text-sm zd:font-medium">{t("Height (mm)")}:</label>
                    <Input
                      type="number"
                      value={formData.custom_height || 297}
                      onChange={(e) => setFormData({ ...formData, custom_height: Number(e.target.value) })}
                      className="zd:w-24"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Builder */}
        {isPrintTemplate ? (
          <div className="zd:flex-1 zd:overflow-hidden">
            <PrintTemplateBuilder
              layout={layout}
              onChange={setLayout}
              doctype={formData.doctype}
              fields={fields as any}
              format={formData.format}
              customWidth={formData.format === "Custom" ? formData.custom_width : undefined}
              customHeight={formData.format === "Custom" ? formData.custom_height : undefined}
            />
          </div>
        ) : (
          <div className="zd:flex zd:flex-col zd:flex-1 zd:overflow-hidden">
            <div className="zd:flex-1 zd:overflow-hidden">
              <PrintTemplateBuilder
                layout={layout}
                onChange={setLayout}
                readonly={false}
              />
            </div>
            <div className="zd:border-t zd:bg-background zd:p-4">
              <div className="zd:mb-2">
                <label className="zd:text-sm zd:font-medium">{t("Custom CSS")}:</label>
              </div>
              <textarea
                value={css}
                onChange={(e) => setCss(e.target.value)}
                className="zd:w-full zd:h-32 zd:p-4 zd:font-mono zd:text-sm zd:border zd:rounded"
                placeholder={t("Enter CSS styles...")}
              />
            </div>
          </div>
        )}
      </div>
    </NavbarLayout>
  );
}

