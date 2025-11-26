import { z } from "@/zodula/client";
import { Database } from "../../server/database/database";
import nunjucks from "nunjucks";
import { Template } from "binba";
import { zodula } from "../../server/zodula";
import { translate } from "../../server/zodula/utils";
import { loader } from "../../server/loader";
import type { DoctypeMetadata } from "../../server/loader/plugins/doctype";
import { isStandardField } from "../../client/utils";

// Constants
const DEFAULT_CURRENCY = "$";
const DEFAULT_PDF_FORMAT = "A4";
const DEFAULT_MARGIN = 10;
const MAX_TABLE_COLUMNS = 5;
const DEFAULT_IMAGE_WIDTH = 200;

const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
];

const BASE_CSS = `
body {
    font-family: Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    color: #000;
    margin: 0;
    padding: 0;
}

.section {
    margin-bottom: 20px;
    page-break-inside: avoid;
}

.row {
    display: flex;
    gap: 20px;
    margin-bottom: 10px;
}

.field-group {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.field-group.align-left { text-align: left; }
.field-group.align-right { text-align: right; }
.field-group.align-center { text-align: center; }

.field-label {
    font-size: 11px;
    margin-bottom: 2px;
    color: #555;
}

.field-label.align-left { text-align: left; }
.field-label.align-right { text-align: right; }
.field-label.align-center { text-align: center; }

.field-value {
    font-size: 14px;
    min-height: 16px;
    padding: 2px 0;
    word-break: break-all;
}

.field-value.boolean.true::before { content: '✓ '; }
.field-value.boolean.false::before { content: '✗ '; }
.field-value.number { text-align: left; }
.field-value.currency::before { content: '{{ defaultCurrency }}'; }
.field-value.currency-custom::before { content: attr(data-currency); }
.field-value.textarea {
    white-space: pre-wrap;
    min-height: 40px;
}
.field-value.json {
    font-family: monospace;
    font-size: 10px;
    white-space: pre-wrap;
}

.letter-head {
    margin-bottom: 20px;
    page-break-inside: avoid;
}

.document-header-container {
    margin-bottom: 20px;
    padding-bottom: 10px;
    page-break-inside: avoid;
    border-bottom: 1px solid #e2e8f0;
}

.document-header h1 {
    margin: 0;
    font-size: 18px;
    font-weight: bold;
}

.document-header p {
    margin: 0;
    font-size: 12px;
}

.reference-table-section {
    margin-bottom: 20px;
    page-break-inside: avoid;
    width: 100%;
    padding: 0 10px 0 0;
    overflow-x: auto;
    max-width: 100%;
}

.reference-table {
    border-collapse: collapse;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    display: table;
    table-layout: fixed;
}

.table-row {
    display: table-row;
    border-bottom: 1px solid #e2e8f0;
}

.table-cell {
    display: table-cell;
    padding: 4px;
    font-size: 12px;
    word-wrap: break-word;
    overflow-wrap: break-word;
    width: auto;
}

.table-cell:last-child {

}

.table-header {
    display: table-header-group;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}

.table-header .table-cell {
    background-color: #f5f5f5;
}

.extend-section {
    margin-bottom: 15px;
    page-break-inside: avoid;
}

.extend-content {
    margin-left: 0px;
    border-left: 2px solid #ddd;
    padding-left: 20px;
}

@media print {
    body { margin: 0; }
    .section { page-break-inside: avoid; }
    .reference-table-section {
        overflow: visible;
        width: 100%;
    }
    .reference-table {
        overflow: visible;
        display: table;
        width: 100%;
        table-layout: fixed;
    }
    .table-row { display: table-row; }
    .table-cell {
        display: table-cell;
        padding: 8px;
        width: auto;
    }
    .table-header {
        display: table-header-group;
        font-weight: 500;
    }
    .table-header .table-cell {
        background-color: #f5f5f5;
        font-size: 11px;
    }
    .extend-section { page-break-inside: avoid; }
}
`;

