import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { zodula } from "@/zodula/client";
import { ZodulaHtmlBuilder } from "@/zodula/ui/components/custom/zodula-html-builder";
import { PrintTemplateBuilder } from "@/zodula/ui/components/custom/print-template-builder";
import type { PrintTemplateBuilderItem } from "@/zodula/ui/components/custom/print-template-builder/types";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout } from "@/zodula/ui/layout/sidebar-layout";
import { Button } from "@/zodula/ui/components/ui/button";
import { Input } from "@/zodula/ui/components/ui/input";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { Select } from "@/zodula/ui/components/ui/select";
import { Checkbox } from "@/zodula/ui/components/ui/checkbox";
import { popup } from "@/zodula/ui/components/ui/popit";
import { toast } from "@/zodula/ui/components/ui/toast";
import { Settings } from "lucide-react";

const PAGE_FORMAT_OPTIONS = [
  { value: "A4", label: "A4" },
  { value: "A3", label: "A3" },
  { value: "A5", label: "A5" },
  { value: "Letter", label: "Letter" },
  { value: "Legal", label: "Legal" },
  { value: "Tabloid", label: "Tabloid" },
  { value: "Custom", label: "Custom" },
];

export interface PrintTemplateSettingsValues {
  name: string;
  sectionTitle: string;
  docNameExpression: string;
  format: string;
  customWidth: number | "";
  customHeight: number | "";
  marginTop: number | "";
  marginRight: number | "";
  marginBottom: number | "";
  marginLeft: number | "";
  isDefault: boolean;
  defaultLetterHead: string;
  defaultLanguage: string;
}

