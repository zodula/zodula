import { z } from "bxo"
import puppeteer from "puppeteer"
import path from "path"
import { getFieldValueFromDoc } from "@/zodula/client/utils"
// @ts-ignore - binba may not have type definitions
import { Template } from "binba"

// Page format dimensions in mm
const PAGE_FORMATS: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
}

function mmToPx(mm: number): number {
  return (mm * 96) / 25.4 // 96 DPI
}

function pxToMm(px: number): number {
  return (px * 25.4) / 96 // Convert pixels to mm at 96 DPI
}

function getFieldValue(doc: any, fieldName: string): string {
  if (!doc || !fieldName) return ""
  const value = doc[fieldName]
  if (value === null || value === undefined) return ""
  return String(value)
}

// Calculate anchor position for an item (with optional measured heights)
function calculateAnchorPosition(
  item: any,
  allItems: any[],
  visited: Set<string> = new Set(),
  measuredHeights?: Map<string, number>
): { x: number; y: number } {
  // Parse anchor config
  let anchorConfig: any = null
  if (item.anchor_config) {
    if (typeof item.anchor_config === "string") {
      try {
        anchorConfig = JSON.parse(item.anchor_config)
      } catch (e) {
        // Ignore parse errors
      }
    } else if (typeof item.anchor_config === "object") {
      anchorConfig = item.anchor_config
    }
  }
  
  if (!anchorConfig || !anchorConfig.anchorTo) {
    return { x: item.transform_x || 0, y: item.transform_y || 0 }
  }
  
  // Prevent infinite loops
  if (visited.has(item.id)) {
    return { x: item.transform_x || 0, y: item.transform_y || 0 }
  }
  visited.add(item.id)
  
  const anchorItem = allItems.find((i: any) => i.id === anchorConfig.anchorTo)
  if (!anchorItem) {
    return { x: item.transform_x || 0, y: item.transform_y || 0 }
  }
  
  // Recursively calculate anchor position
  const anchorPos = calculateAnchorPosition(anchorItem, allItems, visited, measuredHeights)
  const anchorX = anchorPos.x
  const anchorY = anchorPos.y
  const anchorWidth = anchorItem.transform_width || 0
  // Use measured height if available, otherwise use transform_height
  const anchorHeight = measuredHeights?.get(anchorItem.id) || anchorItem.transform_height || 0
  const offset = anchorConfig.anchorOffset || 0
  const position = anchorConfig.anchorPosition || "bottom"
  
  let newX = item.transform_x || 0
  let newY = item.transform_y || 0
  
  switch (position) {
    case "top":
      const itemHeight = measuredHeights?.get(item.id) || item.transform_height || 0
      newX = anchorX
      newY = anchorY - itemHeight - (typeof offset === "number" ? offset : 0)
      break
    case "bottom":
      newX = anchorX
      newY = anchorY + anchorHeight + (typeof offset === "number" ? offset : 0)
      break
    case "left":
      const itemWidth = item.transform_width || 0
      newX = anchorX - itemWidth - (typeof offset === "number" ? offset : 0)
      newY = anchorY
      break
    case "right":
      newX = anchorX + anchorWidth + (typeof offset === "number" ? offset : 0)
      newY = anchorY
      break
    case "inside":
      const offsetX = typeof offset === "object" ? offset.x : 0
      const offsetY = typeof offset === "object" ? offset.y : 0
      newX = anchorX + offsetX
      newY = anchorY + offsetY
      break
  }
  
  return { x: newX, y: newY }
}