// Try to import puppeteer, fallback to HTML if not available
let puppeteer: any = null;
try {
  puppeteer = await import("puppeteer");
} catch (error) {
  console.warn("Puppeteer not available, falling back to HTML response");
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function fetchPrintTemplate(
  db: any,
  templateId: string
): Promise<Zodula.SelectDoctype<"zodula__Print Template"> | null> {
  return (await db
    .select("*")
    .from("zodula__Print Template" as Zodula.DoctypeName)
    .where("id", "=", templateId)
    .first()) as Zodula.SelectDoctype<"zodula__Print Template"> | null;
}

async function fetchDocuments(
  doctypeName: string,
  ids: string[]
): Promise<any[]> {
  const documents = [];
  for (const id of ids) {
    try {
      const doc = await zodula
        .doctype(doctypeName as Zodula.DoctypeName)
        .get(id)
        .bypass(true);
      if (doc) documents.push(doc);
    } catch (error) {
      console.error(`Error fetching document from ${doctypeName}:`, error);
    }
  }
  return documents;
}

function getDoctypeMetadata(doctypeName: string): {
  metadata: DoctypeMetadata | null;
  fields: Record<string, Zodula.Field>;
  label: string;
  isSingle: boolean;
} {
  try {
    const metadata = loader
      .from("doctype")
      .get(doctypeName as Zodula.DoctypeName);
    return {
      metadata,
      fields: metadata.schema.fields,
      label: metadata.schema.label || doctypeName,
      isSingle: !!(
        metadata.schema.is_single === 1 || metadata.schema.is_single
      ),
    };
  } catch (error) {
    console.warn(
      `Could not fetch field configuration for doctype ${doctypeName}:`,
      error
    );
    return {
      metadata: null,
      fields: {},
      label: doctypeName,
      isSingle: false,
    };
  }
}

async function fetchLetterHead(
  db: any,
  letterHeadId: string
): Promise<{ template: string; css: string }> {
  try {
    const letterHead = (await db
      .select("*")
      .from("zodula__Letter Head" as Zodula.DoctypeName)
      .where("id", "=", letterHeadId)
      .first()) as Zodula.SelectDoctype<"zodula__Letter Head"> | null;

    return {
      template: letterHead?.content || "",
      css: letterHead?.css_content || "",
    };
  } catch (error) {
    console.warn("Could not fetch letter head:", error);
    return { template: "", css: "" };
  }
}

async function fetchDefaultCurrency(db: any): Promise<string> {
  try {
    const globalSetting = (await db
      .select("*")
      .from("zodula__Global Setting" as Zodula.DoctypeName)
      .where("id", "=", "zodula__Global Setting")
      .first()) as Zodula.SelectDoctype<"zodula__Global Setting"> | null;

    return globalSetting?.currency_symbol || DEFAULT_CURRENCY;
  } catch (error) {
    console.warn("Could not fetch default currency:", error);
    return DEFAULT_CURRENCY;
  }
}

// ============================================================================
// Main Action
// ============================================================================

export default $action(
  async (ctx) => {
    const {
      print_template,
      doctype,
      lang,
      ids: idsString,
      letter_head,
    } = ctx.query;

    const ids = idsString?.split(",") || [];

    if (!ids.length) {
      return ctx.json({ error: "Document IDs are required" }, 400);
    }

    if (!doctype) {
      return ctx.json({ error: "Doctype is required" }, 400);
    }

    const db = Database("main");

    // Fetch print template if provided
    let template: Zodula.SelectDoctype<"zodula__Print Template"> | null = null;
    let doctypeName = doctype;

    if (print_template) {
      template = await fetchPrintTemplate(db, print_template);
      if (!template) {
        return ctx.json({ error: "Print template not found" }, 404);
      }
      if (!template.doctype) {
        return ctx.json(
          { error: "Print template must have a doctype specified" },
          400
        );
      }
      doctypeName = template.doctype || doctype;
    }

    // Fetch documents
    const documents = await fetchDocuments(doctypeName, ids);
    if (documents.length === 0) {
      return ctx.json({ error: "No documents found" }, 404);
    }

    // Get doctype metadata
    const {
      metadata: doctypeMetadata,
      fields: doctypeFields,
      label: doctypeLabel,
      isSingle,
    } = getDoctypeMetadata(doctypeName);

    // Fetch letter head and currency
    const { template: letterHeadTemplate, css: letterHeadCss } = letter_head
      ? await fetchLetterHead(db, letter_head)
      : { template: "", css: "" };
    const defaultCurrency = await fetchDefaultCurrency(db);

    // Setup template environment
    const env = nunjucks.configure({ autoescape: false });
    setupTemplateEnvironment(env, db, doctypeFields, defaultCurrency, lang);

    // Get template content
    const combinedCss = [letterHeadCss, template?.css || ""]
      .filter(Boolean)
      .join("\n");
    const templateContent = getTemplateContent(
      template,
      doctypeMetadata,
      doctypeFields,
      combinedCss,
      defaultCurrency,
      isSingle
    );

    if (!templateContent) {
      return ctx.json({ error: "No template content found" }, 400);
    }

    // Render documents
    const renderedDocs = await renderDocuments(
      documents,
      templateContent,
      env,
      {
        doctypeName,
        doctypeLabel,
        isSingle,
        letterHeadTemplate,
        letterHeadCss,
        letterHead: letter_head,
        lang: lang || "en",
      }
    );

    const finalHtml = renderedDocs.join("\n");

    // Generate PDF or return HTML
    if (puppeteer) {
      const pdfResponse = await generatePDF(finalHtml, template);
      if (pdfResponse) return pdfResponse;
    }

    return new Response(finalHtml, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": "inline; filename=print.html",
      },
    });
  },
  {
    query: z.object({
      print_template: z.string().optional(),
      doctype: z.string(),
      lang: z.string().optional(),
      ids: z.string().optional(),
      letter_head: z.string().optional(),
    }),
    method: "GET",
  }
);