function PrintTemplateSettingsPopup({
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: (result?: PrintTemplateSettingsValues) => void;
  initialData?: { org?: string; values: PrintTemplateSettingsValues; onApply: (v: PrintTemplateSettingsValues) => void };
}) {
  const { org, values: initial, onApply } = initialData ?? { org: "", values: null as any, onApply: () => { } };
  const [name, setName] = React.useState(initial?.name ?? "");
  const [format, setFormat] = React.useState(initial?.format ?? "A4");
  const [customWidth, setCustomWidth] = React.useState<number | "">(initial?.customWidth ?? "");
  const [customHeight, setCustomHeight] = React.useState<number | "">(initial?.customHeight ?? "");
  const [marginTop, setMarginTop] = React.useState<number | "">(initial?.marginTop ?? 10);
  const [marginRight, setMarginRight] = React.useState<number | "">(initial?.marginRight ?? 10);
  const [marginBottom, setMarginBottom] = React.useState<number | "">(initial?.marginBottom ?? 10);
  const [marginLeft, setMarginLeft] = React.useState<number | "">(initial?.marginLeft ?? 10);
  const [isDefault, setIsDefault] = React.useState(initial?.isDefault ?? false);
  const [defaultLetterHead, setDefaultLetterHead] = React.useState(initial?.defaultLetterHead ?? "");
  const [defaultLanguage, setDefaultLanguage] = React.useState(initial?.defaultLanguage ?? "");
  React.useEffect(() => {
    if (initial) {
      setName(initial.name ?? "");
      setFormat(initial.format ?? "A4");
      setCustomWidth(initial.customWidth ?? "");
      setCustomHeight(initial.customHeight ?? "");
      setMarginTop(initial.marginTop ?? 10);
      setMarginRight(initial.marginRight ?? 10);
      setMarginBottom(initial.marginBottom ?? 10);
      setMarginLeft(initial.marginLeft ?? 10);
      setIsDefault(initial.isDefault ?? false);
      setDefaultLetterHead(initial.defaultLetterHead ?? "");
      setDefaultLanguage(initial.defaultLanguage ?? "");
    }
  }, [initial?.name, initial?.format, initial?.customWidth, initial?.customHeight, initial?.marginTop, initial?.marginRight, initial?.marginBottom, initial?.marginLeft, initial?.isDefault, initial?.defaultLetterHead, initial?.defaultLanguage]);
  const handleApply = () => {
    onApply({
      name: (name.trim() || initial?.name) ?? "",
      sectionTitle: initial?.sectionTitle ?? "Document",
      docNameExpression: initial?.docNameExpression ?? "{{ doc.id }}",
      format,
      customWidth,
      customHeight,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      isDefault,
      defaultLetterHead,
      defaultLanguage,
    });
    onClose();
  };
  return (
    <div className="zd:flex zd:flex-col zd:gap-6">
      {/* General */}
      <section className="zd:space-y-3">
        <h3 className="zd:text-sm zd:font-medium zd:text-foreground zd:border-b zd:border-border zd:pb-1.5">General</h3>
        <div className="zd:flex zd:items-center zd:gap-3">
          <FormControl label="Name" fieldKey="name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="zd:w-full" placeholder="Template name" />
          </FormControl>
          <FormControl
            label="Is Default"
            fieldKey="is_default"
            field={{ type: "Check", label: "Is Default" }}
            value={isDefault ? 1 : 0}
            onChange={(_k, v) => setIsDefault(v === 1 || v === true)}
          />
        </div>
      </section>

      {/* Defaults */}
      <section className="zd:space-y-3">
        <h3 className="zd:text-sm zd:font-medium zd:text-foreground zd:border-b zd:border-border zd:pb-1.5">Defaults</h3>
        <div className="zd:grid zd:grid-cols-1 zd:gap-3">
          <FormControl
            label="Default Letter Head"
            fieldKey="default_letter_head"
            field={{ type: "Reference", reference: "Letter Head" }}
            value={defaultLetterHead}
            onChange={(_k, v) => setDefaultLetterHead(v ?? "")}
            org={org}
          />
          <FormControl
            label="Default Language"
            fieldKey="default_language"
            field={{ type: "Reference", reference: "Language" }}
            value={defaultLanguage}
            onChange={(_k, v) => setDefaultLanguage(v ?? "")}
            org={org}
          />
        </div>
      </section>

      {/* Page format */}
      <section className="zd:space-y-3">
        <h3 className="zd:text-sm zd:font-medium zd:text-foreground zd:border-b zd:border-border zd:pb-1.5">Page format</h3>
        <FormControl label="Format" fieldKey="format">
          <Select options={PAGE_FORMAT_OPTIONS} value={format} onChange={setFormat} className="zd:w-full" />
        </FormControl>
        {format === "Custom" && (
          <div className="zd:grid zd:grid-cols-2 zd:gap-3">
            <FormControl label="Width (mm)" fieldKey="customWidth">
              <Input
                type="number"
                value={customWidth === "" ? "" : customWidth}
                onChange={(e) => setCustomWidth(e.target.value === "" ? "" : Number(e.target.value))}
                className="zd:w-full"
                min={1}
              />
            </FormControl>
            <FormControl label="Height (mm)" fieldKey="customHeight">
              <Input
                type="number"
                value={customHeight === "" ? "" : customHeight}
                onChange={(e) => setCustomHeight(e.target.value === "" ? "" : Number(e.target.value))}
                className="zd:w-full"
                min={1}
              />
            </FormControl>
          </div>
        )}
      </section>

      {/* Margins */}
      <section className="zd:space-y-3">
        <h3 className="zd:text-sm zd:font-medium zd:text-foreground zd:border-b zd:border-border zd:pb-1.5">Margins (mm)</h3>
        <div className="zd:grid zd:grid-cols-2 zd:gap-3">
          <FormControl label="Top" fieldKey="marginTop">
            <Input type="number" value={marginTop === "" ? "" : marginTop} onChange={(e) => setMarginTop(e.target.value === "" ? "" : Number(e.target.value))} className="zd:w-full" min={0} />
          </FormControl>
          <FormControl label="Right" fieldKey="marginRight">
            <Input type="number" value={marginRight === "" ? "" : marginRight} onChange={(e) => setMarginRight(e.target.value === "" ? "" : Number(e.target.value))} className="zd:w-full" min={0} />
          </FormControl>
          <FormControl label="Bottom" fieldKey="marginBottom">
            <Input type="number" value={marginBottom === "" ? "" : marginBottom} onChange={(e) => setMarginBottom(e.target.value === "" ? "" : Number(e.target.value))} className="zd:w-full" min={0} />
          </FormControl>
          <FormControl label="Left" fieldKey="marginLeft">
            <Input type="number" value={marginLeft === "" ? "" : marginLeft} onChange={(e) => setMarginLeft(e.target.value === "" ? "" : Number(e.target.value))} className="zd:w-full" min={0} />
          </FormControl>
        </div>
      </section>

      {/* Actions */}
      <div className="zd:flex zd:justify-end zd:gap-2 zd:pt-2 zd:border-t zd:border-border">
        <Button type="button" variant="outline" onClick={() => onClose()}>Cancel</Button>
        <Button type="button" onClick={handleApply}>Apply</Button>
      </div>
    </div>
  );
}

