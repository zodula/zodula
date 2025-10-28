import { z } from "@/zodula/client"
import { Database } from "../../server/database/database"
import nunjucks from "nunjucks"
import { zodula } from "../../server/zodula"
import { translate } from "../../server/zodula/utils"
import { loader } from "../../server/loader"
import type { DoctypeMetadata } from "../../server/loader/plugins/doctype"
import { isStandardField } from "../../client/utils"

// Try to import puppeteer, fallback to HTML if not available
let puppeteer: any = null
try {
    puppeteer = await import("puppeteer")
} catch (error) {
    console.warn("Puppeteer not available, falling back to HTML response")
}

export default $action(async (ctx) => {
    const { print_template, doctype, lang, ids: idsString, letter_head } = ctx.query

    const ids = idsString?.split(",") || []

    if (!ids || ids.length === 0) {
        return ctx.json({ error: "Document IDs are required" }, 400)
    }

    if (!doctype) {
        return ctx.json({ error: "Doctype is required" }, 400)
    }

    const db = Database("main")

    let template: Zodula.SelectDoctype<"zodula__Print Template"> | null = null
    let doctypeName: string = doctype

    if (print_template) {
        // Get the specified print template
        template = await db.select("*").from("zodula__Print Template" as Zodula.DoctypeName)
            .where("id", "=", print_template)
            .first() as Zodula.SelectDoctype<"zodula__Print Template"> | null

        if (!template) {
            return ctx.json({ error: "Print template not found" }, 404)
        }

        if (!template.doctype) {
            return ctx.json({ error: "Print template must have a doctype specified" }, 400)
        }

        // Use doctype from template if provided, otherwise use the doctype parameter
        doctypeName = template.doctype || doctype
    }

    // Get documents to print using the doctype with relatives
    const documents = []
    for (const id of ids) {
        try {
            // Use Zodula document getter to include relatives (like invoice_items)
            const doc = await zodula.doctype(doctypeName as Zodula.DoctypeName).get(id).bypass(true)
            if (doc) {
                documents.push(doc)
            }
        } catch (error) {
            console.error(`Error fetching document from ${doctypeName}:`, error)
        }
    }

    if (documents.length === 0) {
        return ctx.json({ error: "No documents found" }, 404)
    }

    // Create nunjucks environment
    const env = nunjucks.configure({ autoescape: false })

    // Get doctype field configuration for enhanced rendering
    let doctypeFields: Record<string, Zodula.Field> = {}
    let doctypeMetadata: any = null
    let doctypeLabel: string = doctypeName
    try {
        doctypeMetadata = loader.from("doctype").get(doctypeName as Zodula.DoctypeName)
        doctypeFields = doctypeMetadata.schema.fields
        doctypeLabel = doctypeMetadata.schema.label || doctypeName
    } catch (error) {
        console.warn(`Could not fetch field configuration for doctype ${doctypeName}:`, error)
    }

    // Get letter head if provided
    let letterHeadContent = ""
    if (letter_head) {
        try {
            const letterHead = await db.select("*").from("zodula__Letter Head" as Zodula.DoctypeName)
                .where("id", "=", letter_head)
                .first() as Zodula.SelectDoctype<"zodula__Letter Head"> | null

            if (letterHead && letterHead.content) {
                letterHeadContent = letterHead.content
            }
        } catch (error) {
            console.warn("Could not fetch letter head:", error)
        }
    }

    // Get default currency from Global Settings
    let defaultCurrency = '$' // fallback
    try {
        // Get the default currency from Currency doctype where is_default = 1
        const globalSetting = await db.select("*").from("zodula__Global Setting" as Zodula.DoctypeName)
            .where("id", "=", "zodula__Global Setting")
            .first() as Zodula.SelectDoctype<"zodula__Global Setting"> | null

        if (globalSetting && globalSetting.currency_symbol) {
            defaultCurrency = globalSetting.currency_symbol
        }
    } catch (error) {
        console.warn("Could not fetch default currency from Currency doctype:", error)
    }

    // Add global functions
    env.addGlobal('zodula', zodula)
    env.addGlobal('__', (key: string) => translate(key, lang || 'en'))
    env.addGlobal('fields', doctypeFields)
    env.addGlobal('defaultCurrency', defaultCurrency)
    env.addGlobal('getNestedPrintTemplate', async (templateId: string) => {
        try {
            const nestedTemplate = await db.select("*").from("zodula__Print Template" as Zodula.DoctypeName)
                .where("id", "=", templateId)
                .first() as Zodula.SelectDoctype<"zodula__Print Template"> | null

            if (nestedTemplate && nestedTemplate.html) {
                return nestedTemplate.html
            }
            return null
        } catch (error) {
            console.warn(`Could not fetch nested print template ${templateId}:`, error)
            return null
        }
    })

    let templateContent = ""

    if (template && template.is_custom && template.html) {
        // Use custom HTML template
        templateContent = template.html
    } else if (template && template.layout) {
        // Convert layout JSON to nunjucks template
        templateContent = convertLayoutToTemplate(template.layout, doctypeFields, template.css || "", db, lang, defaultCurrency)
    } else {
        // No template provided - generate default layout from doctype tabs or fields
        const defaultLayout = generateDefaultLayout(doctypeMetadata, doctypeFields)
        templateContent = convertLayoutToTemplate(JSON.stringify(defaultLayout), doctypeFields, "", db, lang, defaultCurrency)
    }

    if (!templateContent) {
        return ctx.json({ error: "No template content found" }, 400)
    }

    // Render template for each document
    const renderedDocs = []
    for (const doc of documents) {
        try {
            // Get current user for template context
            let user = null
            try {
                user = await zodula.doctype("zodula__User").get("current_user_id")
            } catch (error) {
                console.warn("Could not fetch current user:", error)
            }

            // Create page title: doc_id | doctype_label
            const pageTitle = `${doc.id} | ${doctypeLabel}`

            const rendered = env.renderString(templateContent, {
                doc,
                user,
                lang: lang || 'en',
                letter_head: letter_head || '',
                letter_head_content: letterHeadContent,
                page_title: pageTitle,
                doctype_label: doctypeLabel
            })
            renderedDocs.push(rendered)
        } catch (error) {
            console.error("Template rendering error:", error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            return ctx.json({ error: `Template rendering failed: ${errorMessage}` }, 500)
        }
    }

    const finalHtml = renderedDocs.join('\n')

    // Generate PDF using Puppeteer if available
    if (puppeteer) {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            })

            const page = await browser.newPage()
            await page.setContent(finalHtml, { waitUntil: 'networkidle0' })

            const pdfBuffer = await page.pdf({
                format: template?.format || 'A4',
                printBackground: true,
                margin: {
                    top: `${template?.margin_top ?? 10}mm`,
                    right: `${template?.margin_right ?? 10}mm`,
                    bottom: `${template?.margin_bottom ?? 10}mm`,
                    left: `${template?.margin_left ?? 10}mm`
                }
            })

            await browser.close()

            // Return PDF response
            return new Response(pdfBuffer, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": "inline; filename=document.pdf"
                }
            })
        } catch (error) {
            console.error("PDF generation error:", error)
            // Fall back to HTML response if PDF generation fails
        }
    }

    // Fallback to HTML response if puppeteer is not available or PDF generation fails
    return new Response(finalHtml, {
        headers: {
            "Content-Type": "text/html",
            "Content-Disposition": "inline; filename=print.html"
        }
    })
}, {
    query: z.object({
        print_template: z.string().optional(),
        doctype: z.string(),
        lang: z.string().optional(),
        ids: z.string().optional(),
        letter_head: z.string().optional(),
    }),
    method: "GET"
})