// ============================================================================
// Template Setup Functions
// ============================================================================

function setupTemplateEnvironment(
  env: nunjucks.Environment,
  db: any,
  doctypeFields: Record<string, Zodula.Field>,
  defaultCurrency: string,
  lang?: string
): void {
  env.addGlobal("zodula", zodula);
  env.addGlobal("__", (key: string) => translate(key, lang || "en"));
  env.addGlobal("fields", doctypeFields);
  env.addGlobal("defaultCurrency", defaultCurrency);
  env.addGlobal(
    "getDoctypeFileUrl",
    (doctype: string, docId: string, fieldName: string, fileName: string) => {
      return `/files/${doctype}/${docId || doctype}/${fieldName}/${fileName}`;
    }
  );
  env.addFilter("isImageFile", isImageFile);
  env.addGlobal("getNestedPrintTemplate", async (templateId: string) => {
    try {
      const nestedTemplate = await fetchPrintTemplate(db, templateId);
      return nestedTemplate?.html || null;
    } catch (error) {
      console.warn(
        `Could not fetch nested print template ${templateId}:`,
        error
      );
      return null;
    }
  });
}

function getTemplateContent(
  template: Zodula.SelectDoctype<"zodula__Print Template"> | null,
  doctypeMetadata: DoctypeMetadata | null,
  doctypeFields: Record<string, Zodula.Field>,
  combinedCss: string,
  defaultCurrency: string,
  isSingle: boolean
): string {
  if (template?.is_custom && template.html) {
    return template.html;
  }

  if (template?.layout) {
    return convertLayoutToTemplate(
      template.layout,
      doctypeFields,
      combinedCss,
      defaultCurrency,
      isSingle
    );
  }

  // Generate default layout
  const defaultLayout = generateDefaultLayout(doctypeMetadata, doctypeFields);
  return convertLayoutToTemplate(
    JSON.stringify(defaultLayout),
    doctypeFields,
    combinedCss,
    defaultCurrency,
    isSingle
  );
}

async function renderLetterHead(
  template: string,
  context: any
): Promise<string> {
  if (!template) return "";
  try {
    return await Template.render(template, context, { autoescape: false });
  } catch (error) {
    console.warn("Error rendering letter head template:", error);
    return "";
  }
}