// Calculate actual height for an item (especially for reference tables)
function calculateItemHeight(
  item: any,
  doc: any
): number {
  const { type, transform_height = 30, fields, field_name } = item
  
  // For reference tables, calculate height based on actual data
  if (type === "field" && fields && typeof fields === "string") {
    try {
      const childFields = JSON.parse(fields)
      if (Array.isArray(childFields) && childFields.length > 0) {
        const parentFieldValue = doc[field_name]
        if (Array.isArray(parentFieldValue) && parentFieldValue.length > 0) {
          // Parse table config
          let tableConfig: any = null
          if (item.table_config && typeof item.table_config === "string") {
            try {
              tableConfig = JSON.parse(item.table_config)
            } catch (e) {
              // Ignore parse errors
            }
          } else if (item.table_config) {
            tableConfig = item.table_config
          }
          
          const showHeader = tableConfig?.showHeader !== false
          const rowHeight = tableConfig?.rowHeight || 20
          const showBorder = tableConfig?.showBorder !== false
          
          // Calculate total height based on actual table structure
          let totalHeight = 0
          
          // Header row height
          if (showHeader) {
            totalHeight += rowHeight
            if (showBorder) {
              totalHeight += 1 // Top border of table
            }
          }
          
          // Data rows height
          totalHeight += parentFieldValue.length * rowHeight
          
          // Row borders (between rows)
          if (showBorder) {
            totalHeight += parentFieldValue.length * 1 // Border between each row
            if (showHeader) {
              totalHeight += 1 // Border between header and first row
            }
          }
          
          // Padding (2px top + 2px bottom = 4px total, but we account for it in row height)
          // The rowHeight already includes padding, so we don't need to add extra
          
          console.log(`[PDF] Table height calculation for ${item.id}: ${parentFieldValue.length} rows, rowHeight=${rowHeight}px, showHeader=${showHeader}, showBorder=${showBorder}, calculated=${totalHeight}px, original=${transform_height}px`)
          
          // Use the maximum of calculated height and original height
          return Math.max(totalHeight, transform_height)
        }
      }
    } catch (e) {
      console.error(`[PDF] Error calculating height for item ${item.id}:`, e)
      // If parsing fails, return transform_height
    }
  }
  
  return transform_height
}

