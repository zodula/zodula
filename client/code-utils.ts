// Page format dimensions in mm
export const PAGE_FORMATS: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
};

// PrintTemplateElement interface (shared type)
export interface PrintTemplateElement {
  id: string;
  code?: string; // Code for anchoring (stable identifier, not auto-generated id)
  type: "field" | "text" | "image" | "line" | "reference" | "custom_html" | "anchor";
  value?: string | File;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fields?: string[]; // For Reference Table and Extend: child fields to display
  // For reference element type
  referenceDoctype?: string;
  referenceIdFilter?: string;
  referenceField?: string;
  // Label support for field and reference
  label?: string;
  labelPosition?: "left" | "right" | "top" | "bottom";
  // Anchor support
  anchorTo?: string; // Code of element to anchor to
  anchorPosition?: "top-left";
  anchorOffset?: number | { x: number; y: number };
  // Table configuration for Reference Table fields
  tableConfig?: {
    columns?: Array<{
      field: string;
      width?: number;
      order?: number;
    }>;
    rowHeight?: number;
    showHeader?: boolean;
    showBorder?: boolean;
  };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    color?: string;
    backgroundColor?: string;
    border?: string;
    padding?: string;
    margin?: string;
    width?: string;
    height?: string;
  };
  transform?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Field configuration interface
export interface FieldConfig {
  name: string;
  label?: string;
  type: string;
  reference?: string;
}

// Tab layout item interface
export interface TabLayoutItem {
  type: string;
  value?: string;
  align?: string;
}

// Tab interface
export interface Tab {
  type: string;
  layout?: TabLayoutItem[];
}

// Child field interface
export interface ChildField {
  field: string;
  order: number;
  required?: boolean;
  in_list_view?: boolean;
}

// Generate code using timestamp + random hex
function generateCode(prefix: string = ""): string {
  const timestamp = Date.now();
  const randomHex = Math.random().toString(16).substring(2, 10); // 8 hex characters
  const code = `${timestamp}_${randomHex}`;
  return prefix ? `${prefix}_${code}` : code;
}