const PRINT_TEMPLATE_DOCTYPE = "Print Template" as Zodula.DoctypeName;

function itemToPayload(item: PrintTemplateBuilderItem): Record<string, unknown> {
  return {
    idx: item.idx,
    type: item.type,
    value: item.value ?? "",
    code: item.code ?? "",
    group: item.group ?? "",
    field_name: item.field_name ?? "",
    label: item.label ?? "",
    label_position: item.label_position ?? "left",
    align: item.align ?? "left",
    vertical_align: item.vertical_align ?? "middle",
    hide_no_value: item.hide_no_value ? 1 : 0,
    fields: item.fields ?? "",
    columns: item.columns ?? "",
    nested_field: item.nested_field ?? "",
    nested_table_field: item.nested_table_field ?? "",
    nested_columns: item.nested_columns ?? "",
    table_config: item.table_config ?? "",
    anchor_config: item.anchor_config ?? "",
    transform_x: item.transform_x ?? 0,
    transform_y: item.transform_y ?? 0,
    transform_width: item.transform_width ?? 200,
    transform_height: item.transform_height ?? 30,
    style_font_size: item.style_font_size ?? "",
    style_font_weight: item.style_font_weight ?? "",
    style_font_style: item.style_font_style ?? "",
    style_text_decoration: item.style_text_decoration ?? "",
    image: item.image ?? "",
    reference_doctype: item.reference_doctype ?? "",
    reference_id_filter: item.reference_id_filter ?? "",
    reference_field: item.reference_field ?? "",
  };
}

function docToItem(doc: any): PrintTemplateBuilderItem {
  return {
    id: doc.id,
    idx: doc.idx ?? 0,
    type: doc.type || "field",
    value: doc.value ?? null,
    code: doc.code ?? null,
    group: doc.group ?? null,
    field_name: doc.field_name ?? null,
    label: doc.label ?? null,
    label_position: doc.label_position ?? null,
    align: doc.align ?? null,
    vertical_align: doc.vertical_align ?? null,
    hide_no_value: doc.hide_no_value ?? 1,
    fields: doc.fields ?? null,
    columns: doc.columns ?? null,
    nested_field: doc.nested_field ?? null,
    nested_table_field: doc.nested_table_field ?? null,
    nested_columns: doc.nested_columns ?? null,
    table_config: doc.table_config ?? null,
    anchor_config: doc.anchor_config ?? null,
    transform_x: doc.transform_x ?? 0,
    transform_y: doc.transform_y ?? 0,
    transform_width: doc.transform_width ?? 200,
    transform_height: doc.transform_height ?? 30,
    style_font_size: doc.style_font_size ?? null,
    style_font_weight: doc.style_font_weight ?? null,
    style_font_style: doc.style_font_style ?? null,
    style_text_decoration: doc.style_text_decoration ?? null,
    image: doc.image ?? null,
    reference_doctype: doc.reference_doctype ?? null,
    reference_id_filter: doc.reference_id_filter ?? null,
    reference_field: doc.reference_field ?? null,
  };
}