async function renderDocuments(
  documents: any[],
  templateContent: string,
  env: nunjucks.Environment,
  options: {
    doctypeName: string;
    doctypeLabel: string;
    isSingle: boolean;
    letterHeadTemplate: string;
    letterHeadCss: string;
    letterHead?: string;
    lang: string;
  }
): Promise<string[]> {
  const renderedDocs: string[] = [];

  for (const doc of documents) {
    try {
      let user = null;
      try {
        user = await zodula.doctype("zodula__User").get("current_user_id");
      } catch (error) {
        console.warn("Could not fetch current user:", error);
      }

      const pageTitle = `${doc.id} | ${options.doctypeLabel}`;
      const letterHeadContent = await renderLetterHead(
        options.letterHeadTemplate,
        { doc, user, lang: options.lang, zodula }
      );

      const rendered = env.renderString(templateContent, {
        doc,
        user,
        lang: options.lang,
        letter_head: options.letterHead || "",
        letter_head_content: letterHeadContent,
        letter_head_css: options.letterHeadCss,
        page_title: pageTitle,
        doctype_label: options.doctypeLabel,
        doctype_name: options.doctypeName,
        is_single: options.isSingle,
      });

      renderedDocs.push(rendered);
    } catch (error) {
      console.error("Template rendering error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Template rendering failed: ${errorMessage}`);
    }
  }

  return renderedDocs;
}

async function generatePDF(
  html: string,
  template: Zodula.SelectDoctype<"zodula__Print Template"> | null
): Promise<Response | null> {
  if (!puppeteer) return null;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: (template?.format as any) || DEFAULT_PDF_FORMAT,
      printBackground: true,
      margin: {
        top: `${template?.margin_top ?? DEFAULT_MARGIN}mm`,
        right: `${template?.margin_right ?? DEFAULT_MARGIN}mm`,
        bottom: `${template?.margin_bottom ?? DEFAULT_MARGIN}mm`,
        left: `${template?.margin_left ?? DEFAULT_MARGIN}mm`,
      },
    });

    await browser.close();

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=document.pdf",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return null;
  }
}

// ============================================================================
// Template Generation Functions
// ============================================================================

function convertLayoutToTemplate(
  layoutJson: string,
  doctypeFields: Record<string, Zodula.Field>,
  customCSS: string,
  defaultCurrency: string,
  isSingle: boolean
): string {
  try {
    const layout = JSON.parse(layoutJson);
    return generateTemplateFromLayout(
      layout,
      doctypeFields,
      customCSS,
      defaultCurrency,
      isSingle
    );
  } catch (error) {
    console.error("Error parsing layout JSON:", error);
    return "";
  }
}

function generateTemplateFromLayout(
  layout: any[],
  doctypeFields: Record<string, Zodula.Field>,
  customCSS: string,
  defaultCurrency: string,
  isSingle: boolean
): string {
  const combinedCSS = `${BASE_CSS}\n${customCSS || ""}`;
  const layoutHtml = renderLayoutRecursive(
    layout,
    doctypeFields,
    "doc",
    defaultCurrency
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ page_title }}</title>
    <style>${combinedCSS}</style>
</head>
<body>
<div class="document-header-container">
    {% if letter_head_content %}
    <div class="letter-head">
        {{ letter_head_content | safe }}
    </div>
    {% else %}
    <div class="document-header"></div>
    {% endif %}
    <div class="document-header">
        {% if not is_single %}
        <p>{{ doc.id }}</p>
        {% endif %}
        <h1>{{ doctype_label }}</h1>
    </div>
</div>
${layoutHtml}
</body>
</html>`;
}

// ============================================================================
// Field Rendering Functions
// ============================================================================

function renderReferenceTableField(
  field: any,
  fieldConfig: Zodula.Field
): string {
  const fieldName = field.value;
  const alignClass = field.align ? `align-${field.align}` : "";
  const specifiedFields = field.fields || [];
  const referenceDoctype = fieldConfig?.reference;

  if (!referenceDoctype) {
    return renderSimpleTable(fieldName, alignClass);
  }

  try {
    const refDoctypeMetadata = loader
      .from("doctype")
      .get(referenceDoctype as Zodula.DoctypeName);
    const refFields = refDoctypeMetadata.schema.fields;

    const displayFields =
      specifiedFields.length > 0
        ? specifiedFields
            .map(
              (name: string) =>
                [name, refFields[name]] as [string, Zodula.Field]
            )
            .filter(([, config]: [string, Zodula.Field]) => config)
        : (Object.entries(refFields)
            .filter(
              ([name, config]: [string, Zodula.Field]) =>
                !config.no_print &&
                !zodula.utils.isStandardField(name) &&
                config.in_list_view
            )
            .slice(0, MAX_TABLE_COLUMNS) as [string, Zodula.Field][]);

    if (displayFields.length === 0) {
      return renderSimpleTable(fieldName, alignClass);
    }

    return renderTableWithFields(fieldName, alignClass, displayFields);
  } catch (error) {
    console.warn(
      `Could not load reference doctype ${referenceDoctype}:`,
      error
    );
    return renderSimpleTable(fieldName, alignClass);
  }
}

function renderSimpleTable(fieldName: string, alignClass: string): string {
  return `    <div class="reference-table-section">
        <div class="field-label ${alignClass}">{{ __(fields["${fieldName}"].label) }}</div>
        <div class="reference-table">
            <div class="table-header">
                <div class="table-cell">ID</div>
            </div>
            {% for item in doc.${fieldName} %}
                <div class="table-row">
                    <div class="table-cell">{{ item.id }}</div>
                </div>
            {% endfor %}
        </div>
    </div>`;
}

function renderTableWithFields(
  fieldName: string,
  alignClass: string,
  displayFields: [string, Zodula.Field][]
): string {
  const headerCells = displayFields
    .map(
      ([name, config]) =>
        `                <div class="table-cell">{{ __("${config.label || name}") }}</div>`
    )
    .join("\n");

  const dataCells = displayFields
    .map(([name, config]) => {
      const fieldType = config.type || "Text";
      const fieldClass = getFieldTypeClass(fieldType);
      return `                        <div class="table-cell ${fieldClass}">{{ item.${name} or '' }}</div>`;
    })
    .join("\n");

  return `    <div class="reference-table-section">
        <div class="field-label ${alignClass}">{{ __(fields["${fieldName}"].label) }}</div>
        <div class="reference-table">
            <div class="table-header">