async function renderTemplateItem(
  item: any,
  doc: any,
  baseUrl: string,
  sessionContext?: any,
  allItems?: any[],
  measuredHeights?: Map<string, number>
): Promise<string> {
  const {
    type,
    value,
    field_name,
    label,
    label_position = "left",
    align = "left",
    vertical_align = "middle",
    transform_x = 0,
    transform_y = 0,
    transform_width = 200,
    transform_height = 30,
    style_font_size,
    style_font_weight,
    style_color,
    style_background_color,
    style_border,
    style_padding,
    style_margin,
    image,
    reference_doctype,
    reference_id_filter,
    reference_field,
    fields,
  } = item

  // Calculate actual position (accounting for anchors)
  let actualX = transform_x
  let actualY = transform_y
  if (allItems) {
    const anchorPos = calculateAnchorPosition(item, allItems, new Set(), measuredHeights)
    actualX = anchorPos.x
    actualY = anchorPos.y
  }
  
  // Use measured height if available, otherwise use transform_height
  const actualHeight = measuredHeights?.get(item.id) || transform_height

  const style: string[] = []
  style.push(`position: absolute`)
  // Convert pixels to mm (builder stores coordinates in pixels, PDF needs mm)
  style.push(`left: ${pxToMm(actualX)}mm`)
  style.push(`top: ${pxToMm(actualY)}mm`)
  style.push(`width: ${pxToMm(transform_width)}mm`)
  // Use measured height if available, otherwise use transform_height
  const isReferenceTable = type === "field" && fields
  if (!isReferenceTable) {
    style.push(`height: ${pxToMm(actualHeight)}mm`)
  } else {
    // For reference tables, use min-height and let content determine height
    // But if we have a measured height, use it
    if (measuredHeights?.has(item.id)) {
      style.push(`height: ${pxToMm(actualHeight)}mm`)
    } else {
      style.push(`min-height: ${pxToMm(transform_height)}mm`)
    }
  }

  // Alignment
  if (align === "center") {
    style.push(`text-align: center`)
  } else if (align === "right") {
    style.push(`text-align: right`)
  } else {
    style.push(`text-align: left`)
  }

  if (vertical_align === "middle") {
    style.push(`display: flex`)
    style.push(`align-items: center`)
  } else if (vertical_align === "top") {
    style.push(`display: flex`)
    style.push(`align-items: flex-start`)
  } else if (vertical_align === "bottom") {
    style.push(`display: flex`)
    style.push(`align-items: flex-end`)
  }

  // Custom styles
  if (style_font_size) style.push(`font-size: ${style_font_size}px`)
  if (style_font_weight) style.push(`font-weight: ${style_font_weight}`)
  if (style_color) style.push(`color: ${style_color}`)
  if (style_background_color) style.push(`background-color: ${style_background_color}`)
  if (style_border) style.push(`border: ${style_border}`)
  if (style_padding) style.push(`padding: ${style_padding}`)
  if (style_margin) style.push(`margin: ${style_margin}`)

  let content = ""

  switch (type) {
    case "text":
      content = value || ""
      break

    case "field": {
      let fieldValue = field_name ? getFieldValue(doc, field_name) : ""
      
      // Handle nested fields for Reference Table/Extend types
      if (fields && typeof fields === "string") {
        try {
          const childFields = JSON.parse(fields)
          if (Array.isArray(childFields) && childFields.length > 0) {
            // Get the field value (should be an array of child documents)
            const parentFieldValue = doc[field_name]
            if (Array.isArray(parentFieldValue) && parentFieldValue.length > 0) {
              // Parse table config if available
              let tableConfig: any = null
              if (item.table_config && typeof item.table_config === "string") {
                try {
                  tableConfig = JSON.parse(item.table_config)
                } catch (e) {
                  // Ignore parse errors
                }
              } else if (item.table_config) {
                tableConfig = item.table_config
              }
              
              // Get column configuration
              const columns = tableConfig?.columns || childFields.map((f: string, idx: number) => ({ field: f, order: idx }))
              const sortedColumns = [...columns].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
              const showHeader = tableConfig?.showHeader !== false
              const showBorder = tableConfig?.showBorder !== false
              const rowHeight = tableConfig?.rowHeight || 20
              
              // Calculate total width of specified columns
              const elementWidthPx = transform_width
              const elementWidthMm = pxToMm(elementWidthPx)
              const specifiedWidths = sortedColumns.filter((col: any) => col.width).map((col: any) => col.width)
              const totalSpecifiedWidth = specifiedWidths.reduce((sum: number, w: number) => sum + w, 0)
              const columnsWithWidth = sortedColumns.filter((col: any) => col.width).length
              const columnsWithoutWidth = sortedColumns.length - columnsWithWidth
              
              // Build table with configuration
              const tableStyles: string[] = []
              tableStyles.push(`width: ${elementWidthMm}mm`)
              tableStyles.push("border-collapse: collapse")
              tableStyles.push("table-layout: fixed")
              
              const borderStyle = showBorder ? "1px solid #000" : "none"
              
              // Render rows
              const rows = parentFieldValue.map((childDoc: any) => {
                const cells = sortedColumns.map((col: any) => {
                  const childValue = getFieldValue(childDoc, col.field)
                  const cellStyles: string[] = []
                  
                  // Calculate column width
                  if (col.width) {
                    // Use specified width, converted to mm
                    cellStyles.push(`width: ${pxToMm(col.width)}mm`)
                  } else if (columnsWithoutWidth > 0) {
                    // Distribute remaining width equally among unspecified columns
                    const remainingWidth = elementWidthPx - totalSpecifiedWidth
                    const autoWidth = remainingWidth / columnsWithoutWidth
                    cellStyles.push(`width: ${pxToMm(autoWidth)}mm`)
                  } else {
                    // All columns have width, distribute equally
                    cellStyles.push(`width: ${elementWidthMm / sortedColumns.length}mm`)
                  }
                  
                  if (showBorder) {
                    cellStyles.push(`border: ${borderStyle}`)
                  }
                  // Use min-height for dynamic row height
                  cellStyles.push(`min-height: ${pxToMm(rowHeight)}mm`)
                  cellStyles.push(`padding: 2px`)
                  cellStyles.push(`overflow: hidden`)
                  cellStyles.push(`text-overflow: ellipsis`)
                  return `<td style="${cellStyles.join("; ")}">${childValue}</td>`
                }).join("")
                const rowStyles: string[] = []
                if (showBorder) {
                  rowStyles.push(`border-bottom: ${borderStyle}`)
                }
                return `<tr style="${rowStyles.join("; ")}">${cells}</tr>`
              }).join("")
              
              // Render headers if enabled
              let headers = ""
              if (showHeader) {
                const headerCells = sortedColumns.map((col: any) => {
                  const headerStyles: string[] = []
                  
                  // Calculate column width (same logic as cells)
                  if (col.width) {
                    headerStyles.push(`width: ${pxToMm(col.width)}mm`)
                  } else if (columnsWithoutWidth > 0) {
                    const remainingWidth = elementWidthPx - totalSpecifiedWidth
                    const autoWidth = remainingWidth / columnsWithoutWidth
                    headerStyles.push(`width: ${pxToMm(autoWidth)}mm`)
                  } else {
                    headerStyles.push(`width: ${elementWidthMm / sortedColumns.length}mm`)
                  }
                  
                  if (showBorder) {
                    headerStyles.push(`border: ${borderStyle}`)
                  }
                  headerStyles.push(`padding: 2px`)
                  headerStyles.push(`font-weight: bold`)
                  headerStyles.push(`background-color: #f0f0f0`)
                  headerStyles.push(`overflow: hidden`)
                  headerStyles.push(`text-overflow: ellipsis`)
                  return `<th style="${headerStyles.join("; ")}">${col.field}</th>`
                }).join("")
                headers = `<thead><tr style="border-bottom: ${borderStyle}">${headerCells}</tr></thead>`
              }
              
              fieldValue = `<table style="${tableStyles.join("; ")}">${headers}<tbody>${rows}</tbody></table>`
            }
          }
        } catch (e) {
          // If parsing fails, just use the field value as is
        }
      }
      
      const labelText = label || ""
      
      if (labelText && label_position === "top") {
        content = `<div style="display: flex; flex-direction: column;"><span style="font-size: 0.9em; opacity: 0.7;">${labelText}</span><span>${fieldValue}</span></div>`
      } else if (labelText && label_position === "bottom") {
        content = `<div style="display: flex; flex-direction: column;"><span>${fieldValue}</span><span style="font-size: 0.9em; opacity: 0.7;">${labelText}</span></div>`
      } else if (labelText && label_position === "left") {
        content = `<span style="margin-right: 0.5em; font-size: 0.9em; opacity: 0.7;">${labelText}</span><span>${fieldValue}</span>`
      } else if (labelText && label_position === "right") {
        content = `<span>${fieldValue}</span><span style="margin-left: 0.5em; font-size: 0.9em; opacity: 0.7;">${labelText}</span>`
      } else {
        content = fieldValue
      }
      break
    }

    case "image": {
      const imagePath = image || value || ""
      if (imagePath) {
        let imageUrl = imagePath
        if (!imagePath.startsWith("http") && !imagePath.startsWith("data:")) {
          // Construct file URL
          imageUrl = `${baseUrl}/files/zodula__Print Template Item/${item.id}/image/${imagePath}`
        }
        content = `<img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`
      }
      break
    }

    case "line": {
      style.push(`border-top: 1px solid #000`)
      style.push(`height: 1px`)
      content = ""
      break
    }

    case "reference": {
      // Fetch referenced document
      let refValue = ""
      if (reference_doctype && reference_field) {
        try {
          // Parse reference_id_filter (e.g., "{{session.organization}}")
          let refId = reference_id_filter || ""
          if (refId.includes("{{")) {
            // Replace template variables
            refId = refId.replace(/\{\{session\.(\w+)\}\}/g, (_: string, key: string) => {
              return sessionContext?.[key] || ""
            })
            refId = refId.replace(/\{\{doc\.(\w+)\}\}/g, (_: string, key: string) => {
              return getFieldValue(doc, key) || ""
            })
          }
          
          if (refId) {
            const refDoc = await $zodula.doctype(reference_doctype as any).get(refId).bypass(true)
            if (refDoc) {
              refValue = getFieldValue(refDoc, reference_field)
            }
          }
        } catch (e) {
          refValue = `Error: ${e}`
        }
      }
      
      const labelText = label || ""
      
      if (labelText && label_position === "top") {
        content = `<div style="display: flex; flex-direction: column;"><span style="font-size: 0.9em; opacity: 0.7;">${labelText}</span><span>${refValue}</span></div>`
      } else if (labelText && label_position === "bottom") {
        content = `<div style="display: flex; flex-direction: column;"><span>${refValue}</span><span style="font-size: 0.9em; opacity: 0.7;">${labelText}</span></div>`
      } else if (labelText && label_position === "left") {
        content = `<span style="margin-right: 0.5em; font-size: 0.9em; opacity: 0.7;">${labelText}</span><span>${refValue}</span>`
      } else if (labelText && label_position === "right") {
        content = `<span>${refValue}</span><span style="margin-left: 0.5em; font-size: 0.9em; opacity: 0.7;">${labelText}</span>`
      } else {
        content = refValue
      }
      break
    }

    case "custom_html": {
      // Use binba to render custom HTML template
      try {
        const template = value || ""
        const rendered = await Template.render(template, { doc, ...doc })
        content = rendered
      } catch (e: any) {
        content = `Error rendering template: ${e?.message || e}`
      }
      break
    }

    default:
      content = ""
  }

  // Add data-item-id attribute for identification during measurement
  return `<div data-item-id="${item.id}" style="${style.join("; ")}">${content}</div>`
}

