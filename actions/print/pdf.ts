import { z } from "bxo"
import puppeteer from "puppeteer"
import path from "path"
import { getFieldValueFromDoc } from "@/zodula/client/utils"
import { PAGE_FORMATS, generateTemplateFromTabs, type PrintTemplateElement } from "@/zodula/client/code-utils"
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
      // This indicates a new-row element
      if (offsetY > originalAnchorHeight && originalAnchorHeight > 0) {
        // Extract spacing: offsetY = originalAnchorHeight + spacing
        const spacing = offsetY - originalAnchorHeight
        // Recalculate with measured height: measuredAnchorHeight + spacing
        offsetY = measuredAnchorHeight + spacing
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
  finalPositions?: Map<string, { x: number; y: number }>
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
      
      // Handle nested fields for Reference Table/Extend types
      if (fields && typeof fields === "string") {
        try {
          const childFields = JSON.parse(fields)
          if (Array.isArray(childFields) && childFields.length > 0) {
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
              
              // Render rows
              const rows = parentFieldValue.map((childDoc: any, rowIndex: number) => {
                const cells = sortedColumns.map((col: any) => {
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
                  return `<td style="${cellStyles.join("; ")}">${childValue}</td>`
                }).join("")
                const rowStyles: string[] = []
                return `<tr style="${rowStyles.join("; ")}">${cells}</tr>`
              }).join("")
              
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
                  return `<th style="${headerStyles.join("; ")}">${col.field}</th>`
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
      
      const labelText = label || ""
      
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
      
      const labelText = label || ""
      
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
    })).filter((f: any) => f.name)

    // Parse tabs
    const tabs = typeof doctypeDoc.tabs === 'string' 
      ? JSON.parse(doctypeDoc.tabs) 
      : doctypeDoc.tabs

    if (!Array.isArray(tabs) || tabs.length === 0) {
      return ctx.json({ error: "Doctype has no tabs configured. Please configure tabs or provide a print_template." }, 400)
    }

    // Helper function to fetch child fields for reference tables
    const fetchChildFields = async (referenceDoctype: string): Promise<Array<{ field: string; order: number; required?: boolean; in_list_view?: boolean }>> => {
      try {
        const { docs: childFieldDocs } = await $zodula.doctype("zodula__Field")
          .select()
          .where("doctype", "=", referenceDoctype)
          .sort("idx", "asc")
          .bypass(true)

        const standardFieldNames = new Set([
          "id", "organization", "owner", "created_at", "updated_at",
          "created_by", "updated_by", "doc_status", "idx", "vector"
        ])

        return childFieldDocs
          .filter((field: any) => {
            const fieldDoctype = field.doctype || ""
            const fieldName = field.name || ""
            return fieldDoctype === referenceDoctype && !standardFieldNames.has(fieldName)
          })
          .map((field: any, idx: number) => ({
            field: field.name || "",
            order: idx,
            required: field.required === 1 || field.required === true,
            in_list_view: field.in_list_view === 1 || field.in_list_view === true
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
  const organization = orgParam || await $zodula.session.organization(true).catch(() => null)
  for (const id of ids) {
    const doc = await $zodula.doctype(doctype as any).get(id).bypass(true)
    if (doc) {
      // If organization is provided, verify the document belongs to that organization
      if (organization && doc.organization && doc.organization !== organization) {
        continue // Skip documents that don't belong to the specified organization
      }
      documents.push(doc)
    }
  }

  if (documents.length === 0) {
    return ctx.json({ error: "No documents found" }, 404)
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
      const letterHeadPromises = letterHeadItems.map((item) => renderTemplateItem(item, doc, baseUrl, sessionContext, letterHeadItems))
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
        renderTemplateItem(item, doc, baseUrl, sessionContext, orderedItems, initialMeasuredHeights)
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
      
      measuredHeights.forEach((height, itemId) => {
        const item = orderedItems.find(i => i.id === itemId)
        if (item) {
          const original = item.transform_height || 30
          const diff = height - original
        }
      })
      
      const finalPositions = new Map<string, { x: number; y: number }>()
      for (const item of orderedItems) {
        const originalPos = { x: item.transform_x || 0, y: item.transform_y || 0 }
        const pos = calculateAnchorPosition(item, orderedItems, new Set(), measuredHeights)
        finalPositions.set(item.id, pos)
        
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
          const anchorItem = orderedItems.find((i: any) => {
            if (i.code && anchorConfig.anchorTo === i.code) return true
            if (anchorConfig.anchorTo === i.id) return true
            return false
          })
          if (anchorItem) {
            const anchorHeight = measuredHeights.get(anchorItem.id) || anchorItem.transform_height || 0
            const anchorOriginalHeight = anchorItem.transform_height || 0
            const anchorHeightDiff = anchorHeight - anchorOriginalHeight
            
            const xDiff = pos.x - originalPos.x
            const yDiff = pos.y - originalPos.y
          }
        } else {
          const xDiff = pos.x - originalPos.x
          const yDiff = pos.y - originalPos.y
          }
        }
      
      const finalItemPromises = orderedItems.map((item) => 
        renderTemplateItem(item, doc, baseUrl, sessionContext, orderedItems, measuredHeights, finalPositions)
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
        renderTemplateItem(item, doc, baseUrl, sessionContext, items, fallbackMeasuredHeights)
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
