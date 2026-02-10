import { z } from "bxo"
import puppeteer from "puppeteer"
import path from "path"
import fs from "fs"
import { getFieldValueFromDoc } from "@/zodula/client/utils"
import { PAGE_FORMATS, generateTemplateFromTabs, type PrintTemplateElement, type ChildField } from "@/zodula/client/code-utils"
// @ts-ignore - binba may not have type definitions
import { Template } from "binba"

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

// Helper function to read file from filesystem and convert to base64 data URL
async function getFileAsDataUrl(filePathOrUrl: string): Promise<string | null> {
  try {
    // Parse the file path/URL - extract the path after /files/
    let relativePath = filePathOrUrl
    
    // If it's a full URL, extract the path
    if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
      try {
        const urlObj = new URL(filePathOrUrl)
        relativePath = urlObj.pathname
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        const filesIndex = filePathOrUrl.indexOf("/files/")
        if (filesIndex !== -1) {
          relativePath = filePathOrUrl.substring(filesIndex + 1) // Include /files/
        }
      }
    }
    
    // Remove leading slash if present and ensure we have the files/ prefix
    if (relativePath.startsWith("/")) {
      relativePath = relativePath.substring(1)
    }
    if (!relativePath.startsWith("files/")) {
      relativePath = `files/${relativePath}`
    }
    
    // Construct filesystem path: .zodula_data/files/{organization}/{doctype}/{docName}/{fieldName}/{fileName}
    const zodulaDataPath = path.join(process.cwd(), ".zodula_data")
    const fullPath = path.join(zodulaDataPath, relativePath)
    
    // Check if file exists
    if (fs.existsSync(fullPath)) {
      try {
        // Read file
        const fileBuffer = fs.readFileSync(fullPath)
        
        // Determine MIME type from file extension
        const ext = path.extname(fullPath).toLowerCase()
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".bmp": "image/bmp",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon"
        }
        const mimeType = mimeTypes[ext] || "image/png"
        
        // Convert to base64 data URL
        const base64 = fileBuffer.toString("base64")
        return `data:${mimeType};base64,${base64}`
      } catch (readError) {
        console.error(`[PDF] Error reading file ${fullPath}:`, readError)
        return null
      }
    } else {
      console.warn(`[PDF] File not found: ${fullPath} (from ${filePathOrUrl})`)
      return null
    }
  } catch (error) {
    console.error(`[PDF] Error processing file ${filePathOrUrl}:`, error)
    return null
  }
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
  
  // Find anchor element by code first (preferred), then by id (fallback for backward compatibility)
  const anchorItem = allItems.find((i: any) => {
    if (i.code && anchorConfig.anchorTo === i.code) return true
    if (anchorConfig.anchorTo === i.id) return true
    return false
  })
  
  if (!anchorItem) {
    return { x: item.transform_x || 0, y: item.transform_y || 0 }
  }
  
  // Recursively calculate anchor position
  const anchorPos = calculateAnchorPosition(anchorItem, allItems, visited, measuredHeights)
  const anchorX = anchorPos.x
  const anchorY = anchorPos.y
  const anchorWidth = anchorItem.transform_width || 0
  const anchorHeight = measuredHeights?.get(anchorItem.id) || anchorItem.transform_height || 0
  const offset = anchorConfig.anchorOffset || 0
  const position = anchorConfig.anchorPosition || "top-left"
  
  let newX = item.transform_x || 0
  let newY = item.transform_y || 0
  
  // Support "top-left" position (simplified anchor system)
  // The builder calculates: newY = anchorY + offsetY
  // For same-row: offsetY = 0 (stays at same Y level)
  // For new-row: offsetY = anchorHeight + fieldSpacing (already includes anchorHeight)
  if (position === "top-left") {
    const offsetX = typeof offset === "object" ? offset.x : (typeof offset === "number" ? offset : 0)
    let offsetY = typeof offset === "object" ? offset.y : (typeof offset === "number" ? offset : 0)
    
    // If we have measured heights and the offset includes the anchor height (for new rows),
    // we need to adjust the offset to account for the measured anchor height
    // The stored offset was calculated as: originalAnchorHeight + spacing
    // We need to recalculate as: measuredAnchorHeight + spacing
    if (measuredHeights && offsetY > 0) {
      const originalAnchorHeight = anchorItem.transform_height || 0
      const measuredAnchorHeight = measuredHeights.get(anchorItem.id) || originalAnchorHeight
      
      // If the offset is greater than the original anchor height, it likely includes spacing
        // This indicates a new-row element (element positioned below the anchor)
      if (offsetY > originalAnchorHeight && originalAnchorHeight > 0) {
        // Extract spacing: offsetY = originalAnchorHeight + spacing
        const spacing = offsetY - originalAnchorHeight
        // Recalculate with measured height: measuredAnchorHeight + spacing
        offsetY = measuredAnchorHeight + spacing
        } else if (offsetY > 0 && originalAnchorHeight === 0 && measuredAnchorHeight > 0) {
          // Special case: anchor had no original height (e.g., empty group), but now has measured height
          // Keep the offset as is, but add the measured height
          offsetY = measuredAnchorHeight + offsetY
      }
    }

    newX = anchorX + offsetX
    newY = anchorY + offsetY
  } else {
    // Legacy support for other positions
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
  }
  
  return { x: newX, y: newY }
}