${headerCells}
            </div>
            {% if doc.${fieldName} and doc.${fieldName}.length > 0 %}
                {% for item in doc.${fieldName} %}
                    <div class="table-row">
${dataCells}
                    </div>
                {% endfor %}
            {% else %}
                <div class="table-row">
                    <div class="table-cell" colspan="${displayFields.length}"></div>
                </div>
            {% endif %}
        </div>
    </div>`;
}

function renderExtendFieldRecursive(
  fieldName: string,
  fieldConfig: Zodula.Field,
  doctypeFields: Record<string, Zodula.Field>,
  defaultCurrency: string,
  docPrefix: string = "doc"
): string {
  if (!fieldConfig.reference) {
    return renderSimpleExtendField(fieldName, docPrefix);
  }

  try {
    const referenceDoctype = loader
      .from("doctype")
      .get(fieldConfig.reference as Zodula.DoctypeName);
    const referenceFields = referenceDoctype.schema.fields;
    const defaultLayout = generateDefaultLayout(
      referenceDoctype,
      referenceFields
    );
    const nestedDocPrefix = `${docPrefix}["${fieldName}"]`;
    const layoutHtml = renderLayoutRecursive(
      defaultLayout,
      referenceFields,
      nestedDocPrefix,
      defaultCurrency,
      fieldConfig
    );

    return `    <div class="extend-section">
        <div class="section-title">{{ __("${fieldConfig.label || fieldName}") }}</div>
        <div class="extend-content">