export default function PrintTemplateFormPage() {
  const { id, org } = useParams();
  const navigate = useNavigate();
  const { doc, loading, reload } = useDoc({
    doctype: PRINT_TEMPLATE_DOCTYPE,
    id: id || "",
  });
  const [items, setItems] = useState<PrintTemplateBuilderItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [name, setName] = useState("");
  const [heading, setHeading] = useState("Document");
  const [docNameExpr, setDocNameExpr] = useState("{{ doc.id }}");
  const [format, setFormat] = useState("A4");
  const [customWidth, setCustomWidth] = useState<number | "">("");
  const [customHeight, setCustomHeight] = useState<number | "">("");
  const [marginTop, setMarginTop] = useState<number | "">(10);
  const [marginRight, setMarginRight] = useState<number | "">(10);
  const [marginBottom, setMarginBottom] = useState<number | "">(10);
  const [marginLeft, setMarginLeft] = useState<number | "">(10);
  const [saving, setSaving] = useState(false);
  const [isHtml, setIsHtml] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [defaultLetterHead, setDefaultLetterHead] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("");

  // Fetched items snapshot for dirty check (non-HTML mode); updated when items load or after save
  const fetchedItemsJsonRef = useRef<string>("[]");

  // Sync form state from doc when doc loads or changes
  useEffect(() => {
    if (!doc) return;
    const d = doc as any;
    setIsHtml(d.is_html === 1 || d.is_html === true);
    setHtml(d.html_content ?? "");
    setCss(d.css_content ?? "");
    setJs(d.js_content ?? "");
    setName(d.name ?? "");
    setHeading(d.title ?? "Document");
    setDocNameExpr(d.doc_name_expression ?? "{{ doc.id }}");
    setFormat(d.format ?? "A4");
    setCustomWidth(d.custom_width != null && d.custom_width !== "" ? Number(d.custom_width) : "");
    setCustomHeight(d.custom_height != null && d.custom_height !== "" ? Number(d.custom_height) : "");
    setMarginTop(d.margin_top != null && d.margin_top !== "" ? Number(d.margin_top) : 10);
    setMarginRight(d.margin_right != null && d.margin_right !== "" ? Number(d.margin_right) : 10);
    setMarginBottom(d.margin_bottom != null && d.margin_bottom !== "" ? Number(d.margin_bottom) : 10);
    setMarginLeft(d.margin_left != null && d.margin_left !== "" ? Number(d.margin_left) : 10);
    setIsDefault(d.is_default === 1 || d.is_default === true);
    setDefaultLetterHead(d.default_letter_head ?? "");
    setDefaultLanguage(d.default_language ?? "");
    const tableItems = Array.isArray(d.print_template_items) ? d.print_template_items : [];
    setItems(tableItems.map(docToItem));
    fetchedItemsJsonRef.current = JSON.stringify(tableItems.map(docToItem));
    setItemsLoaded(true);
  }, [
    doc,
  ]);

  const handleSave = useCallback(async () => {
    if (!id || !doc) return;
    setSaving(true);
    try {
      const docPayload: Record<string, unknown> = {
        is_html: isHtml ? 1 : 0,
        name: name.trim() || (doc as any)?.name,
        title: heading,
        doc_name_expression: docNameExpr,
        format,
        custom_width: format === "Custom" && customWidth !== "" ? customWidth : undefined,
        custom_height: format === "Custom" && customHeight !== "" ? customHeight : undefined,
        margin_top: marginTop !== "" ? marginTop : undefined,
        margin_right: marginRight !== "" ? marginRight : undefined,
        margin_bottom: marginBottom !== "" ? marginBottom : undefined,
        margin_left: marginLeft !== "" ? marginLeft : undefined,
        is_default: isDefault ? 1 : 0,
        default_letter_head: defaultLetterHead || undefined,
        default_language: defaultLanguage || undefined,
        html_content: html,
        css_content: css,
        js_content: js,
        ...(isHtml ? {} : { print_template_items: items.map((it) => itemToPayload(it)) }),
      };
      const updated = await zodula.doc.update_doc(PRINT_TEMPLATE_DOCTYPE, id, docPayload) as { id?: string };
      const newId = updated?.id;

      toast.success("Saved");
      fetchedItemsJsonRef.current = JSON.stringify(items);

      if (newId && newId !== id && org) {
        navigate(`/desk/${org}/doctypes/Print Template/form/${newId}`, { replace: true });
      } else {
        reload();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [id, doc, isHtml, name, heading, docNameExpr, format, customWidth, customHeight, marginTop, marginRight, marginBottom, marginLeft, isDefault, defaultLetterHead, defaultLanguage, html, css, js, items, reload, navigate]);

  const doctypeForPalette = useMemo(() => (doc as any)?.doctype ?? "", [(doc as any)?.doctype]);

  // Compare current form state to fetched print template doc (and items when not HTML)
  const isDirty = useMemo(() => {
    if (!doc) return false;
    const d = doc as any;
    const fetchedIsHtml = d.is_html === 1 || d.is_html === true;
    const fetched = {
      isHtml: fetchedIsHtml,
      name: d.name ?? "",
      html: d.html_content ?? "",
      css: d.css_content ?? "",
      js: d.js_content ?? "",
      heading: d.title ?? "Document",
      docNameExpr: d.doc_name_expression ?? "{{ doc.id }}",
      format: d.format ?? "A4",
      customWidth: d.custom_width != null && d.custom_width !== "" ? Number(d.custom_width) : "",
      customHeight: d.custom_height != null && d.custom_height !== "" ? Number(d.custom_height) : "",
      marginTop: d.margin_top != null && d.margin_top !== "" ? Number(d.margin_top) : 10,
      marginRight: d.margin_right != null && d.margin_right !== "" ? Number(d.margin_right) : 10,
      marginBottom: d.margin_bottom != null && d.margin_bottom !== "" ? Number(d.margin_bottom) : 10,
      marginLeft: d.margin_left != null && d.margin_left !== "" ? Number(d.margin_left) : 10,
      isDefault: d.is_default === 1 || d.is_default === true,
      defaultLetterHead: d.default_letter_head ?? "",
      defaultLanguage: d.default_language ?? "",
    };
    const docDirty =
      isHtml !== fetched.isHtml ||
      name !== fetched.name ||
      html !== fetched.html ||
      css !== fetched.css ||
      js !== fetched.js ||
      heading !== fetched.heading ||
      docNameExpr !== fetched.docNameExpr ||
      format !== fetched.format ||
      customWidth !== fetched.customWidth ||
      customHeight !== fetched.customHeight ||
      marginTop !== fetched.marginTop ||
      marginRight !== fetched.marginRight ||
      marginBottom !== fetched.marginBottom ||
      marginLeft !== fetched.marginLeft ||
      isDefault !== fetched.isDefault ||
      defaultLetterHead !== fetched.defaultLetterHead ||
      defaultLanguage !== fetched.defaultLanguage;
    if (isHtml) return docDirty;
    return docDirty || JSON.stringify(items) !== fetchedItemsJsonRef.current;
  }, [doc, isHtml, name, html, css, js, heading, docNameExpr, format, customWidth, customHeight, marginTop, marginRight, marginBottom, marginLeft, isDefault, defaultLetterHead, defaultLanguage, items]);

  const openSettingsPopup = useCallback(() => {
    popup(
      PrintTemplateSettingsPopup as React.ComponentType<{ isOpen: boolean; onClose: (r?: PrintTemplateSettingsValues) => void; initialData?: any }>,
      { title: "Print template settings", description: "Defaults, margin and page size.", width: "90vw", maxWidth: "680px" },
      {
        org: org ?? "",
        values: {
          name,
          sectionTitle: heading,
          docNameExpression: docNameExpr,
          format,
          customWidth,
          customHeight,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
          isDefault,
          defaultLetterHead,
          defaultLanguage,
        },
        onApply: (v: PrintTemplateSettingsValues) => {
          setName(v.name);
          setHeading(v.sectionTitle);
          setDocNameExpr(v.docNameExpression);
          setFormat(v.format);
          setCustomWidth(v.customWidth);
          setCustomHeight(v.customHeight);
          setMarginTop(v.marginTop);
          setMarginRight(v.marginRight);
          setMarginBottom(v.marginBottom);
          setMarginLeft(v.marginLeft);
          setIsDefault(v.isDefault);
          setDefaultLetterHead(v.defaultLetterHead);
          setDefaultLanguage(v.defaultLanguage);
        },
      }
    );
  }, [org, name, heading, docNameExpr, format, customWidth, customHeight, marginTop, marginRight, marginBottom, marginLeft, isDefault, defaultLetterHead, defaultLanguage]);

  const actionSection = (
    <>
      <Checkbox
        label="Is HTML"
        checked={isHtml}
        onCheckedChange={(checked) => setIsHtml(checked === true)}
        className="zd:flex zd:items-center zd:gap-2"
      />
      <Button variant="ghost" size="sm" className="zd:h-8 zd:w-8 zd:p-0" onClick={openSettingsPopup} title="Print template settings (margin, page size)">
        <Settings className="zd:h-4 zd:w-4" />
      </Button>
    </>
  );

  // Only show full-page loading when we don't have a doc yet (initial load). When
  // we already have a doc and reload() runs (e.g. after save), keep the form
  // mounted so the HTML builder preview is not lost.
  if (!doc) {
    return (
      <NavbarLayout>
        <div className="zd:flex zd:items-center zd:justify-center zd:min-h-[400px]">
          <span className="zd:text-muted-foreground">{loading ? "Loading..." : "Print Template not found."}</span>
        </div>
      </NavbarLayout>
    );
  }

  const saveAction = {
    label: saving ? "Saving..." : "Save",
    onClick: handleSave,
    disabled: saving || !isDirty,
  };

  return (
    <NavbarLayout>
      <div className="zd:flex zd:flex-col zd:h-full zd:min-h-0">
        {isHtml ? (
          <SidebarLayout
            title={id ?? ""}
            primaryAction={saveAction}
            actionSection={actionSection}
            defaultOpen={false}
          >
            <ZodulaHtmlBuilder
              html={html}
              css={css}
              js={js}
              onChange={(ctx) => {
                setHtml(ctx.html);
                setCss(ctx.css);
                setJs(ctx.js);
              }}
              previewContext={{ zodula }}
              enabledPanels={{ html: true, css: true, js: false }}
              allowCustomSize
              defaultZoom={0.75}
              margins={{
                top: marginTop === "" ? undefined : Number(marginTop),
                right: marginRight === "" ? undefined : Number(marginRight),
                bottom: marginBottom === "" ? undefined : Number(marginBottom),
                left: marginLeft === "" ? undefined : Number(marginLeft),
              }}
              className="zd:max-h-[calc(100vh-140px)]"
            />
          </SidebarLayout>
        ) : itemsLoaded ? (
          <PrintTemplateBuilder
            doctype={doctypeForPalette}
            items={items}
            // @ts-ignore - PrintTemplateBuilder uses PrintTemplateBuilderItem; generated types may reference PrintTemplateElement
            onChange={setItems}
            heading={heading}
            onHeadingChange={setHeading}
            docNameExpression={docNameExpr}
            onDocNameExpressionChange={setDocNameExpr}
            excludeCustomHtml={false}
            className="zd:h-full"
            primaryAction={saveAction}
            actionSection={actionSection}
            sidebarTitle={id ?? ""}
          />
        ) : (
          <SidebarLayout title={id ?? ""} primaryAction={saveAction} actionSection={actionSection}>
            <div className="zd:flex zd:items-center zd:justify-center zd:min-h-[320px]">
              <span className="zd:text-muted-foreground">Loading template items...</span>
            </div>
          </SidebarLayout>
        )}
      </div>
    </NavbarLayout>
  );
}