// Convert PrintTemplateElement to item format for PDF rendering
function elementToItem(element: PrintTemplateElement, idx: number): any {
  const item: any = {
    id: element.id,
    type: element.type,
    value: typeof element.value === "string" ? element.value : "",
    align: element.align || "left",
    vertical_align: element.verticalAlign || "middle",
    transform_x: element.transform?.x || 0,
    transform_y: element.transform?.y || 0,
    transform_width: element.transform?.width || 200,
    transform_height: element.transform?.height || 30,
    idx: idx,
  }
  
  // Style fields
  if (element.style?.fontSize !== undefined) {
    item.style_font_size = element.style.fontSize
  }
  if (element.style?.fontWeight !== undefined) {
    item.style_font_weight = element.style.fontWeight
  }
  if (element.style?.fontStyle !== undefined) {
    item.style_font_style = element.style.fontStyle
  }
  if (element.style?.textDecoration !== undefined) {
    item.style_text_decoration = element.style.textDecoration
  }
  
  // Field-specific values
  if (element.type === "field") {
    item.field_name = typeof element.value === "string" ? element.value : ""
    if (element.fields && Array.isArray(element.fields)) {
      item.fields = JSON.stringify(element.fields)
    }
    if (element.tableConfig) {
      item.table_config = JSON.stringify(element.tableConfig)
    }
    item.label = element.label || ""
    item.label_position = element.labelPosition || "left"
  } else if (element.type === "reference") {
    item.reference_doctype = element.referenceDoctype || ""
    item.reference_id_filter = element.referenceIdFilter || ""
    item.reference_field = element.referenceField || ""
    item.label = element.label || ""
    item.label_position = element.labelPosition || "left"
  }
  
  // Anchor configuration
  if (element.anchorTo !== undefined || element.anchorPosition !== undefined || element.anchorOffset !== undefined) {
    item.anchor_config = JSON.stringify({
      anchorTo: element.anchorTo ?? null,
      anchorPosition: element.anchorPosition ?? null,
      anchorOffset: element.anchorOffset ?? null
    })
  }
  
  // Code field
  if (element.code) {
    item.code = element.code
  }
  
  // Group field - store if element belongs to a group
  if (element.group) {
    item.group = element.group
  }
  
  return item
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
              totalHeight += 1
            }
          }
          
          // Data rows height
          totalHeight += parentFieldValue.length * rowHeight
          
          // Row borders (between rows)
          if (showBorder) {
            totalHeight += parentFieldValue.length * 1
            if (showHeader) {
              totalHeight += 1
            }
          }
          
          return Math.max(totalHeight, transform_height)
        }
      }
    } catch (e) {
      console.error(`[PDF] Error calculating height for item ${item.id}:`, e)
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
  measuredHeights?: Map<string, number>,
  finalPositions?: Map<string, { x: number; y: number }>,
  language?: string,
  fieldConfigs?: Map<string, { type: string; reference?: string }>, // Field configs for checking types
  childFieldConfigs?: Map<string, Map<string, { type: string }>> // Child field configs for Reference Table/Extend (parentFieldName -> childFieldName -> config)
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
    style_font_style,
    style_text_decoration,
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

  // Use final position if available (from measurement), otherwise calculate
  let actualX = transform_x
  let actualY = transform_y
  if (finalPositions?.has(item.id)) {
    const pos = finalPositions.get(item.id)!
    actualX = pos.x
    actualY = pos.y
  } else if (allItems) {
    const anchorPos = calculateAnchorPosition(item, allItems, new Set(), measuredHeights)
    actualX = anchorPos.x
    actualY = anchorPos.y
  }
  
  // Use measured height if available, otherwise use transform_height
  const actualHeight = measuredHeights?.get(item.id) || transform_height
  
  // Debug: Log positions for table elements and groups
  if (item.type === "field" && item.fields) {
    console.log(`[PDF] Rendering table ${item.field_name || item.id}: position (${actualX.toFixed(1)}, ${actualY.toFixed(1)}), height: ${actualHeight.toFixed(1)}`)
  }
  if (item.type === "anchor") {
    const isGroup = allItems?.some(child => {
      let childAnchorConfig: any = null
      if (child.anchor_config) {
        if (typeof child.anchor_config === "string") {
          try {
            childAnchorConfig = JSON.parse(child.anchor_config)
          } catch (e) {}
        } else if (typeof child.anchor_config === "object") {
          childAnchorConfig = child.anchor_config
        }
      }
      if (childAnchorConfig && childAnchorConfig.anchorTo) {
        if ((item.code && childAnchorConfig.anchorTo === item.code) || childAnchorConfig.anchorTo === item.id) {
          return true
        }
      }
      return false
    })
    if (isGroup) {
      console.log(`[PDF] Rendering group ${item.id} (code: ${item.code}): position (${actualX.toFixed(1)}, ${actualY.toFixed(1)}), height: ${actualHeight.toFixed(1)}`)
    }
  }

  const style: string[] = []
  style.push(`position: absolute`)
  style.push(`left: ${pxToMm(actualX)}mm`)
  style.push(`top: ${pxToMm(actualY)}mm`)
  style.push(`width: ${pxToMm(transform_width)}mm`)
  
  const isReferenceTable = type === "field" && fields
  if (!isReferenceTable) {
    style.push(`height: ${pxToMm(actualHeight)}mm`)
  } else {
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
  if (style_font_style) style.push(`font-style: ${style_font_style}`)
  if (style_text_decoration) style.push(`text-decoration: ${style_text_decoration}`)
  if (style_color) style.push(`color: ${style_color}`)
  if (style_background_color) style.push(`background-color: ${style_background_color}`)
  if (style_border) style.push(`border: ${style_border}`)
  if (style_padding) style.push(`padding: ${style_padding}`)
  if (style_margin) style.push(`margin: ${style_margin}`)

  let content = ""

  switch (type) {
    case "text": {
      // Build alignment styles for text
      let textAlignStyle = ""
      if (align === "center") {
        textAlignStyle = "text-align: center;"
      } else if (align === "right") {
        textAlignStyle = "text-align: right;"
      } else {
        textAlignStyle = "text-align: left;"
      }
      
      // Build vertical alignment for container
      let containerAlignStyle = ""
      if (vertical_align === "middle") {
        containerAlignStyle = "align-items: center;"
      } else if (vertical_align === "top") {
        containerAlignStyle = "align-items: flex-start;"
      } else if (vertical_align === "bottom") {
        containerAlignStyle = "align-items: flex-end;"
      }
      
      const inlineTextStyle = `${style_font_size ? `font-size: ${style_font_size}px;` : ""}${style_font_weight ? `font-weight: ${style_font_weight};` : ""}${style_font_style ? `font-style: ${style_font_style};` : ""}${style_text_decoration ? `text-decoration: ${style_text_decoration};` : ""}`
      
      content = `<div style="width: 100%; height: 100%; display: flex; ${containerAlignStyle}"><span style="display: block; width: 100%; ${textAlignStyle}${inlineTextStyle}">${value || ""}</span></div>`
      break
    }

    case "field": {
      let fieldValue = field_name ? getFieldValue(doc, field_name) : ""
      
      // Check if this is an Image Preview field (parent field)
      const fieldConfig = fieldConfigs?.get(field_name || "")
      const isImagePreviewField = fieldConfig?.type === "Image Preview"
      
      // If this is a regular Image Preview field (not Reference Table/Extend), render as image
      const itemFields = item.fields
      if (isImagePreviewField && fieldValue && (!itemFields || (typeof itemFields === "string" && itemFields === ""))) {
        // Try to read file from filesystem and convert to data URL
        let imageSrc = fieldValue
        
        // If it's already a data URL, use it directly
        if (!fieldValue.startsWith("data:")) {
          // Try to read from filesystem
          const dataUrl = await getFileAsDataUrl(fieldValue)
          if (dataUrl) {
            imageSrc = dataUrl
          } else {
            // Fallback to URL if file not found
            if (!fieldValue.startsWith("http") && !fieldValue.startsWith("data:")) {
              // Construct file URL - try to get from doc's doctype
              const doctypeName = doc?.doctype || ""
              const docId = doc?.id || ""
              if (doctypeName && docId) {
                imageSrc = `${baseUrl}/files/${doctypeName}/${docId}/${field_name}/${fieldValue}`
              } else {
                // Fallback: use the value as-is if it's already a path
                imageSrc = fieldValue.startsWith("/") ? `${baseUrl}${fieldValue}` : `${baseUrl}/${fieldValue}`
              }
            } else {
              // It's already a URL, use it as-is
              imageSrc = fieldValue
            }
          }
        }
        
        // Render as image
        const imageStyle = `max-width: 100%; max-height: 100%; object-fit: contain;`
        fieldValue = `<img src="${imageSrc}" style="${imageStyle}" alt="${field_name || 'Image'}" />`
      }
      
      // Handle nested fields for Reference Table/Extend types
      if (fields && typeof fields === "string") {
        try {
          const childFields = JSON.parse(fields)
          if (Array.isArray(childFields) && childFields.length > 0) {
            const parentFieldValue = doc[field_name]
            
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
            
            // Ensure parentFieldValue is an array
            const fieldValueArray = Array.isArray(parentFieldValue) ? parentFieldValue : []
            const hasRows = fieldValueArray.length > 0
            const hideNoValue = tableConfig?.hideNoValue === true
              
              // Get column configuration
              const columns = tableConfig?.columns || childFields.map((f: string, idx: number) => ({ field: f, order: idx }))
              const sortedColumns = [...columns].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
              const showHeader = tableConfig?.showHeader !== false
              const showBorder = tableConfig?.showBorder !== false
              const rowHeight = tableConfig?.rowHeight || 20
            
            // If hideNoValue is true and there are no rows, don't render the table
            if (hideNoValue && !hasRows) {
              fieldValue = ""
            } else {
              // Render table even if no rows, as long as showHeader is true (header will be shown)
              
              const elementWidthPx = transform_width
              const elementWidthMm = pxToMm(elementWidthPx)
              const specifiedWidths = sortedColumns.filter((col: any) => col.width).map((col: any) => col.width)
              const totalSpecifiedWidth = specifiedWidths.reduce((sum: number, w: number) => sum + w, 0)
              const columnsWithoutWidth = sortedColumns.length - sortedColumns.filter((col: any) => col.width).length
              
              // Build table with configuration
              const tableStyles: string[] = []
              tableStyles.push(`width: ${elementWidthMm}mm`)
              tableStyles.push("border-collapse: collapse")
              tableStyles.push("table-layout: fixed")
              
              // Modern border styling - softer colors
              const borderColor = "#e5e7eb" // Light gray for modern look
              const borderStyle = showBorder ? `1px solid ${borderColor}` : "none"
              const headerBgColor = "#f9fafb" // Very light gray for header
              const zebraStripeColor = "#fafafa" // Subtle zebra striping
              
              // Add outer border to table if borders are enabled
              if (showBorder) {
                tableStyles.push(`border: 1px solid ${borderColor}`)
              }
              
              // Font styles for table cells (from element.style)
              const tableFontStyles: string[] = []
              if (style_font_size) tableFontStyles.push(`font-size: ${style_font_size}px`)
              if (style_font_weight) tableFontStyles.push(`font-weight: ${style_font_weight}`)
              if (style_font_style) tableFontStyles.push(`font-style: ${style_font_style}`)
              if (style_text_decoration) tableFontStyles.push(`text-decoration: ${style_text_decoration}`)
              const tableFontStyleStr = tableFontStyles.length > 0 ? `${tableFontStyles.join("; ")};` : ""
              
              // Render rows (even if empty, we still show header if showHeader is true)
              // Need to handle async file reading for Image Preview fields
              const rows = (hasRows 
                ? await Promise.all(fieldValueArray.map(async (childDoc: any, rowIndex: number) => {
                const cells = await Promise.all(sortedColumns.map(async (col: any) => {
                  const childValue = getFieldValue(childDoc, col.field)
                  const cellStyles: string[] = []
                  
                  // Calculate column width
                  if (col.width) {
                    cellStyles.push(`width: ${pxToMm(col.width)}mm`)
                  } else if (columnsWithoutWidth > 0) {
                    const remainingWidth = elementWidthPx - totalSpecifiedWidth
                    const autoWidth = remainingWidth / columnsWithoutWidth
                    cellStyles.push(`width: ${pxToMm(autoWidth)}mm`)
                  } else {
                    cellStyles.push(`width: ${elementWidthMm / sortedColumns.length}mm`)
                  }
                  
                  // Modern border styling
                  if (showBorder) {
                    cellStyles.push(`border: ${borderStyle}`)
                  }
                  
                  // Zebra striping for better readability
                  if (rowIndex % 2 === 1) {
                    cellStyles.push(`background-color: ${zebraStripeColor}`)
                  }
                  
                  cellStyles.push(`min-height: ${pxToMm(rowHeight)}mm`)
                  cellStyles.push(`padding: 3px 4px`) // Narrow but slightly more modern padding
                  cellStyles.push(`overflow: hidden`)
                  cellStyles.push(`text-overflow: ellipsis`)
                  cellStyles.push(`vertical-align: middle`)
                  if (tableFontStyleStr) {
                    cellStyles.push(tableFontStyleStr)
                  }
                  
                  // Check if this child field is Image Preview type
                  const childFieldConfigsForParent = childFieldConfigs?.get(field_name || "")
                  const childFieldConfig = childFieldConfigsForParent?.get(col.field)
                  const isImagePreviewChild = childFieldConfig?.type === "Image Preview"
                  
                  let cellContent = childValue
                  if (isImagePreviewChild && childValue) {
                    // Try to read file from filesystem and convert to data URL
                    let imageSrc = childValue
                    
                    // If it's already a data URL, use it directly
                    if (!childValue.startsWith("data:")) {
                      // Try to read from filesystem
                      const dataUrl = await getFileAsDataUrl(childValue)
                      if (dataUrl) {
                        imageSrc = dataUrl
                      } else {
                        // Fallback to URL if file not found
                        if (!childValue.startsWith("http") && !childValue.startsWith("data:")) {
                          // For child docs, we need to construct the URL differently
                          // The childDoc should have an id, and we need the reference doctype
                          const referenceDoctype = fieldConfig?.reference || ""
                          const childDocId = childDoc?.id || ""
                          if (referenceDoctype && childDocId) {
                            imageSrc = `${baseUrl}/files/${referenceDoctype}/${childDocId}/${col.field}/${childValue}`
                          } else {
                            imageSrc = childValue.startsWith("/") ? `${baseUrl}${childValue}` : `${baseUrl}/${childValue}`
                          }
                        } else {
                          // It's already a URL, use it as-is
                          imageSrc = childValue
                        }
                      }
                    }
                    
                    const imageStyle = `max-width: 100%; max-height: 100%; object-fit: contain;`
                    cellContent = `<img src="${imageSrc}" style="${imageStyle}" alt="${col.field || 'Image'}" />`
                  }
                  
                  return `<td style="${cellStyles.join("; ")}">${cellContent}</td>`
                }))
                const rowStyles: string[] = []
                return `<tr style="${rowStyles.join("; ")}">${cells.join("")}</tr>`
              }))
                : []).join("")
              
              // Render headers if enabled
              let headers = ""
              if (showHeader) {
                const headerCells = sortedColumns.map((col: any) => {
                  const headerStyles: string[] = []
                  
                  if (col.width) {
                    headerStyles.push(`width: ${pxToMm(col.width)}mm`)
                  } else if (columnsWithoutWidth > 0) {
                    const remainingWidth = elementWidthPx - totalSpecifiedWidth
                    const autoWidth = remainingWidth / columnsWithoutWidth
                    headerStyles.push(`width: ${pxToMm(autoWidth)}mm`)
                  } else {
                    headerStyles.push(`width: ${elementWidthMm / sortedColumns.length}mm`)
                  }
                  
                  // Modern header border styling
                  if (showBorder) {
                    headerStyles.push(`border: ${borderStyle}`)
                    headerStyles.push(`border-bottom: 2px solid ${borderColor}`) // Thicker bottom border for header separation
                  }
                  
                  headerStyles.push(`padding: 3px 4px`) // Narrow but slightly more modern padding
                  headerStyles.push(`font-weight: ${style_font_weight || "600"}`) // Use element font weight or default to 600 (semi-bold)
                  headerStyles.push(`background-color: ${headerBgColor}`)
                  headerStyles.push(`overflow: hidden`)
                  headerStyles.push(`text-overflow: ellipsis`)
                  headerStyles.push(`vertical-align: middle`)
                  headerStyles.push(`text-align: left`)
                  if (tableFontStyleStr) {
                    headerStyles.push(tableFontStyleStr)
                  }
                  // Use label if available, otherwise fall back to field name
                  // Translate the label if language is provided
                  const labelText = col.label || col.field
                  const headerText = language ? $zodula.utils.translate(labelText, language) : labelText
                  return `<th style="${headerStyles.join("; ")}">${headerText}</th>`
                }).join("")
                headers = `<thead><tr>${headerCells}</tr></thead>`
              }
              
              fieldValue = `<table style="${tableStyles.join("; ")}">${headers}<tbody>${rows}</tbody></table>`
            }
          }
        } catch (e) {
          // If parsing fails, just use the field value as is
        }
      }
      
      // Translate label if language is provided
      const labelText = label ? (language ? $zodula.utils.translate(label, language) : label) : ""
      
      // Build alignment styles for content
      let contentAlignStyle = ""
      if (align === "center") {
        contentAlignStyle = "text-align: center;"
      } else if (align === "right") {
        contentAlignStyle = "text-align: right;"
      } else {
        contentAlignStyle = "text-align: left;"
      }
      // Apply same horizontal alignment to labels
      const labelAlignStyle = contentAlignStyle
      
      // Build vertical alignment for container
      let containerAlignStyle = ""
      if (vertical_align === "middle") {
        containerAlignStyle = "align-items: center;"
      } else if (vertical_align === "top") {
        containerAlignStyle = "align-items: flex-start;"
      } else if (vertical_align === "bottom") {
        containerAlignStyle = "align-items: flex-end;"
      }
      
      const inlineTextStyle = `${style_font_size ? `font-size: ${style_font_size}px;` : ""}${style_font_weight ? `font-weight: ${style_font_weight};` : ""}${style_font_style ? `font-style: ${style_font_style};` : ""}${style_text_decoration ? `text-decoration: ${style_text_decoration};` : ""}`
      
      if (labelText && label_position === "top") {
        content = `<div style="display: flex; flex-direction: column; gap: 2px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="font-size: 0.9em; opacity: 0.7; display: block; width: 100%; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span><span style="display: block; width: 100%; ${contentAlignStyle}${inlineTextStyle}">${fieldValue}</span></div>`
      } else if (labelText && label_position === "bottom") {
        content = `<div style="display: flex; flex-direction: column; gap: 2px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="display: block; width: 100%; ${contentAlignStyle}${inlineTextStyle}">${fieldValue}</span><span style="font-size: 0.9em; opacity: 0.7; display: block; width: 100%; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span></div>`
      } else if (labelText && label_position === "left") {
        content = `<div style="display: flex; flex-direction: row; align-items: center; gap: 8px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="font-size: 0.9em; opacity: 0.7; white-space: nowrap; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span><span style="flex: 1; min-width: 0; ${contentAlignStyle}${inlineTextStyle}">${fieldValue}</span></div>`
      } else if (labelText && label_position === "right") {
        content = `<div style="display: flex; flex-direction: row-reverse; align-items: center; gap: 8px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="font-size: 0.9em; opacity: 0.7; white-space: nowrap; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span><span style="flex: 1; min-width: 0; ${contentAlignStyle}${inlineTextStyle}">${fieldValue}</span></div>`
      } else {
        // No label - just apply alignment to content
        content = `<div style="width: 100%; height: 100%; display: flex; ${containerAlignStyle}"><span style="display: block; width: 100%; ${contentAlignStyle}${inlineTextStyle}">${fieldValue}</span></div>`
      }
      break
    }

    case "image": {
      const imagePath = image || value || ""
      if (imagePath) {
        let imageUrl = imagePath
        if (!imagePath.startsWith("http") && !imagePath.startsWith("data:")) {
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
      let refValue = ""
      if (reference_doctype && reference_field) {
        try {
          let refId = reference_id_filter || ""
          if (refId.includes("{{")) {
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
      
      // Translate label if language is provided
      const labelText = label ? (language ? $zodula.utils.translate(label, language) : label) : ""
      
      // Build alignment styles for content
      let contentAlignStyle = ""
      if (align === "center") {
        contentAlignStyle = "text-align: center;"
      } else if (align === "right") {
        contentAlignStyle = "text-align: right;"
      } else {
        contentAlignStyle = "text-align: left;"
      }
      // Apply same horizontal alignment to labels
      const labelAlignStyle = contentAlignStyle
      
      // Build vertical alignment for container
      let containerAlignStyle = ""
      if (vertical_align === "middle") {
        containerAlignStyle = "align-items: center;"
      } else if (vertical_align === "top") {
        containerAlignStyle = "align-items: flex-start;"
      } else if (vertical_align === "bottom") {
        containerAlignStyle = "align-items: flex-end;"
      }
      
      const inlineTextStyle = `${style_font_size ? `font-size: ${style_font_size}px;` : ""}${style_font_weight ? `font-weight: ${style_font_weight};` : ""}${style_font_style ? `font-style: ${style_font_style};` : ""}${style_text_decoration ? `text-decoration: ${style_text_decoration};` : ""}`
      
      if (labelText && label_position === "top") {
        content = `<div style="display: flex; flex-direction: column; gap: 2px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="font-size: 0.9em; opacity: 0.7; display: block; width: 100%; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span><span style="display: block; width: 100%; ${contentAlignStyle}${inlineTextStyle}">${refValue}</span></div>`
      } else if (labelText && label_position === "bottom") {
        content = `<div style="display: flex; flex-direction: column; gap: 2px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="display: block; width: 100%; ${contentAlignStyle}${inlineTextStyle}">${refValue}</span><span style="font-size: 0.9em; opacity: 0.7; display: block; width: 100%; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span></div>`
      } else if (labelText && label_position === "left") {
        content = `<div style="display: flex; flex-direction: row; align-items: center; gap: 8px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="font-size: 0.9em; opacity: 0.7; white-space: nowrap; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span><span style="flex: 1; min-width: 0; ${contentAlignStyle}${inlineTextStyle}">${refValue}</span></div>`
      } else if (labelText && label_position === "right") {
        content = `<div style="display: flex; flex-direction: row-reverse; align-items: center; gap: 8px; width: 100%; height: 100%; ${containerAlignStyle}"><span style="font-size: 0.9em; opacity: 0.7; white-space: nowrap; ${labelAlignStyle}${inlineTextStyle}">${labelText}</span><span style="flex: 1; min-width: 0; ${contentAlignStyle}${inlineTextStyle}">${refValue}</span></div>`
      } else {
        // No label - just apply alignment to content
        content = `<div style="width: 100%; height: 100%; display: flex; ${containerAlignStyle}"><span style="display: block; width: 100%; ${contentAlignStyle}${inlineTextStyle}">${refValue}</span></div>`
      }
      break
    }

    case "custom_html": {
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
  const { print_template, doctype, ids: idsParam, lang, letter_head, format = "pdf", organization: orgParam } = ctx.query

  const ids = Array.isArray(idsParam) ? idsParam : idsParam ? [idsParam] : []
  const baseUrl = ctx.request.url.split("/api")[0] || "http://localhost:3000"
  
  // Get language for translation (default to "en" if not provided)
  const language = (lang as string) || process.env.ZODULA_PUBLIC_DEFAULT_LANGUAGE || "en"
  
  // Get session context
  const sessionContext: any = {}
  try {
    const user = await $zodula.session.user(true).catch(() => null)
    // Use organization from query param if provided, otherwise from session
    const organization = orgParam || await $zodula.session.organization(true).catch(() => null)
    if (user) sessionContext.user = user.id
    if (organization) sessionContext.organization = organization
  } catch (e) {
    // Ignore session errors
  }

  // Fetch or generate print template
  let template: any = null
  let items: any[] = []
  let pageFormat = "A4"
  let pageDims: { width: number; height: number } = PAGE_FORMATS.A4 || { width: 210, height: 297 }
  let pageTitle = ids.length === 1 ? ids[0] : "Document"

  if (print_template) {
    // Use provided print template
    template = await $zodula.doctype("zodula__Print Template").get(print_template).bypass(true)
    if (!template) {
      return ctx.json({ error: "Print template not found" }, 404)
    }

    // Fetch template items - try multiple approaches
    // Approach 1: Direct query with sort
    try {
      const result = await $zodula.doctype("zodula__Print Template Item")
        .select()
        .where("print_template", "=", print_template)
        .sort("idx", "asc")
        .bypass(true)
      items = result.docs || []
    } catch (e) {
      console.error("[PDF] Direct query error:", e)
    }

    // Approach 2: Try accessing via relationship if direct query fails
    if (items.length === 0) {
      try {
        const templateWithItems = await $zodula.doctype("zodula__Print Template")
          .get(print_template)
          .fields(["*", "items"] as any)
          .bypass(true)
        
        if (templateWithItems && (templateWithItems as any).items) {
          items = (templateWithItems as any).items || []
          items.sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0))
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
        items.sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0))
      } catch (e) {
        console.error("[PDF] Query without sort error:", e)
      }
    }

    if (items.length === 0) {
      return ctx.json({ error: "No template items found. Please add items to the print template." }, 400)
    }

    // Determine page dimensions from template
    pageFormat = template.format || "A4"
    if (pageFormat === "Custom") {
      pageDims = { width: template.custom_width || 210, height: template.custom_height || 297 }
    } else {
      const formatDims = PAGE_FORMATS[pageFormat]
      pageDims = formatDims || PAGE_FORMATS.A4 || { width: 210, height: 297 }
    }

    pageTitle =
      (ids.length === 1 ? ids[0] : null) ||
      (template as any).title ||
      template.name ||
      print_template ||
      "Document"
  } else {
    // Generate default template from doctype tabs
    if (!doctype) {
      return ctx.json({ error: "Doctype is required when print_template is not provided" }, 400)
    }

    // Fetch doctype configuration
    const doctypeDoc = await $zodula.doctype("zodula__Doctype").get(doctype).bypass(true)
    if (!doctypeDoc) {
      return ctx.json({ error: "Doctype not found" }, 404)
    }

    // Fetch fields for the doctype
    const { docs: fieldDocs } = await $zodula.doctype("zodula__Field")
      .select()
      .where("doctype", "=", doctype)
      .sort("idx", "asc")
      .bypass(true)

    const fields = fieldDocs.map((f: any) => ({
      name: f.name || "",
      label: f.label || f.name || "",
      type: f.type || "",
      reference: f.reference || undefined,
      no_print: f.no_print === 1 || f.no_print === true,
    })).filter((f: any) => f.name)

    // Parse tabs
    const tabs = typeof doctypeDoc.tabs === 'string' 
      ? JSON.parse(doctypeDoc.tabs) 
      : doctypeDoc.tabs

    if (!Array.isArray(tabs) || tabs.length === 0) {
      return ctx.json({ error: "Doctype has no tabs configured. Please configure tabs or provide a print_template." }, 400)
    }

    // Helper function to fetch child fields for reference tables
    const fetchChildFields = async (referenceDoctype: string, parentDoctype?: string): Promise<ChildField[]> => {
      try {
        const { docs: childFieldDocs } = await $zodula.doctype("zodula__Field")
          .select()
          .where("doctype", "=", referenceDoctype)
          .sort("idx", "asc")
          .bypass(true)

        const standardFieldNames = new Set([
          "id", "organization", "organization_abbr", "owner", "created_at", "updated_at",
          "created_by", "updated_by", "doc_status", "idx", "vector"
        ])

        return childFieldDocs
          .filter((field: any) => {
            const fieldDoctype = field.doctype || ""
            const fieldName = field.name || ""
            const fieldReference = field.reference || ""
            // Check no_print - exclude fields with no_print set to 1 or true
            const fieldNoPrint = field.no_print === 1 || field.no_print === true
            // Exclude if it's a standard field, if it references the parent doctype, or if no_print is set
            const isParentReference = parentDoctype && fieldReference === parentDoctype
            const shouldInclude = fieldDoctype === referenceDoctype && !standardFieldNames.has(fieldName) && !isParentReference && !fieldNoPrint
            return shouldInclude
          })
          .map((field: any, idx: number) => ({
            field: field.name || "",
            label: field.label || field.name || "",
            order: idx,
            required: field.required === 1 || field.required === true,
            in_list_view: field.in_list_view === 1 || field.in_list_view === true,
            no_print: field.no_print === 1 || field.no_print === true
          }))
          .filter((col: any) => col.field)
      } catch (error) {
        console.error("[PDF] Error fetching child fields:", error)
        return []
      }
    }

    // Generate template elements
    const doctypeLabel = doctypeDoc.label || doctype
    const elements = await generateTemplateFromTabs({
      tabs,
      fields,
      pageDimensions: PAGE_FORMATS.A4 || { width: 210, height: 297 },
      doctypeLabel,
      fetchChildFields,
      doctype,
    })

    // Convert elements to items format
    items = elements.map((element, idx) => elementToItem(element, idx))

    // Use default page format
    pageFormat = "A4"
    pageDims = PAGE_FORMATS.A4 || { width: 210, height: 297 }
    pageTitle = ids.length === 1 ? ids[0] : doctypeLabel || "Document"
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

  // Build field configs map for checking field types
  const fieldConfigsMap = new Map<string, { type: string; reference?: string }>()
  if (print_template) {
    // For print templates, we need to fetch field configs from the doctype
    try {
      const { docs: fieldDocs } = await $zodula.doctype("zodula__Field")
        .select()
        .where("doctype", "=", doctype)
        .bypass(true)
      fieldDocs.forEach((f: any) => {
        if (f.name) {
          fieldConfigsMap.set(f.name, {
            type: f.type || "",
            reference: f.reference || undefined
          })
        }
      })
    } catch (e) {
      console.error("[PDF] Error fetching field configs:", e)
    }
  } else {
    // For generated templates, fetch field configs from the doctype (same as print_template case)
    // This ensures consistency and avoids scope issues
    try {
      const { docs: fieldDocs } = await $zodula.doctype("zodula__Field")
        .select()
        .where("doctype", "=", doctype)
        .bypass(true)
      fieldDocs.forEach((f: any) => {
        if (f.name) {
          fieldConfigsMap.set(f.name, {
            type: f.type || "",
            reference: f.reference || undefined
          })
        }
      })
    } catch (e) {
      console.error("[PDF] Error fetching field configs:", e)
    }
  }

  // Build child field configs map for Reference Table/Extend fields
  const childFieldConfigsMap = new Map<string, Map<string, { type: string }>>()
  for (const item of items) {
    if (item.type === "field" && item.fields && typeof item.fields === "string") {
      try {
        const childFields = JSON.parse(item.fields)
        if (Array.isArray(childFields) && childFields.length > 0) {
          const parentFieldName = item.field_name
          const parentFieldConfig = fieldConfigsMap.get(parentFieldName || "")
          const referenceDoctype = parentFieldConfig?.reference
          
          if (referenceDoctype) {
            try {
              const { docs: childFieldDocs } = await $zodula.doctype("zodula__Field")
                .select()
                .where("doctype", "=", referenceDoctype)
                .bypass(true)
              
              const childConfigs = new Map<string, { type: string }>()
              childFieldDocs.forEach((f: any) => {
                if (f.name) {
                  childConfigs.set(f.name, { type: f.type || "" })
                }
              })
              
              if (parentFieldName) {
                childFieldConfigsMap.set(parentFieldName, childConfigs)
              }
            } catch (e) {
              console.error(`[PDF] Error fetching child field configs for ${parentFieldName}:`, e)
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

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

  // Generate HTML for each document
  const htmlPages: string[] = []

  for (const doc of documents) {
    // Render letter head items if any
    let letterHeadHtml = ""
    if (letterHeadItems.length > 0) {
      const letterHeadPromises = letterHeadItems.map((item) => renderTemplateItem(item, doc, baseUrl, sessionContext, letterHeadItems, undefined, undefined, language, fieldConfigsMap, childFieldConfigsMap))
      const letterHeadResults = await Promise.all(letterHeadPromises)
      letterHeadHtml = letterHeadResults.join("")
    }

    // NEW APPROACH: Chain-based rendering - process elements in dependency order
    // Elements without anchors render normally, anchored elements render one by one
    // measuring height and positioning next element based on measured height
    // 1. Build dependency chain (topological sort)
    // 2. Render elements one by one, measure height, then position next element
    
    // Build dependency graph
    const dependencies = new Map<string, string[]>()
    const itemMap = new Map<string, any>()
    
    items.forEach(item => {
      itemMap.set(item.id, item)
      // Parse anchor config
      let anchorConfig: any = null
      if (item.anchor_config) {
        if (typeof item.anchor_config === "string") {
          try {
            anchorConfig = JSON.parse(item.anchor_config)
          } catch (e) {
            // Ignore
          }
        } else if (typeof item.anchor_config === "object") {
          anchorConfig = item.anchor_config
        }
      }
      
      if (anchorConfig && anchorConfig.anchorTo) {
        // Find anchor item by code first (preferred), then by id (fallback for backward compatibility)
        const anchorItem = items.find((i: any) => {
          if (i.code && i.code === anchorConfig.anchorTo) return true
          if (anchorConfig.anchorTo === i.id) return true
          return false
        })
        
        if (anchorItem) {
          if (!dependencies.has(item.id)) {
            dependencies.set(item.id, [])
          }
          dependencies.get(item.id)!.push(anchorItem.id)
        }
      }
    })
    
    // Topological sort: process elements without anchors first
    const processed = new Set<string>()
    const orderedItems: any[] = []
    
    // Start with elements that have no anchors
    items.forEach(item => {
      const anchorConfig = item.anchor_config
        ? (typeof item.anchor_config === "string" ? JSON.parse(item.anchor_config) : item.anchor_config)
        : null
      if (!anchorConfig || !anchorConfig.anchorTo) {
        processed.add(item.id)
        orderedItems.push(item)
      }
    })
    
    // Process anchored elements in dependency order
    let changed = true
    while (changed) {
      changed = false
      items.forEach(item => {
        if (processed.has(item.id)) return
        
        const deps = dependencies.get(item.id) || []
        const allDepsProcessed = deps.every(depId => processed.has(depId))
        
        if (allDepsProcessed) {
          processed.add(item.id)
          orderedItems.push(item)
          changed = true
        }
      })
    }
    
    // Add any remaining items (shouldn't happen, but safety)
    items.forEach(item => {
      if (!processed.has(item.id)) {
        orderedItems.push(item)
      }
    })
    
    // Render elements one by one in chain order
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    try {
      const page = await browser.newPage()
      await page.setViewport({
        width: Math.round((pageDims.width * 96) / 25.4),
        height: Math.round((pageDims.height * 96) / 25.4),
      })
      
      // Start with base HTML structure
      let currentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
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
    ${template?.css || ""}
    ${letterHead?.css_content || ""}
  </style>
</head>
<body>
  <div class="page-container">
    ${letterHeadHtml}
  </div>
</body>
</html>`
      
      // Render all items with initial calculated positions
      const initialMeasuredHeights = new Map<string, number>()
      orderedItems.forEach((item) => {
        const calculatedHeight = calculateItemHeight(item, doc)
        initialMeasuredHeights.set(item.id, calculatedHeight)
      })
      
      const initialItemPromises = orderedItems.map((item) => 
        renderTemplateItem(item, doc, baseUrl, sessionContext, orderedItems, initialMeasuredHeights, undefined, language, fieldConfigsMap, childFieldConfigsMap)
      )
      const initialItemResults = await Promise.all(initialItemPromises)
      const initialItemsHtml = initialItemResults.join("")
      
      // Load all items at once and measure all heights in one pass
      const htmlWithItems = currentHtml.replace('</div>', `${initialItemsHtml}</div>`)
      try {
        await page.setContent(htmlWithItems, { 
          waitUntil: "networkidle0",
          timeout: 60000 // Increased timeout to 60 seconds
        })
        
        // Wait longer for tables to fully render - tables need more time
        const hasTables = orderedItems.some(item => {
          if (item.type === "field" && item.fields) {
            try {
              const childFields = typeof item.fields === "string" ? JSON.parse(item.fields) : item.fields
              return Array.isArray(childFields) && childFields.length > 0
            } catch (e) {
              return false
            }
          }
          return false
        })
        
        // Additional wait for tables to ensure they're fully rendered
        if (hasTables) {
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Force a layout recalculation by scrolling
          await page.evaluate(() => {
            window.scrollTo(0, 0)
            window.scrollTo(0, document.body.scrollHeight)
            window.scrollTo(0, 0)
          })
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
      } catch (e) {
        console.error(`[PDF] Error loading HTML:`, e)
        throw e
      }
      
      // Measure all element heights in one pass
      const measuredHeights = new Map<string, number>()
      let measuredCount = 0
      let failedCount = 0
      
      // First, identify groups (elements that have children with group property)
      const groups = new Map<string, any[]>() // groupId -> children items
      orderedItems.forEach(item => {
        // Check if this item is a group (has type "anchor" and has children)
        const isGroup = item.type === "anchor" && orderedItems.some(child => {
          // Parse child's anchor config to check if it belongs to this group
          let childAnchorConfig: any = null
          if (child.anchor_config) {
            if (typeof child.anchor_config === "string") {
              try {
                childAnchorConfig = JSON.parse(child.anchor_config)
              } catch (e) {
                // Ignore
              }
            } else if (typeof child.anchor_config === "object") {
              childAnchorConfig = child.anchor_config
            }
          }
          // Check if child has group property (stored in item data) or anchors to this group
          // Note: group property might be stored differently, we'll check by code/id
          return false // Will be updated below
        })
        
        // Check for children by looking for items that reference this group
        const children = orderedItems.filter(child => {
          // Check if child has group property pointing to this item
          // Since we don't have direct group property in item, we check by anchor relationship
          // Actually, groups are identified by having children that anchor to them
          // But we need to check the actual group relationship
          // For now, we'll identify groups after measuring by checking which items anchor to them
        })
      })
      
      for (const item of orderedItems) {
        try {
          const selector = `[data-item-id="${item.id}"]`
          const element = await page.$(selector)
          if (element) {
            // For tables, check scrollHeight as it's more accurate for content height
            const isTable = item.type === "field" && item.fields
            let actualHeightPx = 0
            
            if (isTable) {
              // Get both boundingBox and scrollHeight for tables
              const boundingBox = await element.boundingBox()
              const tableInfo = await page.evaluate((itemId) => {
                const el = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement
                if (el) {
                  const table = el.querySelector('table') as HTMLTableElement
                  return {
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    offsetHeight: (el as any).offsetHeight || el.clientHeight,
                    computedHeight: window.getComputedStyle(el).height,
                    tableRows: table ? table.rows.length : 0,
                    tableHeight: table ? ((table as any).offsetHeight || table.clientHeight) : 0
                  }
                }
                return null
              }, item.id)
              
              if (tableInfo) {
                // Use the maximum of boundingBox height, scrollHeight, or tableHeight
                const boundingHeight = boundingBox ? Math.round(boundingBox.height) : 0
                actualHeightPx = Math.max(
                  boundingHeight,
                  tableInfo.scrollHeight,
                  tableInfo.offsetHeight,
                  tableInfo.tableHeight
                )
              } else {
                const boundingBox = await element.boundingBox()
                actualHeightPx = boundingBox ? Math.round(boundingBox.height) : (item.transform_height || 30)
              }
            } else {
              const boundingBox = await element.boundingBox()
              actualHeightPx = boundingBox ? Math.round(boundingBox.height) : (item.transform_height || 30)
            }
            
            const originalHeight = item.transform_height || 30
            measuredHeights.set(item.id, actualHeightPx)
            measuredCount++
            
            const heightDiff = actualHeightPx - originalHeight
            let anchorConfig: any = null
            if (item.anchor_config) {
              if (typeof item.anchor_config === "string") {
                try {
                  anchorConfig = JSON.parse(item.anchor_config)
                } catch (e) {
                  // Ignore
                }
              } else if (typeof item.anchor_config === "object") {
                anchorConfig = item.anchor_config
              }
            }
            if (anchorConfig && anchorConfig.anchorTo) {
            }
        } else {
          measuredHeights.set(item.id, item.transform_height || 30)
          failedCount++
        }
      } catch (e) {
          console.error(`[PDF] ✗ Error measuring item ${item.id}:`, e)
          measuredHeights.set(item.id, item.transform_height || 30)
          failedCount++
        }
      }
      
      // Now identify groups and calculate their heights based on children
      // Groups are elements of type "anchor" that have children anchoring to them
      // Since group property might not be stored in DB, we identify groups by:
      // 1. Items with type "anchor" that have other items anchoring to them
      // 2. Items that have a "group" property (if stored)
      const groupChildren = new Map<string, any[]>() // groupId -> children items
      
      // First, try to identify groups by group property (if stored)
      orderedItems.forEach(item => {
        const itemGroup = (item as any).group
        if (itemGroup) {
          if (!groupChildren.has(itemGroup)) {
            groupChildren.set(itemGroup, [])
          }
          groupChildren.get(itemGroup)!.push(item)
        }
      })
      
      // If no groups found by property, identify by anchor relationships
      if (groupChildren.size === 0) {
        // Find all anchor-type items (potential groups)
        const anchorItems = orderedItems.filter(item => item.type === "anchor")
        
        // For each anchor item, find items that anchor to it
        anchorItems.forEach(anchorItem => {
          const children: any[] = []
          
          orderedItems.forEach(item => {
            if (item.id === anchorItem.id) return // Skip self
        
        let anchorConfig: any = null
        if (item.anchor_config) {
          if (typeof item.anchor_config === "string") {
            try {
              anchorConfig = JSON.parse(item.anchor_config)
            } catch (e) {
              // Ignore
            }
          } else if (typeof item.anchor_config === "object") {
            anchorConfig = item.anchor_config
          }
        }
        
        if (anchorConfig && anchorConfig.anchorTo) {
              // Check if this item anchors to the anchorItem (by code or id)
              if ((anchorItem.code && anchorConfig.anchorTo === anchorItem.code) ||
                  anchorConfig.anchorTo === anchorItem.id) {
                children.push(item)
              }
            }
          })
          
          if (children.length > 0) {
            groupChildren.set(anchorItem.id, children)
          }
        })
      }
      
      console.log(`[PDF] Found ${groupChildren.size} groups with children`)
      groupChildren.forEach((children, groupId) => {
        const groupItem = orderedItems.find(i => i.id === groupId)
        console.log(`[PDF] Group ${groupId} (type: ${groupItem?.type}, code: ${groupItem?.code}) has ${children.length} children`)
        children.forEach(child => {
          console.log(`[PDF]   - Child: ${child.id} (type: ${child.type}, field: ${child.field_name})`)
        })
      })
      
      // Calculate group heights based on children's positions and heights
      // We need to do this iteratively because:
      // 1. Groups might anchor to other groups
      // 2. When a group's height changes, elements anchoring to it need their positions recalculated
      // 3. When positions change, group heights might need recalculation
      let groupHeightsChanged = true
      let iterations = 0
      const maxIterations = 20
      
      while (groupHeightsChanged && iterations < maxIterations) {
        iterations++
        groupHeightsChanged = false
        
        // First, recalculate all positions with current measured heights
        // This ensures groups that anchor to other groups have correct positions
        const tempPositions = new Map<string, { x: number; y: number }>()
        for (const item of orderedItems) {
          const pos = calculateAnchorPosition(item, orderedItems, new Set(), measuredHeights)
          tempPositions.set(item.id, pos)
        }
        
        // Now calculate group heights using the updated positions
        groupChildren.forEach((children, groupId) => {
          if (children.length === 0) return
          
          const groupItem = orderedItems.find(i => i.id === groupId)
          if (!groupItem) return
          
          // Get group's current position (may be anchored, using updated heights)
          const groupPos = tempPositions.get(groupId) || calculateAnchorPosition(groupItem, orderedItems, new Set(), measuredHeights)
          
          // Calculate bounding box of all children (using their updated absolute positions)
          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          
          children.forEach(child => {
            // Get child's absolute position (using updated positions)
            const childPos = tempPositions.get(child.id) || calculateAnchorPosition(child, orderedItems, new Set(), measuredHeights)
            const childHeight = measuredHeights.get(child.id) || child.transform_height || 30
            const childWidth = child.transform_width || 200
            
            const childMinX = childPos.x
            const childMinY = childPos.y
            const childMaxX = childPos.x + childWidth
            const childMaxY = childPos.y + childHeight
            
            minX = Math.min(minX, childMinX)
            minY = Math.min(minY, childMinY)
            maxX = Math.max(maxX, childMaxX)
            maxY = Math.max(maxY, childMaxY)
          })
          
          // Calculate group height and width
          const groupWidth = maxX - minX
          const groupHeight = maxY - minY
          
          // Update group's measured height if it changed
          const currentHeight = measuredHeights.get(groupId) || groupItem.transform_height || 30
          
          if (Math.abs(groupHeight - currentHeight) > 0.1) {
            console.log(`[PDF] Iteration ${iterations}: Updating group ${groupId} height from ${currentHeight} to ${groupHeight}`)
            measuredHeights.set(groupId, groupHeight)
            groupHeightsChanged = true
          }
        })
      }
      
      console.log(`[PDF] Group height calculation completed after ${iterations} iterations`)
      
      // After calculating group heights, recalculate all final positions
      // This ensures elements anchoring to groups use the updated group heights
      // We need to do this iteratively because groups might anchor to other groups
      const finalPositions = new Map<string, { x: number; y: number }>()
      
      // Iteratively recalculate positions until they stabilize
      let positionsChanged = true
      let posIterations = 0
      const maxPosIterations = 20
      
      while (positionsChanged && posIterations < maxPosIterations) {
        posIterations++
        positionsChanged = false
        const newPositions = new Map<string, { x: number; y: number }>()
        
        // Recalculate all positions with current measured heights
        // Process groups first, then their children
        const processedItems = new Set<string>()
        
        // First pass: process all groups
        for (const item of orderedItems) {
          if (item.type === "anchor" && groupChildren.has(item.id)) {
            const oldPos = finalPositions.get(item.id) || { x: item.transform_x || 0, y: item.transform_y || 0 }
            const newPos = calculateAnchorPosition(item, orderedItems, new Set(), measuredHeights)
            newPositions.set(item.id, newPos)
            processedItems.add(item.id)
            
            if (Math.abs(newPos.x - oldPos.x) > 0.1 || Math.abs(newPos.y - oldPos.y) > 0.1) {
              positionsChanged = true
              console.log(`[PDF] Position iteration ${posIterations}: Group ${item.id} (code: ${item.code}) Y changed from ${oldPos.y.toFixed(1)} to ${newPos.y.toFixed(1)}`)
            }
          }
        }
        
        // Second pass: process group children (move with their group)
        for (const item of orderedItems) {
          if (processedItems.has(item.id)) continue
          
          const itemGroup = (item as any).group
          if (itemGroup && groupChildren.has(itemGroup)) {
            // This is a child of a group - calculate position relative to group's current position
            const groupItem = orderedItems.find(i => i.id === itemGroup)
            if (groupItem) {
              const groupPos = newPositions.get(itemGroup) || finalPositions.get(itemGroup) || calculateAnchorPosition(groupItem, orderedItems, new Set(), measuredHeights)
              
              // Get original stored positions
              const originalChildX = item.transform_x || 0
              const originalChildY = item.transform_y || 0
              const originalGroupX = groupItem.transform_x || 0
              const originalGroupY = groupItem.transform_y || 0
              
              // Calculate relative position
              const relativeX = originalChildX - originalGroupX
              const relativeY = originalChildY - originalGroupY
              
              // New absolute position = group's new position + relative offset
              const newPos = {
                x: groupPos.x + relativeX,
                y: groupPos.y + relativeY
              }
              
              const oldPos = finalPositions.get(item.id) || { x: originalChildX, y: originalChildY }
              newPositions.set(item.id, newPos)
              processedItems.add(item.id)
              
              if (Math.abs(newPos.x - oldPos.x) > 0.1 || Math.abs(newPos.y - oldPos.y) > 0.1) {
                positionsChanged = true
                if (item.field_name) {
                  console.log(`[PDF] Position iteration ${posIterations}: Child ${item.field_name} (${item.id}) Y changed from ${oldPos.y.toFixed(1)} to ${newPos.y.toFixed(1)} (group: ${originalGroupY.toFixed(1)} -> ${groupPos.y.toFixed(1)})`)
                }
          }
        } else {
              // Group not found, calculate normally
              const oldPos = finalPositions.get(item.id) || { x: item.transform_x || 0, y: item.transform_y || 0 }
              const newPos = calculateAnchorPosition(item, orderedItems, new Set(), measuredHeights)
              newPositions.set(item.id, newPos)
              processedItems.add(item.id)
              
              if (Math.abs(newPos.x - oldPos.x) > 0.1 || Math.abs(newPos.y - oldPos.y) > 0.1) {
                positionsChanged = true
              }
            }
          } else {
            // Not a group child, calculate normally
            const oldPos = finalPositions.get(item.id) || { x: item.transform_x || 0, y: item.transform_y || 0 }
            const newPos = calculateAnchorPosition(item, orderedItems, new Set(), measuredHeights)
            newPositions.set(item.id, newPos)
            processedItems.add(item.id)
            
            if (Math.abs(newPos.x - oldPos.x) > 0.1 || Math.abs(newPos.y - oldPos.y) > 0.1) {
              positionsChanged = true
              if (item.field_name || item.type === "anchor") {
                console.log(`[PDF] Position iteration ${posIterations}: ${item.field_name || item.type} (${item.id}) Y changed from ${oldPos.y.toFixed(1)} to ${newPos.y.toFixed(1)}`)
              }
            }
          }
        }
        
        // Update final positions
        newPositions.forEach((pos, id) => {
          finalPositions.set(id, pos)
        })
        
        // If positions changed, recalculate group heights based on new positions
        if (positionsChanged) {
          let heightsChanged = false
          groupChildren.forEach((children, groupId) => {
            if (children.length === 0) return
            
            const groupItem = orderedItems.find(i => i.id === groupId)
            if (!groupItem) return
            
            let minY = Infinity
            let maxY = -Infinity
            
            children.forEach(child => {
              const childPos = finalPositions.get(child.id)!
              const childHeight = measuredHeights.get(child.id) || child.transform_height || 30
              
              minY = Math.min(minY, childPos.y)
              maxY = Math.max(maxY, childPos.y + childHeight)
            })
            
            const groupHeight = maxY - minY
            const currentHeight = measuredHeights.get(groupId) || groupItem.transform_height || 30
            
            if (Math.abs(groupHeight - currentHeight) > 0.1) {
              console.log(`[PDF] Position iteration ${posIterations}: Updating group ${groupId} height from ${currentHeight.toFixed(1)} to ${groupHeight.toFixed(1)}`)
              measuredHeights.set(groupId, groupHeight)
              heightsChanged = true
            }
          })
          
          // If heights changed, positions need to be recalculated again
          if (heightsChanged) {
            positionsChanged = true
          }
        }
      }
      
      console.log(`[PDF] Final position calculation completed after ${posIterations} iterations`)
      
      // Ensure all positions are set
      for (const item of orderedItems) {
        if (!finalPositions.has(item.id)) {
          const pos = calculateAnchorPosition(item, orderedItems, new Set(), measuredHeights)
          finalPositions.set(item.id, pos)
        }
      }
      
      // Debug: Log final positions for all groups and their children
      console.log(`[PDF] Final positions summary:`)
      orderedItems.forEach(item => {
        const pos = finalPositions.get(item.id)
        if (pos) {
          if (item.type === "anchor") {
            const isGroup = groupChildren.has(item.id)
            if (isGroup) {
              const children = groupChildren.get(item.id) || []
              console.log(`[PDF]   Group ${item.id} (code: ${item.code}): pos (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), height: ${measuredHeights.get(item.id)?.toFixed(1) || item.transform_height}`)
              // Log children positions
              children.forEach(child => {
                const childPos = finalPositions.get(child.id)
                if (childPos) {
                  console.log(`[PDF]     Child ${child.field_name || child.id}: pos (${childPos.x.toFixed(1)}, ${childPos.y.toFixed(1)})`)
                } else {
                  console.log(`[PDF]     Child ${child.field_name || child.id}: NO POSITION IN finalPositions!`)
                }
              })
            }
          } else if (item.type === "field" && item.fields) {
            const itemGroup = (item as any).group
            console.log(`[PDF]   Table ${item.field_name}: pos (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), height: ${measuredHeights.get(item.id)?.toFixed(1) || item.transform_height}, group: ${itemGroup || 'none'}`)
          }
        }
      })
      
      const finalItemPromises = orderedItems.map((item) => 
        renderTemplateItem(item, doc, baseUrl, sessionContext, orderedItems, measuredHeights, finalPositions, language, fieldConfigsMap, childFieldConfigsMap)
      )
      const finalItemResults = await Promise.all(finalItemPromises)
      const finalItemsHtml = finalItemResults.join("")
      
      // Final HTML with all items and measured heights
      currentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
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
    ${template?.css || ""}
    ${letterHead?.css_content || ""}
  </style>
</head>
<body>
  <div class="page-container">
    ${letterHeadHtml}
    ${finalItemsHtml}
  </div>
</body>
</html>`
      
      await page.close()
      htmlPages.push(currentHtml)
    } catch (error) {
      console.error("[PDF] Error during chain rendering:", error)
      // Fall back to simple rendering without measurement
      const fallbackMeasuredHeights = new Map<string, number>()
      items.forEach((item) => {
        fallbackMeasuredHeights.set(item.id, item.transform_height || 30)
      })
      const fallbackItemPromises = items.map((item) => 
        renderTemplateItem(item, doc, baseUrl, sessionContext, items, fallbackMeasuredHeights, undefined, language, fieldConfigsMap, childFieldConfigsMap)
      )
      const fallbackItemResults = await Promise.all(fallbackItemPromises)
      const fallbackItemsHtml = fallbackItemResults.join("")
      
      htmlPages.push(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
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
    ${template?.css || ""}
    ${letterHead?.css_content || ""}
  </style>
</head>
<body>
  <div class="page-container">
    ${letterHeadHtml}
    ${fallbackItemsHtml}
  </div>
</body>
</html>`)
    } finally {
      await browser.close()
    }
  }

  // If format is HTML, return HTML (useful for debugging)
  if (format === "html") {
    return new Response(htmlPages[0] || "", {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
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
      
      await page.setViewport({
        width: Math.round((pageDims.width * 96) / 25.4),
        height: Math.round((pageDims.height * 96) / 25.4),
      })
      
      await page.setContent(html, { waitUntil: "networkidle0" })
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const pdfBuffer = await page.pdf({
        format: pageFormat === "Custom" ? undefined : (pageFormat as any),
        width: pageFormat === "Custom" ? `${pageDims.width}mm` : undefined,
        height: pageFormat === "Custom" ? `${pageDims.height}mm` : undefined,
        margin: {
          top: `${template?.margin_top || 10}mm`,
          right: `${template?.margin_right || 10}mm`,
          bottom: `${template?.margin_bottom || 10}mm`,
          left: `${template?.margin_left || 10}mm`,
        },
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: true,
        headerTemplate: `
        <title>
          ${ids.length > 1 ? `${print_template}_${new Date().getTime()}` : ids[0]}
        </title>
        `,
      })
      pdfBuffers.push(Buffer.from(pdfBuffer))
      await page.close()
    }

    await browser.close()

    const pdfBuffer = pdfBuffers[0] || Buffer.from("")

    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `filename="${ids.length > 1 ? `${print_template}_${new Date().getTime()}` : ids[0]}.pdf"`
      },
    })
  } catch (error: any) {
    await browser.close()
    return ctx.json({ error: error.message || "Failed to generate PDF" }, 500)
  }
}, {
  query: z.object({
    print_template: z.string().optional(),
    doctype: z.string(),
    ids: z.union([z.string(), z.array(z.string())]),
    lang: z.string().nullable().optional(),
    letter_head: z.string().nullable().optional(),
    format: z.enum(["pdf", "html"]).optional(),
    organization: z.string().optional()
  }),
  method: "GET",
})