// Simple and clean layout conversion
function convertLayoutToTemplate(layoutJson: string, doctypeFields: Record<string, Zodula.Field> = {}, customCSS: string = "", db?: any, lang?: string, defaultCurrency?: string): string {
    try {
        const layout = JSON.parse(layoutJson)
        return generateTemplateRecursive(layout, doctypeFields, customCSS, db, lang, defaultCurrency)
    } catch (error) {
        console.error("Error parsing layout JSON:", error)
        return ""
    }
}

function generateTemplateRecursive(layout: any[], doctypeFields: Record<string, Zodula.Field> = {}, customCSS: string = "", db?: any, lang?: string, defaultCurrency?: string): string {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ page_title }}</title>
    <style>
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
        
        .section-title {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 5px;
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
        
        .field-group.align-left {
            text-align: left;
        }
        
        .field-group.align-right {
            text-align: right;
        }
        
        .field-group.align-center {
            text-align: center;
        }
        
        .field-label {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 2px;
        }
        
        .field-label.align-left {
            text-align: left;
        }
        
        .field-label.align-right {
            text-align: right;
        }
        
        .field-label.align-center {
            text-align: center;
        }
        
        .field-value {
            font-size: 14px;
            min-height: 16px;
            padding: 2px 0;
            word-break: break-all;
        }
        
        .field-value.boolean.true::before {
            content: '✓ ';
        }
        
        .field-value.boolean.false::before {
            content: '✗ ';
        }
        
        .field-value.number {
            text-align: right;
        }
        
        .field-value.currency::before {
            content: '{{ defaultCurrency }}';
        }
        
        .field-value.currency-custom::before {
            content: attr(data-currency);
        }
        
        .field-value.textarea {
            white-space: pre-wrap;
            min-height: 40px;
        }
        
        .field-value.json {
            font-family: monospace;
            font-size: 10px;
            white-space: pre-wrap;
        }
        
        .html-content {
            margin-bottom: 10px;
        }
        
        .letter-head {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        
        .document-header-container {
            margin-bottom: 20px;
            page-break-inside: avoid;
            border-bottom: 1px solid #000;
        }
        
        .document-header {

        }
        
        .document-header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
        }


        .document-header p {
            margin: 0;
            font-size: 14px;
            font-weight: bold;
        }
        
        .reference-table-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
            width: 100%;
            padding: 0 10px 0 0;
        }
        
        .reference-table {
            border: 1px solid #000;
            border-collapse: collapse;
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            display: table;
            table-layout: fixed;
        }
        
        .table-row {
            display: table-row;
            border-bottom: 1px solid #ccc;
        }
        
        .table-row:last-child {
            border-bottom: 1px solid #000;
        }
        
        .table-cell {
            display: table-cell;
            padding: 8px;
            border-right: 1px solid #ccc;
            font-size: 12px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            width: auto;
        }
        
        .table-cell:last-child {
            border-right: 1px solid #000;
        }
        
        .table-header {
            display: table-header-group;
            background-color: #f5f5f5;
            font-weight: bold;
            border-bottom: 2px solid #000;
        }
        
        .table-header .table-cell {
            font-weight: bold;
            background-color: #f5f5f5;
        }
        
        /* Responsive table wrapper */
        .reference-table-section {
            overflow-x: auto;
            max-width: 100%;
            width: 100%;
        }
        
        @media print {
            .reference-table-section {
                overflow: visible;
                width: 100%;
            }
            
            .reference-table {
                overflow: visible;
                display: table;
                width: 100%;
                border: 1px solid #000;
                table-layout: fixed;
            }
            
            .table-row {
                display: table-row;
            }
            
            .table-cell {
                display: table-cell;
                border: 1px solid #000;
                padding: 8px;
                width: auto;
            }
            
            .table-header {
                display: table-header-group;
            }
            
            .table-header .table-cell {
                border: 1px solid #000;
                background-color: #f5f5f5;
                font-weight: bold;
            }
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
        
        .extend-field {
            margin-bottom: 8px;
            display: flex;
            flex-direction: column;
        }
        
        .extend-field-label {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 2px;
        }
        
        .extend-field-value {
            font-size: 13px;
            min-height: 16px;
            padding: 2px 0;
        }
        
        @media print {
            body {
                margin: 0;
            }
            
            .section {
                page-break-inside: avoid;
            }
            
            .reference-table-section {
                page-break-inside: avoid;
            }
            
            .extend-section {
                page-break-inside: avoid;
            }
        }
        
        /* Custom CSS from Print Template */
        ${customCSS || ''}
    </style>
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
        <h1>{{ doctype_label }}</h1>
        <p>{{ doc.id }}</p>
    </div>
</div>
`

    // Use the recursive layout rendering
    html += renderLayoutRecursive(layout, doctypeFields, "doc", defaultCurrency)

    html += `
</body>
</html>`

    return html
}

// Render Reference Table field as a table (default formatting only)
function renderReferenceTableField(field: any, fieldConfig: Zodula.Field, db?: any, lang?: string): string {
    const fieldName = field.value
    const alignClass = field.align ? `align-${field.align}` : ''

    let tableHtml = `    <div class="reference-table-section">\n`
    tableHtml += `        <div class="field-label ${alignClass}">{{ __(fields["${fieldName}"].label) }}</div>\n`
    tableHtml += `        <div class="reference-table">\n`

    // Check if specific fields are provided
    const specifiedFields = field.fields || []

    // Always use default table formatting for Reference Table fields
    const referenceDoctype = fieldConfig?.reference
    if (referenceDoctype) {
        try {
            // Get the reference doctype fields
            const refDoctypeMetadata = loader.from("doctype").get(referenceDoctype as Zodula.DoctypeName)
            const refFields = refDoctypeMetadata.schema.fields

            let displayFields: [string, Zodula.Field][]

            if (specifiedFields.length > 0) {
                // Use specified fields if provided
                displayFields = specifiedFields
                    .map((fieldName: string) => [fieldName, refFields[fieldName]])
                    .filter(([fieldName, fieldConfig]: [string, Zodula.Field]) => fieldConfig) // Only include fields that exist
            } else {
                // Filter out fields that should be displayed (not no_print, not standard fields)
                displayFields = Object.entries(refFields)
                    .filter(([fieldName, fieldConfig]) => {
                        return !fieldConfig.no_print &&
                            !zodula.utils.isStandardField(fieldName) &&
                            fieldConfig.in_list_view
                    })
                    .slice(0, 5) // Limit to 5 columns for better display
            }

            if (displayFields.length > 0) {
                // Render table header
                tableHtml += `            <div class="table-header">\n`
                for (const [refFieldName, refFieldConfig] of displayFields) {
                    tableHtml += `                <div class="table-cell">{{ __("${refFieldConfig.label || refFieldName}") }}</div>\n`
                }
                tableHtml += `            </div>\n`

                // Render table data
                tableHtml += `            {% if doc.${fieldName} and doc.${fieldName}.length > 0 %}\n`
                tableHtml += `                {% for item in doc.${fieldName} %}\n`
                tableHtml += `                    <div class="table-row">\n`
                for (const [refFieldName, refFieldConfig] of displayFields) {
                    const fieldType = refFieldConfig.type || 'Text'
                    const fieldClass = getFieldTypeClass(fieldType)
                    tableHtml += `                        <div class="table-cell ${fieldClass}">{{ item.${refFieldName} or '' }}</div>\n`
                }
                tableHtml += `                    </div>\n`
                tableHtml += `                {% endfor %}\n`
                tableHtml += `            {% else %}\n`
                tableHtml += `                <div class="table-row">\n`
                tableHtml += `                    <div class="table-cell" colspan="${displayFields.length}">No items found</div>\n`
                tableHtml += `                </div>\n`
                tableHtml += `            {% endif %}\n`
            } else {
                // Fallback if no suitable fields found
                tableHtml += `            <div class="table-header">\n`
                tableHtml += `                <div class="table-cell">ID</div>\n`
                tableHtml += `            </div>\n`
                tableHtml += `            {% for item in doc.${fieldName} %}\n`
                tableHtml += `                <div class="table-row">\n`
                tableHtml += `                    <div class="table-cell">{{ item.id }}</div>\n`
                tableHtml += `                </div>\n`
                tableHtml += `            {% endfor %}\n`
            }
        } catch (error) {
            console.warn(`Could not load reference doctype ${referenceDoctype}:`, error)
            // Fallback to simple ID display
            tableHtml += `            {% for item in doc.${fieldName} %}\n`
            tableHtml += `                <div class="table-row">\n`
            tableHtml += `                    <div class="table-cell">{{ item.id }}</div>\n`
            tableHtml += `                </div>\n`
            tableHtml += `            {% endfor %}\n`
        }
    } else {
        // Fallback if no reference doctype
        tableHtml += `            {% for item in doc.${fieldName} %}\n`
        tableHtml += `                <div class="table-row">\n`
        tableHtml += `                    <div class="table-cell">{{ item.id }}</div>\n`
        tableHtml += `                </div>\n`
        tableHtml += `            {% endfor %}\n`
    }

    tableHtml += `        </div>\n`
    tableHtml += `    </div>\n`

    return tableHtml
}

// Recursive rendering for Extend fields that shares logic with main document
function renderExtendFieldRecursive(fieldName: string, fieldConfig: Zodula.Field, doctypeFields: Record<string, Zodula.Field>, defaultCurrency?: string, docPrefix: string = "doc"): string {
    let extendHtml = ''

    // Get the reference doctype fields for the extend field
    if (fieldConfig.reference) {
        try {
            const referenceDoctype = loader.from("doctype").get(fieldConfig.reference as Zodula.DoctypeName)
            const referenceFields = referenceDoctype.schema.fields

            // Generate default layout for the reference doctype (same logic as main document)
            const defaultLayout = generateDefaultLayoutForDoctype(referenceDoctype, referenceFields)

            // Use the proper docPrefix for nested objects
            const nestedDocPrefix = `${docPrefix}["${fieldName}"]`

            // Wrap extend content in a section with proper styling
            extendHtml += `    <div class="extend-section">\n`
            extendHtml += `        <div class="section-title">{{ __("${fieldConfig.label || fieldName}") }}</div>\n`
            extendHtml += `        <div class="extend-content">\n`
            extendHtml += renderLayoutRecursive(defaultLayout, referenceFields, nestedDocPrefix, defaultCurrency, fieldConfig)
            extendHtml += `        </div>\n`
            extendHtml += `    </div>\n`
        } catch (error) {
            console.warn(`Could not load reference doctype ${fieldConfig.reference}:`, error)
            extendHtml += `    <div class="extend-section">\n`
            extendHtml += `        <div class="section-title">{{ __("${fieldConfig.label || fieldName}") }}</div>\n`
            extendHtml += `        <div class="extend-content">\n`
            extendHtml += `            <div class="extend-field">\n`
            extendHtml += `                <div class="extend-field-value">{{ ${docPrefix}["${fieldName}"] }}</div>\n`
            extendHtml += `            </div>\n`
            extendHtml += `        </div>\n`
            extendHtml += `    </div>\n`
        }
    } else {
        // Fallback if no reference
        extendHtml += `    <div class="extend-section">\n`
        // extendHtml += `        <div class="section-title">{{ __("${fieldConfig.label || fieldName}") }}</div>\n`
        extendHtml += `        <div class="extend-content">\n`
        extendHtml += `            <div class="extend-field">\n`
        extendHtml += `                <div class="extend-field-value">{{ ${docPrefix}["${fieldName}"] }}</div>\n`
        extendHtml += `            </div>\n`
        extendHtml += `        </div>\n`
        extendHtml += `    </div>\n`
    }

    return extendHtml
}

// Generate default layout for a doctype (shared logic)
function generateDefaultLayoutForDoctype(doctypeMetadata: DoctypeMetadata, doctypeFields: Record<string, Zodula.Field>): any[] {
    const layout: any[] = []
    const allFieldNames = Object.keys(doctypeFields)
    const fieldsInLayout = new Set<string>()

    // Filter out fields with no_print configuration
    const printableFields = allFieldNames.filter(fieldName => {
        const field = doctypeFields[fieldName]
        return (!field || !field.no_print || field.no_print !== 1) && !zodula.utils.isStandardField(fieldName)
    })

    if (!doctypeMetadata) {
        // Fallback: use all printable fields in a single section
        if (printableFields.length > 0) {
            layout.push({ type: "section", value: "" })

            // Group fields into rows of 1
            for (let i = 0; i < printableFields.length; i += 1) {
                const rowFields = printableFields.slice(i, i + 1).map(fieldName => {
                    fieldsInLayout.add(fieldName)
                    return {
                        type: "field",
                        value: fieldName,
                        align: "left"
                    }
                })
                layout.push(rowFields)
            }
        }
        return layout
    }

    // Check if doctype has tabs
    const tabs = doctypeMetadata.schema.tabs ? JSON.parse(doctypeMetadata.schema.tabs) : []
    if (tabs && tabs.length > 0) {
        // Use tabs to create sections
        for (const tab of tabs) {
            layout.push(...tab.layout)
            // Track fields that are already in the layout
            extractFieldsFromLayout(tab.layout, fieldsInLayout, doctypeFields)
        }
    } else {
        // No tabs - use all printable fields in a single section
        if (printableFields.length > 0) {
            layout.push({ type: "section", value: doctypeMetadata.schema.label })

            // Group fields into rows of 1
            for (let i = 0; i < printableFields.length; i += 1) {
                const rowFields = printableFields.slice(i, i + 1).map(fieldName => {
                    fieldsInLayout.add(fieldName)
                    return {
                        type: "field",
                        value: fieldName,
                        align: "left"
                    }
                })
                layout.push(rowFields)
            }
        }
    }

    // Append remaining printable fields that are not in the layout
    const remainingFields = printableFields.filter(fieldName =>
        !fieldsInLayout.has(fieldName) && !isStandardField(fieldName)
    )
    if (remainingFields.length > 0) {
        // Add a section for remaining fields
        layout.push({ type: "section", value: "Additional" })

        // Group remaining fields into rows of 1
        for (let i = 0; i < remainingFields.length; i += 1) {
            const rowFields = remainingFields.slice(i, i + 1).map(fieldName => ({
                type: "field",
                value: fieldName,
                align: "left"
            }))
            layout.push(rowFields)
        }
    }

    return layout
}

// Recursive layout rendering that handles Extend fields
function renderLayoutRecursive(layout: any[], doctypeFields: Record<string, Zodula.Field>, docPrefix: string = "doc", defaultCurrency?: string, parentField?: Zodula.Field): string {
    let html = ''
    let currentSection = ""

    for (const item of layout) {
        if (Array.isArray(item)) {
            // Array of fields - render as a row
            html += `    <div class="row">\n`
            for (const field of item) {
                if (typeof field === "object" && field !== null && field.type === "field") {
                    const fieldConfig = doctypeFields[field.value]
                    if (!fieldConfig || fieldConfig.no_print === 1) continue

                    // Check if this field should be skipped due to parent field's reference_alias
                    if (parentField && parentField.reference_alias === field.value) {
                        continue
                    }

                    const fieldType = fieldConfig.type || 'Text'
                    const alignClass = field.align ? `align-${field.align}` : ''
                    const labelAlignClass = field.align ? `align-${field.align}` : ''

                    // Handle Reference Table fields
                    if (fieldType === 'Reference Table' && fieldConfig) {
                        const tableHtml = renderReferenceTableField({ value: field.value, align: field.align, fields: field.fields }, fieldConfig)
                        html += tableHtml
                        continue
                    }

                    // Handle Extend fields recursively
                    if (fieldType === 'Extend' && fieldConfig) {
                        const extendHtml = renderExtendFieldRecursive(field.value, fieldConfig, doctypeFields, defaultCurrency, docPrefix)
                        html += extendHtml
                        continue
                    }

                    // Handle currency fields
                    let fieldValueClass = getFieldTypeClass(fieldType)
                    let currencyAttr = ''

                    if (fieldType === 'Currency' && fieldConfig) {
                        const currencySymbol = getCurrencySymbol(fieldConfig, defaultCurrency || '$')
                        if (currencySymbol !== defaultCurrency) {
                            fieldValueClass = 'currency-custom'
                            currencyAttr = ` data-currency="${currencySymbol}"`
                        }
                    }

                    const fieldHtml = `        <div class="field-group ${alignClass}">\n` +
                        `            <div class="field-label ${labelAlignClass}">{{ __(fields["${field.value}"].label) }}</div>\n` +
                        `            <div class="field-value ${fieldValueClass}"${currencyAttr}>\n` +
                        `                {{ ${docPrefix}["${field.value}"] }}\n` +
                        `            </div>\n` +
                        `        </div>\n`

                    html += fieldHtml
                }
            }
            html += `    </div>\n`
        } else if (typeof item === "object" && item !== null) {
            if (item.type === "section") {
                // Close previous section
                if (currentSection) {
                    html += `    </div>\n`
                }
                currentSection = item.value || ""
                html += `    <div class="section">\n`
                // html += `        <div class="section-title">{{ __("${currentSection}") }}</div>\n`
            } else if (item.type === "field") {
                // Single field - handle recursively
                const fieldConfig = doctypeFields[item.value]
                if (!fieldConfig || fieldConfig.no_print === 1) continue

                // Check if this field should be skipped due to parent field's reference_alias
                if (parentField && parentField.reference_alias === item.value) {
                    continue
                }

                const fieldType = fieldConfig.type || 'Text'

                // Handle Reference Table fields
                if (fieldType === 'Reference Table' && fieldConfig) {
                    const tableHtml = renderReferenceTableField({ value: item.value, align: item.align, fields: item.fields }, fieldConfig)
                    html += tableHtml
                    continue
                }

                // Handle Extend fields recursively
                if (fieldType === 'Extend' && fieldConfig) {
                    const extendHtml = renderExtendFieldRecursive(item.value, fieldConfig, doctypeFields, defaultCurrency, docPrefix)
                    html += extendHtml
                    continue
                }

                // Regular field rendering
                html += renderSingleField(item, fieldConfig, docPrefix, defaultCurrency)
            }
        }
    }

    // Close the last section
    if (currentSection) {
        html += `    </div>\n`
    }

    return html
}

// Render a single field (shared logic)
function renderSingleField(field: any, fieldConfig: Zodula.Field, docPrefix: string = "doc", defaultCurrency?: string): string {
    const fieldType = fieldConfig.type || 'Text'
    const alignClass = field.align ? `align-${field.align}` : ''
    const labelAlignClass = field.align ? `align-${field.align}` : ''

    // Handle currency fields
    let fieldValueClass = getFieldTypeClass(fieldType)
    let currencyAttr = ''

    if (fieldType === 'Currency' && fieldConfig) {
        const currencySymbol = getCurrencySymbol(fieldConfig, defaultCurrency || '$')
        if (currencySymbol !== defaultCurrency) {
            fieldValueClass = 'currency-custom'
            currencyAttr = ` data-currency="${currencySymbol}"`
        }
    }

    const result = `    <div class="row">\n` +
        `        <div class="field-group ${alignClass}">\n` +
        `            <div class="field-label ${labelAlignClass}">{{ __(fields["${field.value}"].label) }}</div>\n` +
        `            <div class="field-value ${fieldValueClass}"${currencyAttr}>\n` +
        `                {{ ${docPrefix}["${field.value}"] }}\n` +
        `            </div>\n` +
        `        </div>\n` +
        `    </div>\n`

    return result
}

function getFieldTypeClass(fieldType: string): string {
    const typeMap: Record<string, string> = {
        'Check': 'boolean',
        'Integer': 'number',
        'Float': 'number',
        'Currency': 'currency',
        'Date': 'date',
        'Datetime': 'date',
        'Time': 'date',
        'Text': 'text',
        'Textarea': 'text',
        'Select': 'text',
        'Link': 'text',
        'Table': 'text',
        'JSON': 'text'
    }
    return typeMap[fieldType] || 'text'
}

function getCurrencySymbol(fieldConfig: Zodula.Field, defaultCurrency: string): string {
    return fieldConfig?.currency_symbol || defaultCurrency
}

// Generate default layout from doctype tabs or fields
function generateDefaultLayout(doctypeMetadata: DoctypeMetadata, doctypeFields: Record<string, Zodula.Field>): any[] {
    const layout: any[] = []
    const allFieldNames = Object.keys(doctypeFields)
    const fieldsInLayout = new Set<string>()

    // Filter out fields with no_print configuration
    const printableFields = allFieldNames.filter(fieldName => {
        const field = doctypeFields[fieldName]
        return (!field || !field.no_print || field.no_print !== 1) && !zodula.utils.isStandardField(fieldName)
    })

    if (!doctypeMetadata) {
        // Fallback: use all printable fields in a single section
        if (printableFields.length > 0) {
            layout.push({ type: "section", value: "" })

            // Group fields into rows of 1
            for (let i = 0; i < printableFields.length; i += 1) {
                const rowFields = printableFields.slice(i, i + 1).map(fieldName => {
                    fieldsInLayout.add(fieldName)
                    return {
                        type: "field",
                        value: fieldName,
                        align: "left"
                    }
                })
                layout.push(rowFields)
            }
        }
        return layout
    }

    // Check if doctype has tabs
    const tabs = doctypeMetadata.schema.tabs ? JSON.parse(doctypeMetadata.schema.tabs) : []
    if (tabs && tabs.length > 0) {
        // Use tabs to create sections
        for (const tab of tabs) {
            layout.push(...tab.layout)
            // Track fields that are already in the layout
            extractFieldsFromLayout(tab.layout, fieldsInLayout, doctypeFields)
        }
    } else {
        // No tabs - use all printable fields in a single section
        if (printableFields.length > 0) {
            // layout.push({ type: "section", value: "" })

            // Group fields into rows of 1
            for (let i = 0; i < printableFields.length; i += 1) {
                const rowFields = printableFields.slice(i, i + 1).map(fieldName => {
                    fieldsInLayout.add(fieldName)
                    return {
                        type: "field",
                        value: fieldName,
                        align: "left"
                    }
                })
                layout.push(rowFields)
            }
        }
    }

    // Append remaining printable fields that are not in the layout
    // Exclude standard fields from additional fields
    const remainingFields = printableFields.filter(fieldName =>
        !fieldsInLayout.has(fieldName) && !isStandardField(fieldName)
    )
    if (remainingFields.length > 0) {
        // Add a section for remaining fields
        layout.push({ type: "section", value: "Additional" })

        // Group remaining fields into rows of 1
        for (let i = 0; i < remainingFields.length; i += 1) {
            const rowFields = remainingFields.slice(i, i + 1).map(fieldName => ({
                type: "field",
                value: fieldName,
                align: "left"
            }))
            layout.push(rowFields)
        }
    }

    return layout
}

// Helper function to extract field names from layout
function extractFieldsFromLayout(layout: any[], fieldsSet: Set<string>, doctypeFields: Record<string, Zodula.Field> = {}): void {
    for (const item of layout) {
        if (Array.isArray(item)) {
            // Array of fields - extract field names
            for (const field of item) {
                if (typeof field === "object" && field !== null && field.type === "field") {
                    // Only add fields that are not marked as no_print
                    const fieldConfig = doctypeFields[field.value]
                    if (!fieldConfig || !fieldConfig.no_print || fieldConfig.no_print !== 1) {
                        fieldsSet.add(field.value)
                    }
                } else if (typeof field === "string" && field.trim() !== '') {
                    // Only add fields that are not marked as no_print
                    const fieldConfig = doctypeFields[field]
                    if (!fieldConfig || !fieldConfig.no_print || fieldConfig.no_print !== 1) {
                        fieldsSet.add(field)
                    }
                }
            }
        } else if (typeof item === "object" && item !== null && item.type === "field") {
            // Only add fields that are not marked as no_print
            const fieldConfig = doctypeFields[item.value]
            if (!fieldConfig || !fieldConfig.no_print || fieldConfig.no_print !== 1) {
                fieldsSet.add(item.value)
            }
        }
    }
}
