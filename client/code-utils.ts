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
    hideNoValue?: boolean; // Hide table if there are no rows
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
  // Group support - element can belong to a group
  group?: string; // Group ID that this element belongs to
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

  // Helper function to calculate actual position of an element (recursively accounting for anchors)
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
    const offset = el.anchorOffset || { x: 0, y: 0 };
    const offsetX = typeof offset === "object" ? offset.x : 0;
    const offsetY = typeof offset === "object" ? offset.y : (typeof offset === "number" ? offset : 0);
    
    // For "top-left" anchor position, the element is positioned at anchor's top-left + offset
    // But the anchor system uses anchorPosition to determine placement
    // For now, just add offset directly (this matches the anchor system's "top-left" behavior)
    return {
      x: anchorPos.x + offsetX,
      y: anchorPos.y + offsetY
    };
  };
  
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
        // Process array of fields (row) - create a group for this row
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
        
        // Skip if no visible fields
        if (visibleFields.length === 0) {
          return;
        }
        
        // Calculate field width for this row based on actual visible fields
        const visibleFieldCount = visibleFields.length;
        const rowFieldWidth = visibleFieldCount > 0 
          ? (availableWidth - (visibleFieldCount - 1) * gapBetweenFields) / visibleFieldCount
          : fieldWidth;
        
        // Calculate position for this row group
        // Find the last group or element to anchor to
        let rowGroupAnchorCode: string | undefined = undefined;
        let rowGroupAnchorOffset: { x: number; y: number } = { x: 0, y: fieldSpacing };
        
        // Find the last group (prefer groups) or last element
        const lastGroup = newElements.filter(el => el.type === "anchor" && newElements.some(child => child.group === el.id)).pop();
        const lastElement = newElements.length > 0 ? newElements[newElements.length - 1] : null;
        
        if (lastGroup) {
          // Anchor to last group
          const lastGroupPos = calculateElementPosition(lastGroup);
          const lastGroupHeight = lastGroup.transform?.height || fieldHeight;
          rowGroupAnchorCode = lastGroup.code || lastGroup.id;
          rowGroupAnchorOffset = { x: margin - lastGroupPos.x, y: lastGroupHeight + fieldSpacing };
        } else if (lastElement) {
          // Anchor to last element
          const lastElementPos = calculateElementPosition(lastElement);
          const lastElementHeight = lastElement.transform?.height || fieldHeight;
          const tabSpacing = tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing;
          rowGroupAnchorCode = lastElement.code || lastElement.id;
          rowGroupAnchorOffset = { x: margin - lastElementPos.x, y: lastElementHeight + tabSpacing };
        } else {
          // First element - use current anchor
          const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
          if (anchorElement) {
            const anchorPos = calculateElementPosition(anchorElement);
            const anchorHeight = anchorElement.transform?.height || fieldHeight;
            const tabSpacing = tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing;
            rowGroupAnchorCode = anchorElement.code || anchorElement.id;
            rowGroupAnchorOffset = { x: margin - anchorPos.x, y: anchorHeight + tabSpacing };
          } else {
            rowGroupAnchorCode = currentAnchorCode;
            rowGroupAnchorOffset = { x: 0, y: tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing };
          }
        }
        
        // Track first element of tab
        if (!tabFirstElementCode && rowGroupAnchorCode) {
          tabFirstElementCode = rowGroupAnchorCode;
        }
        
        // Create group for this row
        const rowGroupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const rowGroupCode = generateCode("rowgroup");
        
        // Store fields to add to group (with absolute positions relative to group)
        const rowFields: PrintTemplateElement[] = [];
        let currentRowX = 0; // Relative to group (0 = group's left edge)
        let groupMinX = 0;
        let groupMinY = 0;
        let groupMaxX = 0;
        let groupMaxY = fieldHeight;
        
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
                
                // Reference Table - add to row group (full width)
                const tableElementId = `element_${Date.now()}_${fieldName}`;
                const tableCode = generateCode("table");
                
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
                  group: rowGroupId, // Add to group
                  transform: {
                    x: 0, // Relative to group (full width)
                    y: 0, // Relative to group
                    width: pageWidthPx - margin * 2,
                    height: 60, // Default table height
                  },
                  tableConfig: {
                    showHeader: true,
                    showBorder: true,
                    rowHeight: 20,
                    columns: selectedColumns,
                    hideNoValue: false,
                  },
                };
                
                rowFields.push(tableElement);
                
                // Update group bounds (Reference Table spans full width)
                groupMinX = Math.min(groupMinX, 0);
                groupMinY = Math.min(groupMinY, 0);
                groupMaxX = Math.max(groupMaxX, pageWidthPx - margin * 2);
                groupMaxY = Math.max(groupMaxY, 60);
                
                // Reference Table takes full row, so we're done with this row
                currentRowX = 0; // Will be reset after group creation
              } else {
                // Regular field - add to row group
                const fieldElementId = `element_${Date.now()}_${fieldName}`;
                const fieldCode = generateCode();
                
                // Add field to row group (position relative to group)
                const fieldElement: PrintTemplateElement = {
                  id: fieldElementId,
                  code: fieldCode,
                  type: "field",
                  value: fieldName,
                  align: (fieldItem.align as any) || "left",
                  verticalAlign: "middle",
                  label: fieldConfig.label || fieldName,
                  labelPosition: "top",
                  group: rowGroupId, // Add to group
                  transform: {
                    x: currentRowX, // Relative to group
                    y: 0, // Relative to group
                    width: rowFieldWidth,
                    height: fieldHeight,
                  },
                };
                
                rowFields.push(fieldElement);
                
                // Update group bounds
                groupMinX = Math.min(groupMinX, currentRowX);
                groupMinY = Math.min(groupMinY, 0);
                groupMaxX = Math.max(groupMaxX, currentRowX + rowFieldWidth);
                groupMaxY = Math.max(groupMaxY, fieldHeight);
                
                // Move to next column
                currentRowX += rowFieldWidth + gapBetweenFields;
              }
            }
          } else if (fieldItem.type === "empty") {
            // Skip empty field, move to next position
            currentRowX += rowFieldWidth + gapBetweenFields;
          }
        }
        
        // Create the group element with calculated bounds
        // Group position is at the minimum bounds of children
        const groupWidth = groupMaxX - groupMinX;
        const groupHeight = groupMaxY - groupMinY;
        // Group X position: margin + minimum X offset of children
        // Since children start at currentRowX = 0, groupMinX should be 0, so groupX = margin
        const groupX = margin + groupMinX;
        
        // Calculate group's Y position from anchor (if anchored)
        // For "top-left" anchor position, Y = anchorY + offsetY
        let groupY = 0;
        if (rowGroupAnchorCode) {
          const anchorElement = newElements.find(el => 
            (el.code && el.code === rowGroupAnchorCode) || 
            (!el.code && el.id === rowGroupAnchorCode)
          );
          if (anchorElement) {
            // Calculate anchor position (recursively handles nested anchors)
            const anchorPos = calculateElementPosition(anchorElement);
            // For "top-left", position is anchorY + offsetY (offset already includes anchorHeight + spacing)
            groupY = anchorPos.y + rowGroupAnchorOffset.y;
          } else {
            // Anchor not found yet, use offset only
            groupY = rowGroupAnchorOffset.y;
          }
        }
        
        const rowGroupElement: PrintTemplateElement = {
          id: rowGroupId,
          code: rowGroupCode,
          type: "anchor",
          value: "",
          align: "left",
          verticalAlign: "top",
          anchorTo: rowGroupAnchorCode,
          anchorPosition: "top-left", // Position relative to anchor's top-left with offset
          anchorOffset: rowGroupAnchorOffset,
          transform: {
            x: groupX, // Absolute X position
            y: groupY, // Calculated from anchor
            width: groupWidth,
            height: groupHeight,
          },
        };
        
        // Add group first
        newElements.push(rowGroupElement);
        
        // Add all fields to the group (with absolute positions)
        // Children positions are stored as absolute (not relative to group)
        for (const field of rowFields) {
          // Calculate absolute positions based on group's position
          // Field's relative position within group: (field.transform.x - groupMinX, field.transform.y - groupMinY)
          // Group's absolute position: (groupX, groupY)
          // Field's absolute position: groupX + (field.transform.x - groupMinX), groupY + (field.transform.y - groupMinY)
          const absoluteX = groupX + (field.transform?.x || 0) - groupMinX;
          const absoluteY = groupY + (field.transform?.y || 0) - groupMinY;
          field.transform = {
            ...field.transform!,
            x: absoluteX, // Absolute X
            y: absoluteY, // Absolute Y
          };
          newElements.push(field);
        }
        
        // Update anchor for next row
        currentAnchorCode = rowGroupCode;
        lastRowAnchorCode = null; // Reset row anchor
        currentX = margin; // Reset to start of row
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
                height: 60,
              },
              tableConfig: {
                showHeader: true,
                showBorder: true,
                rowHeight: 20,
                columns: selectedColumns,
                hideNoValue: false,
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
                // Anchor to first element of previous row - get its actual position and add spacing
                const lastElement = newElements.find(el => (el.code && el.code === lastRowAnchorCode) || (!el.code && el.id === lastRowAnchorCode));
                if (lastElement) {
                  // Calculate actual position accounting for anchors
                  const lastElementPos = calculateElementPosition(lastElement);
                  const lastElementHeight = lastElement.transform?.height || fieldHeight;
                  // Calculate offset: we want new element at margin, so offsetX = margin - actualAnchorX
                  anchorToCode = lastElement.code || lastElement.id;
                  anchorOffset = { x: margin - lastElementPos.x, y: lastElementHeight + fieldSpacing };
                } else {
                  anchorToCode = lastRowAnchorCode;
                  anchorOffset = { x: 0, y: fieldSpacing };
                }
              } else {
                // First element in section - anchor to current chain element with extra spacing for new tab
                const anchorElement = newElements.find(el => (el.code && el.code === currentAnchorCode) || (!el.code && el.id === currentAnchorCode));
                if (anchorElement) {
                  // Calculate actual position accounting for anchors
                  const anchorPos = calculateElementPosition(anchorElement);
                  const anchorHeight = anchorElement.transform?.height || fieldHeight;
                  // Calculate offset: we want new element at margin, so offsetX = margin - actualAnchorX
                  // Add extra spacing for new tab (30px)
                  const tabSpacing = tabIndex > 0 && !tabFirstElementCode ? 30 : fieldSpacing;
                  anchorToCode = anchorElement.code || anchorElement.id;
                  anchorOffset = { x: margin - anchorPos.x, y: anchorHeight + tabSpacing };
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


