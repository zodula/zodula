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
      label?: string;
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
  no_print?: boolean | number; // If true or 1, field should not be included in print template
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
  label?: string;
  order: number;
  required?: boolean;
  in_list_view?: boolean;
  no_print?: boolean | number; // If true or 1, field should not be included in print template
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
  fetchChildFields: (referenceDoctype: string, parentDoctype?: string) => Promise<ChildField[]>;
  doctype: string;
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
  const fieldHeight = 50; // Minimum 50px height for field elements
  const fieldSpacing = 10;
  const gapBetweenFields = 10; // Gap between fields in a row
  
  // Calculate maximum number of columns by analyzing all tabs
  let maxColumns = 2; // Default to 2 columns
  for (const tab of tabs) {
    if (tab.type !== "Tab" || !tab.layout) continue;
    for (const item of tab.layout) {
      if (Array.isArray(item)) {
        // Count actual field items (not empty)
        const fieldCount = item.filter(fieldItem => fieldItem.type === "field" && fieldItem.value).length;
        if (fieldCount > maxColumns) {
          maxColumns = fieldCount;
        }
      }
    }
  }
  
  // Calculate field width based on maximum columns
  const availableWidth = pageWidthPx - margin * 2;
  const totalGaps = (maxColumns - 1) * gapBetweenFields;
  const fieldWidth = (availableWidth - totalGaps) / maxColumns;
  
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
  let currentAnchorCode = docidCode;
  let tabIndex = 0;
  
  // Process each tab
  for (const tab of tabs) {
    if (tab.type !== "Tab" || !tab.layout) continue;
    
    // Add spacing between tabs (except for the first tab)
    if (tabIndex > 0) {
      // Find the last element from previous tab to anchor from
      const lastElement = newElements.length > 0 ? newElements[newElements.length - 1] : null;
      if (lastElement) {
        currentAnchorCode = lastElement.code || lastElement.id;
      }
    }
    
    let currentSection: string | null = null;
    let lastRowAnchorCode: string | null = null;
    let currentX = margin;
    let tabFirstElementCode: string | null = null; // Track first element of this tab
    
    // Process layout items
    const processLayoutItem = async (item: TabLayoutItem | TabLayoutItem[]) => {
      if (Array.isArray(item)) {
        // Process array of fields (row)
        // First, count visible fields (excluding no_print fields) to calculate correct width
        const visibleFields: Array<{ fieldItem: TabLayoutItem; fieldConfig: FieldConfig }> = [];
        for (const fieldItem of item) {
          if (fieldItem.type === "field" && fieldItem.value) {
            const fieldName = fieldItem.value;
            const fieldConfig = fields.find(f => f.name === fieldName);
            // Only include fields that are not no_print
            if (fieldConfig && !(fieldConfig.no_print === true || fieldConfig.no_print === 1)) {
              visibleFields.push({ fieldItem, fieldConfig });
            }
          }
        }
        
        // Calculate field width for this row based on actual visible fields
        const visibleFieldCount = visibleFields.length;
        const rowFieldWidth = visibleFieldCount > 0 
          ? (availableWidth - (visibleFieldCount - 1) * gapBetweenFields) / visibleFieldCount
          : fieldWidth;
        
        let hasPlacedFieldInRow = false; // Track if we've placed any field in this row
        for (const { fieldItem, fieldConfig } of visibleFields) {
          if (fieldItem.type === "field" && fieldItem.value) {
            const fieldName = fieldItem.value;
            
            if (fieldConfig) {
              // Check if it's a Reference Table
              if (fieldConfig.type === "Reference Table" && fieldConfig.reference && fieldConfig.reference !== options.doctype ) {
                // Fetch child fields for the table, excluding fields that reference the parent doctype
                const childFields = await fetchChildFields(fieldConfig.reference, options.doctype);
                
                // Filter out fields with no_print set to true or 1
                const printableChildFields = childFields.filter(
                  col => !(col.no_print === true || col.no_print === 1)
                );
                
                // Default select fields that are required or in_list_view
                const defaultSelectedFields = printableChildFields
                  .filter(col => col.required || col.in_list_view)
                  .map(col => col.field);
                
                // Use default selected fields, or all fields if none are required/in_list_view
                const selectedFieldNames = defaultSelectedFields.length > 0 
                  ? defaultSelectedFields 
                  : printableChildFields.map(col => col.field);
                
                // Get columns for selected fields only, maintaining order
                const selectedColumns = printableChildFields
                  .filter(col => selectedFieldNames.includes(col.field))
                  .map((col, idx) => ({ field: col.field, label: col.label, order: idx }));
                
                // Add table element with child fields - anchored to current anchor
                const tableElementId = `element_${Date.now()}_${fieldName}`;
                const tableCode = generateCode("table");
                
                // Calculate anchor offset - Reference Table fields should always start at left margin
                // Find the anchor element to position vertically
                const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                let tableAnchorOffset: { x: number; y: number } = { x: 0, y: 15 };
                
                if (anchorElement) {
                  // Calculate the anchor's actual position (accounting for its own anchors)
                  // We need to recursively calculate the anchor position
                  const calculateElementPosition = (el: PrintTemplateElement, visited: Set<string> = new Set()): { x: number; y: number } => {
                    if (visited.has(el.id)) {
                      return { x: el.transform?.x || 0, y: el.transform?.y || 0 };
                    }
                    visited.add(el.id);
                    
                    if (!el.anchorTo) {
                      return { x: el.transform?.x || 0, y: el.transform?.y || 0 };
                    }
                    
                    const anchorEl = newElements.find(a => (a.code && a.code === el.anchorTo) || (!a.code && a.id === el.anchorTo));
                    if (!anchorEl) {
                      return { x: el.transform?.x || 0, y: el.transform?.y || 0 };
                    }
                    
                    const anchorPos = calculateElementPosition(anchorEl, visited);
                    const anchorHeight = anchorEl.transform?.height || fieldHeight;
                    const offset = el.anchorOffset || { x: 0, y: 0 };
                    const offsetX = typeof offset === "object" ? offset.x : 0;
                    const offsetY = typeof offset === "object" ? offset.y : (typeof offset === "number" ? offset : 0);
                    
                    return {
                      x: anchorPos.x + offsetX,
                      y: anchorPos.y + offsetY
                    };
                  };
                  
                  const anchorPos = calculateElementPosition(anchorElement);
                  const anchorHeight = anchorElement.transform?.height || fieldHeight;
                  // Always align to left margin: offsetX = margin - calculatedAnchorX
                  // Add extra spacing for new tab (30px) if this is the first element of tab
                  const tabSpacing = tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing;
                  tableAnchorOffset = { x: margin - anchorPos.x, y: anchorHeight + tabSpacing };
                }
                
                // Track first element of tab
                if (!tabFirstElementCode) {
                  tabFirstElementCode = tableCode;
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
                hasPlacedFieldInRow = true; // Mark that we've placed a field in this row
              } else {
                // Regular field - anchor based on position
                const fieldElementId = `element_${Date.now()}_${fieldName}`;
                const fieldCode = generateCode();
                let anchorToCode: string | undefined = undefined;
                let anchorPosition: "top-left" | undefined = "top-left";
                let anchorOffset: { x: number; y: number } | undefined = undefined;
                
                // Check if we're starting a new row (not just first field after skipping no_print fields)
                const isStartingNewRow = currentX === margin && !hasPlacedFieldInRow;
                
                if (isStartingNewRow) {
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
                    // First element in tab - anchor to current chain element with extra spacing for new tab
                    const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                    if (anchorElement) {
                      const anchorX = anchorElement.transform?.x || 0;
                      const anchorHeight = anchorElement.transform?.height || fieldHeight;
                      // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                      // Add extra spacing for new tab (30px)
                      const tabSpacing = tabIndex > 0 ? 30 : fieldSpacing;
                      anchorToCode = anchorElement.code || anchorElement.id;
                      anchorOffset = { x: margin - anchorX, y: anchorHeight + tabSpacing };
                    } else {
                      anchorToCode = currentAnchorCode;
                      anchorOffset = { x: 0, y: tabIndex > 0 ? 30 : fieldSpacing };
                    }
                  }
                  // Set as first element of this row (using code)
                  lastRowAnchorCode = fieldCode;
                  // Track first element of tab
                  if (!tabFirstElementCode) {
                    tabFirstElementCode = fieldCode;
                  }
                } else {
                  // Same row - anchor to previous element in row
                  const previousElement = newElements.length > 0 ? newElements[newElements.length - 1] : null;
                  if (previousElement) {
                    const prevElementWidth = previousElement.transform?.width || rowFieldWidth;
                    anchorToCode = previousElement.code || previousElement.id;
                    anchorOffset = { x: prevElementWidth + gapBetweenFields, y: 0 };
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
                    width: rowFieldWidth,
                    height: fieldHeight,
                  },
                };
                
                newElements.push(fieldElement);
                
                // Update current anchor to this field for next elements (using code)
                currentAnchorCode = fieldCode;
                hasPlacedFieldInRow = true; // Mark that we've placed a field in this row
                
                // Move to next column or next row
                const nextX = currentX + rowFieldWidth + gapBetweenFields;
                if (nextX + rowFieldWidth <= pageWidthPx - margin) {
                  currentX = nextX;
                } else {
                  currentX = margin;
                  lastRowAnchorCode = null; // Reset for next row
                }
              }
            }
          } else if (fieldItem.type === "empty") {
            // Skip empty field, move to next position
            const nextX = currentX + rowFieldWidth + gapBetweenFields;
            if (nextX + rowFieldWidth <= pageWidthPx - margin) {
              currentX = nextX;
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
        
        // Skip fields with no_print set to true or 1
        if (fieldConfig && (fieldConfig.no_print === true || fieldConfig.no_print === 1)) {
          // Skip this field - don't advance currentX, just return early
          return;
        } else if (fieldConfig) {
          if (fieldConfig.type === "Reference Table" && fieldConfig.reference) {
            // Fetch child fields for the table, excluding fields that reference the parent doctype
            const childFields = await fetchChildFields(fieldConfig.reference, options.doctype);
            
            // Filter out fields with no_print set to true or 1
            const printableChildFields = childFields.filter(
              col => !(col.no_print === true || col.no_print === 1)
            );
            
            // Default select fields that are required or in_list_view
            const defaultSelectedFields = printableChildFields
              .filter(col => col.required || col.in_list_view)
              .map(col => col.field);
            // Use default selected fields, or all fields if none are required/in_list_view
            const selectedFieldNames = defaultSelectedFields.length > 0 
              ? defaultSelectedFields 
              : printableChildFields.map(col => col.field);
            // Get columns for selected fields only, maintaining order
            const selectedColumns = printableChildFields
              .filter(col => selectedFieldNames.includes(col.field))
              .map((col, idx) => ({ field: col.field, label: col.label, order: idx }));
            const tableElementId = `element_${Date.now()}_${fieldName}`;
            const tableCode = generateCode("table");
            
            // Calculate anchor offset - Reference Table fields should always start at left margin
            // Find the anchor element to position vertically
            const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
            let tableAnchorOffset: { x: number; y: number } = { x: 0, y: 15 };
            
            if (anchorElement) {
              // Calculate the anchor's actual position (accounting for its own anchors)
              // We need to recursively calculate the anchor position
              const calculateElementPosition = (el: PrintTemplateElement, visited: Set<string> = new Set()): { x: number; y: number } => {
                if (visited.has(el.id)) {
                  return { x: el.transform?.x || 0, y: el.transform?.y || 0 };
                }
                visited.add(el.id);
                
                if (!el.anchorTo) {
                  return { x: el.transform?.x || 0, y: el.transform?.y || 0 };
                }
                
                const anchorEl = newElements.find(a => (a.code && a.code === el.anchorTo) || (!a.code && a.id === el.anchorTo));
                if (!anchorEl) {
                  return { x: el.transform?.x || 0, y: el.transform?.y || 0 };
                }
                
                const anchorPos = calculateElementPosition(anchorEl, visited);
                const anchorHeight = anchorEl.transform?.height || fieldHeight;
                const offset = el.anchorOffset || { x: 0, y: 0 };
                const offsetX = typeof offset === "object" ? offset.x : 0;
                const offsetY = typeof offset === "object" ? offset.y : (typeof offset === "number" ? offset : 0);
                
                return {
                  x: anchorPos.x + offsetX,
                  y: anchorPos.y + offsetY
                };
              };
              
              const anchorPos = calculateElementPosition(anchorElement);
              const anchorHeight = anchorElement.transform?.height || fieldHeight;
              // Always align to left margin: offsetX = margin - calculatedAnchorX
              // Add extra spacing for new tab (30px) if this is the first element of tab
              const tabSpacing = tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing;
              tableAnchorOffset = { x: margin - anchorPos.x, y: anchorHeight + tabSpacing };
            }
            
            // Track first element of tab
            if (!tabFirstElementCode) {
              tabFirstElementCode = tableCode;
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
                // First element in section - anchor to current chain element with extra spacing for new tab
                const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                if (anchorElement) {
                  const anchorX = anchorElement.transform?.x || 0;
                  const anchorHeight = anchorElement.transform?.height || fieldHeight;
                  // Calculate offset: we want new element at margin, so offsetX = margin - anchorX
                  // Add extra spacing for new tab (30px)
                  const tabSpacing = tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing;
                  anchorToCode = anchorElement.code || anchorElement.id;
                  anchorOffset = { x: margin - anchorX, y: anchorHeight + tabSpacing };
                } else {
                  anchorToCode = currentAnchorCode;
                  anchorOffset = { x: 0, y: tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing };
                }
              }
              // Set as first element of this row (using code)
              lastRowAnchorCode = fieldCode;
              // Track first element of tab
              if (!tabFirstElementCode) {
                tabFirstElementCode = fieldCode;
              }
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
            
            const nextX = currentX + fieldWidth + gapBetweenFields;
            if (nextX + fieldWidth <= pageWidthPx - margin) {
              currentX = nextX;
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
    
    // Update anchor for next tab - use the last element of this tab
    const lastElement = newElements.length > 0 ? newElements[newElements.length - 1] : null;
    if (lastElement) {
      currentAnchorCode = lastElement.code || lastElement.id;
    }
    
    tabIndex++;
  }
  
  return newElements;
}