${layoutHtml}        </div>
    </div>`;
  } catch (error) {
    console.warn(
      `Could not load reference doctype ${fieldConfig.reference}:`,
      error
    );
    return renderSimpleExtendField(fieldName, docPrefix);
  }
}

function renderSimpleExtendField(fieldName: string, docPrefix: string): string {
  return `    <div class="extend-section">
        <div class="extend-content">
            <div class="extend-field">
                <div class="extend-field-value">{{ ${docPrefix}["${fieldName}"] }}</div>
            </div>
        </div>
    </div>`;
}

// ============================================================================
// Layout Generation Functions
// ============================================================================

function generateDefaultLayout(
  doctypeMetadata: DoctypeMetadata | null,
  doctypeFields: Record<string, Zodula.Field>
): any[] {
  const layout: any[] = [];
  const fieldsInLayout = new Set<string>();

  const printableFields = Object.keys(doctypeFields).filter((fieldName) => {
    const field = doctypeFields[fieldName];
    return (
      (!field || !field.no_print || field.no_print !== 1) &&
      !zodula.utils.isStandardField(fieldName)
    );
  });

  if (!doctypeMetadata) {
    return createFieldRows(printableFields, fieldsInLayout, "");
  }

  const tabs = doctypeMetadata.schema.tabs
    ? JSON.parse(doctypeMetadata.schema.tabs)
    : [];

  if (tabs && tabs.length > 0) {
    for (const tab of tabs) {
      layout.push(...tab.layout);
      extractFieldsFromLayout(tab.layout, fieldsInLayout, doctypeFields);
    }
  } else {
    const sectionLabel = doctypeMetadata.schema.label || "";
    layout.push(
      ...createFieldRows(printableFields, fieldsInLayout, sectionLabel)
    );
  }

  const remainingFields = printableFields.filter(
    (fieldName) => !fieldsInLayout.has(fieldName) && !isStandardField(fieldName)
  );

  if (remainingFields.length > 0) {
    layout.push({ type: "section", value: "Additional" });
    layout.push(...createFieldRows(remainingFields, new Set(), ""));
  }

  return layout;
}

function createFieldRows(
  fields: string[],
  fieldsInLayout: Set<string>,
  sectionLabel: string
): any[] {
  const rows: any[] = [];
  if (sectionLabel) {
    rows.push({ type: "section", value: sectionLabel });
  }
  for (const fieldName of fields) {
    fieldsInLayout.add(fieldName);
    rows.push([{ type: "field", value: fieldName, align: "left" }]);
  }
  return rows;
}

function renderLayoutRecursive(
  layout: any[],
  doctypeFields: Record<string, Zodula.Field>,
  docPrefix: string = "doc",
  defaultCurrency: string,
  parentField?: Zodula.Field
): string {
  let html = "";
  let currentSection = "";

  for (const item of layout) {
    if (Array.isArray(item)) {
      html += `    <div class="row">\n`;
      for (const field of item) {
        if (
          typeof field === "object" &&
          field !== null &&
          field.type === "field"
        ) {
          html += renderFieldInRow(
            field,
            doctypeFields,
            docPrefix,
            defaultCurrency,
            parentField
          );
        }
      }
      html += `    </div>\n`;
    } else if (typeof item === "object" && item !== null) {
      if (item.type === "section") {
        if (currentSection) {
          html += `    </div>\n`;
        }
        currentSection = item.value || "";
        html += `    <div class="section">\n`;
      } else if (item.type === "field") {
        html += renderField(
          item,
          doctypeFields,
          docPrefix,
          defaultCurrency,
          parentField
        );
      }
    }
  }

  if (currentSection) {
    html += `    </div>\n`;
  }

  return html;
}

function renderFieldInRow(
  field: any,
  doctypeFields: Record<string, Zodula.Field>,
  docPrefix: string,
  defaultCurrency: string,
  parentField?: Zodula.Field
): string {
  const fieldConfig = doctypeFields[field.value];
  if (!fieldConfig || fieldConfig.no_print === 1) return "";
  if (parentField && parentField.reference_alias === field.value) return "";

  const fieldType = fieldConfig.type || "Text";
  const alignClass = field.align ? `align-${field.align}` : "";

  if (fieldType === "Reference Table") {
    return renderReferenceTableField(
      { value: field.value, align: field.align, fields: field.fields },
      fieldConfig
    );
  }

  if (fieldType === "Extend") {
    return renderExtendFieldRecursive(
      field.value,
      fieldConfig,
      doctypeFields,
      defaultCurrency,
      docPrefix
    );
  }

  if (fieldType === "File") {
    return renderFileField(field, fieldConfig, alignClass, docPrefix);
  }

  return renderStandardField(
    field,
    fieldConfig,
    alignClass,
    docPrefix,
    defaultCurrency
  );
}

function renderFileField(
  field: any,
  fieldConfig: Zodula.Field,
  alignClass: string,
  docPrefix: string
): string {
  const fieldValueHtml =
    `{% set fieldValue = ${docPrefix}["${field.value}"] %}\n` +
    `{% if fieldValue and fieldValue|isImageFile %}\n` +
    `    <img src="{{ zodula.utils.getDoctypeFileUrl(doctype_name, doc.id, "${field.value}", fieldValue) }}" alt="{{ fieldValue }}" style="max-width: ${fieldConfig.width || DEFAULT_IMAGE_WIDTH}px; height: auto;" />\n` +
    `{% else %}\n` +
    `    {{ fieldValue or '' }}\n` +
    `{% endif %}`;

  return `        <div class="field-group ${alignClass}">
            <div class="field-label ${alignClass}">{{ __(fields["${field.value}"].label) }}</div>
            <div class="field-value">
                ${fieldValueHtml}
            </div>
        </div>`;
}

function renderStandardField(
  field: any,
  fieldConfig: Zodula.Field,
  alignClass: string,
  docPrefix: string,
  defaultCurrency: string
): string {
  const fieldType = fieldConfig.type || "Text";
  let fieldValueClass = getFieldTypeClass(fieldType);
  let currencyAttr = "";

  if (fieldType === "Currency") {
    const currencySymbol = getCurrencySymbol(fieldConfig, defaultCurrency);
    if (currencySymbol !== defaultCurrency) {
      fieldValueClass = "currency-custom";
      currencyAttr = ` data-currency="${currencySymbol}"`;
    }
  }

  return `        <div class="field-group ${alignClass}">
            <div class="field-label ${alignClass}">{{ __(fields["${field.value}"].label) }}</div>
            <div class="field-value ${fieldValueClass}"${currencyAttr}>
                {{ ${docPrefix}["${field.value}"] }}
            </div>
        </div>`;
}

function renderField(
  item: any,
  doctypeFields: Record<string, Zodula.Field>,
  docPrefix: string,
  defaultCurrency: string,
  parentField?: Zodula.Field
): string {
  const fieldConfig = doctypeFields[item.value];
  if (!fieldConfig || fieldConfig.no_print === 1) return "";
  if (parentField && parentField.reference_alias === item.value) return "";

  const fieldType = fieldConfig.type || "Text";

  if (fieldType === "Reference Table") {
    return renderReferenceTableField(
      { value: item.value, align: item.align, fields: item.fields },
      fieldConfig
    );
  }

  if (fieldType === "Extend") {
    return renderExtendFieldRecursive(
      item.value,
      fieldConfig,
      doctypeFields,
      defaultCurrency,
      docPrefix
    );
  }

  return renderSingleField(item, fieldConfig, docPrefix, defaultCurrency);
}

function renderSingleField(
  field: any,
  fieldConfig: Zodula.Field,
  docPrefix: string = "doc",
  defaultCurrency: string
): string {
  const alignClass = field.align ? `align-${field.align}` : "";
  const fieldType = fieldConfig.type || "Text";

  if (fieldType === "File") {
    return `    <div class="row">\n${renderFileField(field, fieldConfig, alignClass, docPrefix)}\n    </div>\n`;
  }

  return `    <div class="row">\n${renderStandardField(field, fieldConfig, alignClass, docPrefix, defaultCurrency)}\n    </div>\n`;
}

function getFieldTypeClass(fieldType: string): string {
  const typeMap: Record<string, string> = {
    Check: "boolean",
    Integer: "number",
    Float: "number",
    Currency: "currency",
    Date: "date",
    Datetime: "date",
    Time: "date",
    Text: "text",
    Textarea: "text",
    Select: "text",
    Link: "text",
    Table: "text",
    JSON: "text",
  };
  return typeMap[fieldType] || "text";
}

function getCurrencySymbol(
  fieldConfig: Zodula.Field,
  defaultCurrency: string
): string {
  return fieldConfig?.currency_symbol || defaultCurrency;
}

// ============================================================================
// Utility Functions
// ============================================================================

function isImageFile(fileName: string | null | undefined): boolean {
  if (!fileName || typeof fileName !== "string") return false;
  const lowerFileName = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext));
}

function extractFieldsFromLayout(
  layout: any[],
  fieldsSet: Set<string>,
  doctypeFields: Record<string, Zodula.Field> = {}
): void {
  for (const item of layout) {
    if (Array.isArray(item)) {
      for (const field of item) {
        if (
          typeof field === "object" &&
          field !== null &&
          field.type === "field"
        ) {
          const fieldConfig = doctypeFields[field.value];
          if (!fieldConfig?.no_print || fieldConfig.no_print !== 1) {
            fieldsSet.add(field.value);
          }
        } else if (typeof field === "string" && field.trim() !== "") {
          const fieldConfig = doctypeFields[field];
          if (!fieldConfig?.no_print || fieldConfig.no_print !== 1) {
            fieldsSet.add(field);
          }
        }
      }
    } else if (
      typeof item === "object" &&
      item !== null &&
      item.type === "field"
    ) {
      const fieldConfig = doctypeFields[item.value];
      if (!fieldConfig?.no_print || fieldConfig.no_print !== 1) {
        fieldsSet.add(item.value);
      }
    }
  }
}