// Generate print template elements from doctype tabs
export async function generateTemplateFromTabs(options: {
  tabs: Tab[];
  fields: FieldConfig[];
  pageDimensions: { width: number; height: number }; // in mm
  doctypeLabel: string;
  fetchChildFields: (referenceDoctype: string) => Promise<ChildField[]>;
}): Promise<PrintTemplateElement[]> {
  const { tabs, fields, pageDimensions, doctypeLabel, fetchChildFields } = options;
  
  if (!tabs || tabs.length === 0 || !fields || fields.length === 0) {
    return [];
  }
  
  // Start with completely empty array
  const newElements: PrintTemplateElement[] = [];
  let currentY = 20; // Start position
  const pageWidth = pageDimensions.width; // in mm, convert to px (1mm ≈ 3.78px)
  const pageWidthPx = pageWidth * 3.78;
  const margin = 20; // Margin in pixels
  const fieldWidth = (pageWidthPx - margin * 2 - 10) / 2; // Two columns with gap
  const fieldHeight = 50; // Minimum 50px height for field elements
  const fieldSpacing = 10;
  
  // Add header with doctype name
  const headerId = `element_${Date.now()}_header`;
  const headerCode = generateCode("header");
  
  // Check if header already exists (shouldn't happen, but safety check)
  const existingHeader = newElements.find(el => el.code === headerCode || (el.type === "text" && el.value === doctypeLabel));
  if (!existingHeader) {
    newElements.push({
      id: headerId,
      code: headerCode,
      type: "text",
      value: doctypeLabel,
      align: "left",
      verticalAlign: "middle",
      style: {
        fontSize: 24,
        fontWeight: "bold",
      },
      transform: {
        x: margin,
        y: currentY,
        width: pageWidthPx - margin * 2,
        height: 40,
      },
    });
    currentY += 40;
  }
  
  // Add docid field
  const docidId = `element_${Date.now()}_docid`;
  const docidCode = generateCode("docid");
  newElements.push({
    id: docidId,
    code: docidCode,
    type: "field",
    value: "id",
    align: "left",
    verticalAlign: "middle",
    label: "",
    labelPosition: "top",
    anchorTo: headerCode,
    anchorPosition: "top-left",
    anchorOffset: { x: 0, y: 40 },
    transform: {
      x: margin,
      y: currentY,
      width: pageWidthPx - margin * 2,
      height: 20,
    },
  });
  currentY += 20 + fieldSpacing;
  
  // Start chaining from docid
  const contentChainStartCode = docidCode;
  
  // Process each tab
  for (const tab of tabs) {
    if (tab.type !== "Tab" || !tab.layout) continue;
    
    let currentSection: string | null = null;
    let currentAnchorCode = contentChainStartCode;
    let lastRowAnchorCode: string | null = null;
    let currentX = margin;
    
    // Process layout items
    const processLayoutItem = async (item: TabLayoutItem | TabLayoutItem[]) => {
      if (Array.isArray(item)) {
        // Process array of fields (row)
        for (const fieldItem of item) {
          if (fieldItem.type === "field" && fieldItem.value) {
            const fieldName = fieldItem.value;
            const fieldConfig = fields.find(f => f.name === fieldName);
            
            if (fieldConfig) {
              // Check if it's a Reference Table
              if (fieldConfig.type === "Reference Table" && fieldConfig.reference) {
                // Fetch child fields for the table
                const childFields = await fetchChildFields(fieldConfig.reference);
                
                // Default select fields that are required or in_list_view
                const defaultSelectedFields = childFields
                  .filter(col => col.required || col.in_list_view)
                  .map(col => col.field);
                
                // Use default selected fields, or all fields if none are required/in_list_view
                const selectedFieldNames = defaultSelectedFields.length > 0 
                  ? defaultSelectedFields 
                  : childFields.map(col => col.field);
                
                // Get columns for selected fields only, maintaining order
                const selectedColumns = childFields
                  .filter(col => selectedFieldNames.includes(col.field))
                  .map((col, idx) => ({ field: col.field, order: idx }));
                
                // Add table element with child fields - anchored to current anchor
                const tableElementId = `element_${Date.now()}_${fieldName}`;
                const tableCode = generateCode("table");
                
                // Calculate anchor offset - if starting new row, align to margin
                let tableAnchorOffset: { x: number; y: number } = { x: 0, y: 15 };
                if (currentX === margin) {
                  // Starting new row - calculate offset to align with margin
                  const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                  if (anchorElement) {
                    const anchorX = anchorElement.transform?.x || 0;
                    const anchorHeight = anchorElement.transform?.height || fieldHeight;
                    // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                    tableAnchorOffset = { x: margin - anchorX, y: anchorHeight + fieldSpacing };
                  }
                }
                
                const tableElement: PrintTemplateElement = {
                  id: tableElementId,
                  code: tableCode,
                  type: "field",
                  value: fieldName,
                  align: "left",
                  verticalAlign: "top",
                  label: fieldConfig.label || fieldName,
                  labelPosition: "top",
                  fields: selectedFieldNames,
                  anchorTo: currentAnchorCode,
                  anchorPosition: "top-left",
                  anchorOffset: tableAnchorOffset,
                  transform: {
                    x: margin,
                    y: 0, // Will be calculated from anchor
                    width: pageWidthPx - margin * 2,
                    height: 150, // Default table height
                  },
                  tableConfig: {
                    showHeader: true,
                    showBorder: true,
                    rowHeight: 20,
                    columns: selectedColumns,
                  },
                };
                
                newElements.push(tableElement);
                
                // Chain next elements directly to this table element (using code)
                currentAnchorCode = tableCode;
                lastRowAnchorCode = null; // Reset row anchor
                currentX = margin; // Reset to start of row
              } else {
                // Regular field - anchor based on position
                const fieldElementId = `element_${Date.now()}_${fieldName}`;
                const fieldCode = generateCode();
                let anchorToCode: string | undefined = undefined;
                let anchorPosition: "top-left" | undefined = "top-left";
                let anchorOffset: { x: number; y: number } | undefined = undefined;
                
                if (currentX === margin) {
                  // Starting new row - anchor to last element or last row's first element
                  if (lastRowAnchorCode) {
                    // Anchor to first element of previous row - get its position and add spacing
                    const lastElement = newElements.find(el => (el.code && el.code === lastRowAnchorCode) || (!el.code && el.id === lastRowAnchorCode));
                    if (lastElement) {
                      const lastElementX = lastElement.transform?.x || 0;
                      const lastElementHeight = lastElement.transform?.height || fieldHeight;
                      // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                      anchorToCode = lastElement.code || lastElement.id;
                      anchorOffset = { x: margin - lastElementX, y: lastElementHeight + fieldSpacing };
                    } else {
                      anchorToCode = lastRowAnchorCode;
                      anchorOffset = { x: 0, y: fieldSpacing };
                    }
                  } else {
                    // First element in tab - anchor to current chain element
                    const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                    if (anchorElement) {
                      const anchorX = anchorElement.transform?.x || 0;
                      const anchorHeight = anchorElement.transform?.height || fieldHeight;
                      // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                      anchorToCode = anchorElement.code || anchorElement.id;
                      anchorOffset = { x: margin - anchorX, y: anchorHeight + fieldSpacing };
                    } else {
                      anchorToCode = currentAnchorCode;
                      anchorOffset = { x: 0, y: fieldSpacing };
                    }
                  }
                  // Set as first element of this row (using code)
                  lastRowAnchorCode = fieldCode;
                } else {
                  // Same row - anchor to previous element in row
                  const previousElement = newElements.length > 0 ? newElements[newElements.length - 1] : null;
                  if (previousElement) {
                    const prevElementWidth = previousElement.transform?.width || fieldWidth;
                    anchorToCode = previousElement.code || previousElement.id;
                    anchorOffset = { x: prevElementWidth + 10, y: 0 };
                  }
                }
                
                const fieldElement: PrintTemplateElement = {
                  id: fieldElementId,
                  code: fieldCode,
                  type: "field",
                  value: fieldName,
                  align: (fieldItem.align as any) || "left",
                  verticalAlign: "middle",
                  label: fieldConfig.label || fieldName,
                  labelPosition: "top",
                  anchorTo: anchorToCode,
                  anchorPosition: anchorPosition,
                  anchorOffset: anchorOffset,
                  transform: {
                    x: currentX,
                    y: 0, // Will be calculated from anchor
                    width: fieldWidth,
                    height: fieldHeight,
                  },
                };
                
                newElements.push(fieldElement);
                
                // Update current anchor to this field for next elements (using code)
                currentAnchorCode = fieldCode;
                
                // Move to next column or next row
                if (currentX + fieldWidth * 2 + 10 <= pageWidthPx - margin) {
                  currentX += fieldWidth + 10;
                } else {
                  currentX = margin;
                  lastRowAnchorCode = null; // Reset for next row
                }
              }
            }
          } else if (fieldItem.type === "empty") {
            // Skip empty field, move to next position
            if (currentX + fieldWidth * 2 + 10 <= pageWidthPx - margin) {
              currentX += fieldWidth + 10;
            } else {
              currentX = margin;
              lastRowAnchorCode = null; // Reset for next row
            }
          }
        }
      } else if (item.type === "section" && item.value) {
        // Skip section header generation - don't create text elements for sections
        // Create anchor point for new section if section changed
        if (currentSection && item.value && currentSection !== item.value) {
          // Chain to the last real element (no extra anchor nodes) - use code
          const lastEl = newElements.length > 0 ? newElements[newElements.length - 1] : null;
          if (lastEl) {
            currentAnchorCode = lastEl.code || lastEl.id;
          }
          lastRowAnchorCode = null; // Reset row anchor
        } else if (!currentSection && item.value) {
          // First section - keep chaining from currentAnchorCode
        }
        
        currentSection = item.value;
        currentX = margin; // Reset to start of row
        lastRowAnchorCode = null; // Reset row anchor
      } else if (item.type === "field" && item.value) {
        const fieldName = item.value;
        const fieldConfig = fields.find(f => f.name === fieldName);
        
        if (fieldConfig) {
          if (fieldConfig.type === "Reference Table" && fieldConfig.reference) {
            // Fetch child fields for the table
            const childFields = await fetchChildFields(fieldConfig.reference);
            // Default select fields that are required or in_list_view
            const defaultSelectedFields = childFields
              .filter(col => col.required || col.in_list_view)
              .map(col => col.field);
            // Use default selected fields, or all fields if none are required/in_list_view
            const selectedFieldNames = defaultSelectedFields.length > 0 
              ? defaultSelectedFields 
              : childFields.map(col => col.field);
            // Get columns for selected fields only, maintaining order
            const selectedColumns = childFields
              .filter(col => selectedFieldNames.includes(col.field))
              .map((col, idx) => ({ field: col.field, order: idx }));
            const tableElementId = `element_${Date.now()}_${fieldName}`;
            const tableCode = generateCode("table");
            
            // Calculate anchor offset - if starting new row, align to margin
            let tableAnchorOffset: { x: number; y: number } = { x: 0, y: 15 };
            if (currentX === margin) {
              // Starting new row - calculate offset to align with margin
              const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
              if (anchorElement) {
                const anchorX = anchorElement.transform?.x || 0;
                const anchorHeight = anchorElement.transform?.height || fieldHeight;
                // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                tableAnchorOffset = { x: margin - anchorX, y: anchorHeight + fieldSpacing };
              }
            }
            
            // Add table element with child fields - anchored to current anchor
            const tableElement: PrintTemplateElement = {
              id: tableElementId,
              code: tableCode,
              type: "field",
              value: fieldName,
              align: "left",
              verticalAlign: "top",
              label: fieldConfig.label || fieldName,
              labelPosition: "top",
              fields: selectedFieldNames,
              anchorTo: currentAnchorCode,
              anchorPosition: "top-left",
              anchorOffset: tableAnchorOffset,
              transform: {
                x: margin,
                y: 0, // Will be calculated from anchor
                width: pageWidthPx - margin * 2,
                height: 150,
              },
              tableConfig: {
                showHeader: true,
                showBorder: true,
                rowHeight: 20,
                columns: selectedColumns,
              },
            };
            
            newElements.push(tableElement);
            
            // Chain next elements directly to this table element (using code)
            currentAnchorCode = tableCode;
            lastRowAnchorCode = null; // Reset row anchor
            currentX = margin;
          } else {
            // Regular field - anchor based on position
            const fieldElementId = `element_${Date.now()}_${fieldName}`;
            const fieldCode = generateCode();
            let anchorToCode: string | undefined = undefined;
            let anchorPosition: "top-left" | undefined = "top-left";
            let anchorOffset: { x: number; y: number } | undefined = undefined;
            
            if (currentX === margin) {
              // Starting new row - anchor to last element or last row's first element
              if (lastRowAnchorCode) {
                // Anchor to first element of previous row - get its position and add spacing
                const lastElement = newElements.find(el => (el.code && el.code === lastRowAnchorCode) || (!el.code && el.id === lastRowAnchorCode));
                if (lastElement) {
                  const lastElementX = lastElement.transform?.x || 0;
                  const lastElementHeight = lastElement.transform?.height || fieldHeight;
                  // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                  anchorToCode = lastElement.code || lastElement.id;
                  anchorOffset = { x: margin - lastElementX, y: lastElementHeight + fieldSpacing };
                } else {
                  anchorToCode = lastRowAnchorCode;
                  anchorOffset = { x: 0, y: fieldSpacing };
                }
              } else {
                // First element in section - anchor to current chain element
                const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                if (anchorElement) {
                  const anchorX = anchorElement.transform?.x || 0;
                  const anchorHeight = anchorElement.transform?.height || fieldHeight;
                  // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                  anchorToCode = anchorElement.code || anchorElement.id;
                  anchorOffset = { x: margin - anchorX, y: anchorHeight + fieldSpacing };
                } else {
                  anchorToCode = currentAnchorCode;
                  anchorOffset = { x: 0, y: fieldSpacing };
                }
              }
              // Set as first element of this row (using code)
              lastRowAnchorCode = fieldCode;
            } else {
              // Same row - anchor to previous element in row
              const previousElement = newElements.length > 0 ? newElements[newElements.length - 1] : null;
              if (previousElement) {
                const prevElementWidth = previousElement.transform?.width || fieldWidth;
                anchorToCode = previousElement.code || previousElement.id;
                anchorOffset = { x: prevElementWidth + 10, y: 0 };
              }
            }
            
            newElements.push({
              id: fieldElementId,
              code: fieldCode,
              type: "field",
              value: fieldName,
              align: (item.align as any) || "left",
              verticalAlign: "middle",
              label: fieldConfig.label || fieldName,
              labelPosition: "top",
              anchorTo: anchorToCode,
              anchorPosition: anchorPosition,
              anchorOffset: anchorOffset,
              transform: {
                x: currentX,
                y: 0, // Will be calculated from anchor
                width: fieldWidth,
                height: fieldHeight,
              },
            });
            
            // Update current anchor to this field for next elements (using code)
            currentAnchorCode = fieldCode;
            
            if (currentX + fieldWidth * 2 + 10 <= pageWidthPx - margin) {
              currentX += fieldWidth + 10;
            } else {
              currentX = margin;
              lastRowAnchorCode = null; // Reset for next row
            }
          }
        }
      }
    };
    
    // Process all layout items
    for (const item of tab.layout) {
      await processLayoutItem(item);
    }
    
    // Add spacing after tab
    currentY += 30;
  }
  
  return newElements;
}