export default $action(async (ctx) => {
  const { print_template, doctype, ids: idsParam, lang, letter_head, format = "pdf" } = ctx.query

  // Handle ids as string or array
  const ids = Array.isArray(idsParam) ? idsParam : idsParam ? [idsParam] : []

  // Get base URL
  const baseUrl = ctx.request.url.split("/api")[0] || "http://localhost:3000"
  
  // Get session context for reference filters
  const sessionContext: any = {}
  try {
    const user = await $zodula.session.user(true).catch(() => null)
    const organization = await $zodula.session.organization(true).catch(() => null)
    if (user) sessionContext.user = user.id
    if (organization) sessionContext.organization = organization
  } catch (e) {
    // Ignore session errors
  }

  // Fetch print template
  const template = await $zodula.doctype("zodula__Print Template").get(print_template).bypass(true)
  if (!template) {
    return ctx.json({ error: "Print template not found" }, 404)
  }

  console.log("[PDF] Print template ID:", print_template)
  console.log("[PDF] Template name:", template.name)

  // Fetch template items - try multiple approaches
  let items: any[] = []
  
  // Approach 1: Direct query
  try {
    const result = await $zodula.doctype("zodula__Print Template Item")
      .select()
      .where("print_template", "=", print_template)
      .sort("idx", "asc")
      .bypass(true)
    items = result.docs || []
    console.log("[PDF] Direct query found items:", items.length)
  } catch (e) {
    console.error("[PDF] Direct query error:", e)
  }

  // Approach 2: Try accessing via relationship if direct query fails
  if (items.length === 0) {
    try {
      // Try getting template with items relationship
      const templateWithItems = await $zodula.doctype("zodula__Print Template")
        .get(print_template)
        .fields(["*", "items"] as any)
        .bypass(true)
      
      if (templateWithItems && (templateWithItems as any).items) {
        items = (templateWithItems as any).items || []
        console.log("[PDF] Relationship query found items:", items.length)
      }
    } catch (e) {
      console.error("[PDF] Relationship query error:", e)
    }
  }

  // Approach 3: Try without sort if still no items
  if (items.length === 0) {
    try {
      const result = await $zodula.doctype("zodula__Print Template Item")
        .select()
        .where("print_template", "=", print_template)
        .bypass(true)
      items = result.docs || []
      console.log("[PDF] Query without sort found items:", items.length)
    } catch (e) {
      console.error("[PDF] Query without sort error:", e)
    }
  }

  // Debug: Check if any items exist at all for this template
  if (items.length === 0) {
    try {
      const allItems = await $zodula.doctype("zodula__Print Template Item")
        .select()
        .limit(10)
        .bypass(true)
      console.log("[PDF] Total items in database (sample):", allItems.docs.length)
      if (allItems.docs.length > 0) {
        console.log("[PDF] Sample item print_template value:", allItems.docs[0]?.print_template)
        console.log("[PDF] Looking for print_template:", print_template)
        // Check if any match
        const matching = allItems.docs.filter((item: any) => item.print_template === print_template)
        console.log("[PDF] Matching items found:", matching.length)
      }
    } catch (e) {
      console.error("[PDF] Debug query error:", e)
    }
  }

  // Fetch documents
  const documents: any[] = []
  for (const id of ids) {
    const doc = await $zodula.doctype(doctype as any).get(id).bypass(true)
    if (doc) {
      documents.push(doc)
    }
  }

  if (documents.length === 0) {
    return ctx.json({ error: "No documents found" }, 404)
  }

  console.log("[PDF] Template items count:", items.length)
  console.log("[PDF] Documents count:", documents.length)

  // Fetch letter head if provided
  let letterHead: any = null
  let letterHeadItems: any[] = []
  if (letter_head) {
    letterHead = await $zodula.doctype("zodula__Letter Head").get(letter_head).bypass(true)
    if (letterHead) {
      const { docs: lhItems } = await $zodula.doctype("zodula__Letter Head Item")
        .select()
        .where("letter_head", "=", letter_head)
        .sort("idx", "asc")
        .bypass(true)
      letterHeadItems = lhItems
    }
  }

  // Determine page dimensions
  const pageFormat = template.format || "A4"
  const pageDims: { width: number; height: number } = pageFormat === "Custom"
    ? { width: template.custom_width || 210, height: template.custom_height || 297 }
    : (PAGE_FORMATS[pageFormat] ?? { width: 210, height: 297 })

  // Generate HTML for each document
  const htmlPages: string[] = []

  for (const doc of documents) {
    // Render letter head items if any
    let letterHeadHtml = ""
    if (letterHeadItems.length > 0) {
      const letterHeadPromises = letterHeadItems.map((item) => renderTemplateItem(item, doc, baseUrl, sessionContext, letterHeadItems))
      const letterHeadResults = await Promise.all(letterHeadPromises)
      letterHeadHtml = letterHeadResults.join("")
    }

    // Calculate actual heights of all elements (especially for reference tables)
    // We calculate directly from data instead of using jsdom since jsdom doesn't do layout
    const measuredHeights = new Map<string, number>()
    items.forEach((item) => {
      // Calculate height based on item type and data
      const calculatedHeight = calculateItemHeight(item, doc)
      measuredHeights.set(item.id, calculatedHeight)
      console.log(`[PDF] Calculated height for item ${item.id} (${item.type}): ${calculatedHeight}px (original: ${item.transform_height}px)`)
    })
    
    // Render template items with anchor calculations using measured heights
    const itemPromises = items.map((item) => renderTemplateItem(item, doc, baseUrl, sessionContext, items, measuredHeights))
    const itemResults = await Promise.all(itemPromises)
    const itemsHtml = itemResults.join("")

    // Build HTML with correct anchor positions
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: ${pageDims.width}mm ${pageDims.height}mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }
    body {
      font-family: Arial, sans-serif;
      position: relative;
    }
    .page-container {
      position: relative;
      width: ${pageDims.width}mm;
      min-height: ${pageDims.height}mm;
      margin: 0;
      padding: 0;
      overflow: visible;
    }
    ${template.css || ""}
    ${letterHead?.css_content || ""}
  </style>
</head>
<body>
  <div class="page-container">
    ${letterHeadHtml}
    ${itemsHtml}
  </div>
</body>
</html>`

    console.log("[PDF] Generated HTML length:", html.length)
    console.log("[PDF] Items HTML length:", itemsHtml.length)
    console.log("[PDF] Letter head HTML length:", letterHeadHtml.length)
    
    // If no content at all, add a debug message
    if (!itemsHtml && !letterHeadHtml) {
      console.error("[PDF] Error: No content generated. Items:", items.length, "Letter head items:", letterHeadItems.length)
    }
    
    htmlPages.push(html)
  }

  // If format is HTML, return HTML (useful for debugging)
  if (format === "html") {
    return new Response(htmlPages[0] || "", {
    headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  }

  // Debug: Log if no items found
  if (items.length === 0) {
    console.warn("[PDF] Warning: No template items found for template:", print_template)
    // Return error if no items
    return ctx.json({ error: "No template items found. Please add items to the print template." }, 400)
  }

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    const pdfBuffers: Buffer[] = []

    for (const html of htmlPages) {
      const page = await browser.newPage()
      
      // Set viewport to match page size
      await page.setViewport({
        width: Math.round((pageDims.width * 96) / 25.4), // Convert mm to pixels
        height: Math.round((pageDims.height * 96) / 25.4),
      })
      
      await page.setContent(html, { waitUntil: "domcontentloaded" })
      
      // Wait a bit for any async content to load
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Debug: Take a screenshot to see what's rendered (optional, can be removed)
      // await page.screenshot({ path: '/tmp/debug-pdf.png', fullPage: true })
      
      const pdfBuffer = await page.pdf({
        format: pageFormat === "Custom" ? undefined : (pageFormat as any),
        width: pageFormat === "Custom" ? `${pageDims.width}mm` : undefined,
        height: pageFormat === "Custom" ? `${pageDims.height}mm` : undefined,
        margin: {
          top: `${template.margin_top || 10}mm`,
          right: `${template.margin_right || 10}mm`,
          bottom: `${template.margin_bottom || 10}mm`,
          left: `${template.margin_left || 10}mm`,
        },
        printBackground: true,
        preferCSSPageSize: false,
      })
      pdfBuffers.push(Buffer.from(pdfBuffer))
      await page.close()
    }

    await browser.close()

    // Combine multiple PDFs if needed (for now, just return first)
    const pdfBuffer = pdfBuffers[0] || Buffer.from("")

    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
      },
    })
  } catch (error: any) {
    await browser.close()
    return ctx.json({ error: error.message || "Failed to generate PDF" }, 500)
  }
}, {
  query: z.object({
    print_template: z.string(),
    doctype: z.string(),
    ids: z.union([z.string(), z.array(z.string())]),
    lang: z.string().nullable().optional(),
    letter_head: z.string().nullable().optional(),
    format: z.enum(["pdf", "html"]).optional()
  }),
  method: "GET",
})