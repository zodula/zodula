// Page format dimensions in mm
export const PAGE_FORMATS: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
  "210x30mm": { width: 210, height: 30 },
  "30x30mm": { width: 30, height: 30 },
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
  // Hide if no value (for field and reference elements)
  hideNoValue?: boolean; // Hide element if it has no value
  // Index for fixed position mode (determines order)
  idx?: number; // Order index for fixed position layout
  // Columns for group elements in fixed position mode
  columns?: number; // Number of columns for group elements (only in fixed position mode)
}

// Field configuration interface
export interface FieldConfig {
  name: string;
  label?: string;
  type: string;
  reference?: string;
  no_print?: boolean | number; // If true or 1, field should not be included in print template
  in_list_view?: boolean | number; // If true or 1, field should be included in default print template
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

// Generate print template elements from doctype tabs (for fixed position templates only)

// Generate print template elements from doctype tabs (for fixed position templates)
export async function generateFixedPositionTemplateFromTabs(options: {
  tabs?: Tab[];
  fields: FieldConfig[];
  pageDimensions: { width: number; height: number }; // in mm
  doctypeLabel: string;
  fetchChildFields: (referenceDoctype: string, parentDoctype?: string) => Promise<ChildField[]>;
  doctype: string;
}): Promise<PrintTemplateElement[]> {
  const { tabs, fields, pageDimensions, doctypeLabel, fetchChildFields } = options;

  if (!fields || fields.length === 0) {
    return [];
  }

  const newElements: PrintTemplateElement[] = [];
  const pageWidth = pageDimensions.width; // in mm, convert to px (1mm ≈ 3.78px)
  const pageWidthPx = pageWidth * 3.78;
  // Margins are handled in UI layer, so no margin offset needed
  const fieldHeight = 50; // Minimum 50px height for field elements
  const gapBetweenFields = 10; // Gap between fields in a row

  // Track idx for ordering elements - start with 0 for header
  let currentIdx = 0;

  // Use a base timestamp to ensure consistent ID generation
  const baseTimestamp = Date.now();
  let elementCounter = 0;

  // Add header with doctype name - idx 0
  const headerId = `element_${baseTimestamp}_${elementCounter++}_header`;
  const headerCode = generateCode("header");

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
      x: 0,
      y: 0,
      width: pageWidthPx,
      height: 40,
    },
    idx: currentIdx++, // idx = 0
  });

  // Add docid field - idx 1
  const docidId = `element_${baseTimestamp}_${elementCounter++}_docid`;
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
    hideNoValue: true,
    transform: {
      x: 0,
      y: 0,
      width: pageWidthPx,
      height: 20,
    },
    idx: currentIdx++, // idx = 1
  });

  // If tabs not provided, display all fields without no_print in single column
  if (!tabs || tabs.length === 0) {
    const printableFields = fields.filter(
      (f) => !(f.no_print === true || f.no_print === 1)
    );
    for (const fieldConfig of printableFields) {
      const fieldName = fieldConfig.name;
      if (fieldConfig.type === "Reference Table" && fieldConfig.reference && fieldConfig.reference !== options.doctype) {
        const childFields = await fetchChildFields(fieldConfig.reference, options.doctype);
        const printableChildFields = childFields.filter(
          (col) => !(col.no_print === 1 || col.no_print === true)
        );
        const defaultSelectedFields = printableChildFields
          .filter((col) => col.in_list_view === true)
          .map((col) => col.field);
        const selectedFieldNames =
          defaultSelectedFields.length > 0
            ? defaultSelectedFields
            : printableChildFields.map((col) => col.field);
        const selectedColumns = printableChildFields
          .filter((col) => selectedFieldNames.includes(col.field))
          .map((col, idx) => ({ field: col.field, label: col.label, order: idx }));
        const tableElementId = `element_${baseTimestamp}_${elementCounter++}_${fieldName}`;
        const tableCode = generateCode("table");
        newElements.push({
          id: tableElementId,
          code: tableCode,
          type: "field",
          value: fieldName,
          align: "left",
          verticalAlign: "top",
          label: fieldConfig.label || fieldName,
          labelPosition: "top",
          hideNoValue: true,
          fields: selectedFieldNames,
          transform: {
            x: 0,
            y: 0,
            width: pageWidthPx,
            height: 60,
          },
          tableConfig: {
            showHeader: true,
            showBorder: true,
            rowHeight: 20,
            columns: selectedColumns,
            hideNoValue: false,
          },
          idx: currentIdx++,
        });
      } else {
        const fieldElementId = `element_${baseTimestamp}_${elementCounter++}_${fieldName}`;
        const fieldCode = generateCode();
        newElements.push({
          id: fieldElementId,
          code: fieldCode,
          type: "field",
          value: fieldName,
          align: "left",
          verticalAlign: "middle",
          label: fieldConfig.label || fieldName,
          labelPosition: "top",
          hideNoValue: true,
          transform: {
            x: 0,
            y: 0,
            width: pageWidthPx,
            height: fieldHeight,
          },
          idx: currentIdx++,
        });
      }
    }
    return newElements;
  }


  // Process each tab
  for (const tab of tabs) {
    if (tab.type !== "Tab" || !tab.layout) continue;
    
    // Process layout items
    const processLayoutItem = async (item: TabLayoutItem | TabLayoutItem[]) => {
      if (Array.isArray(item)) {
        // Process array of fields (row) - create a group for this row
        const visibleFields: Array<{ fieldItem: TabLayoutItem; fieldConfig: FieldConfig }> = [];
        for (const fieldItem of item) {
          if (fieldItem.type === "field" && fieldItem.value) {
            const fieldName = fieldItem.value;
            const fieldConfig = fields.find(f => f.name === fieldName);
            if (fieldConfig && !(fieldConfig.no_print === true || fieldConfig.no_print === 1)) {
              visibleFields.push({ fieldItem, fieldConfig });
            }
          }
        }
        
        if (visibleFields.length === 0) {
          return;
        }
        
        // Create group for this row
        const rowGroupId = `group_${baseTimestamp}_${elementCounter++}_${Math.random().toString(36).substr(2, 9)}`;
        const rowGroupCode = generateCode("rowgroup");
        
        // Calculate columns based on visible fields count
        const columns = Math.min(visibleFields.length, 3); // Default to max 3 columns
        
        // Store fields to add to group
        const rowFields: PrintTemplateElement[] = [];
        let childIdx = 0;
        
        for (const { fieldItem, fieldConfig } of visibleFields) {
          if (fieldItem.type === "field" && fieldItem.value) {
            const fieldName = fieldItem.value;
            
            if (fieldConfig) {
              // Check if it's a Reference Table
              if (fieldConfig.type === "Reference Table" && fieldConfig.reference && fieldConfig.reference !== options.doctype) {
                const childFields = await fetchChildFields(fieldConfig.reference, options.doctype);
                
                const printableChildFields = childFields.filter(
                  col => {
                    if (col.no_print === 1 || col.no_print === true) {
                      return false;
                    }
                    return true;
                  }
                );
                
                const defaultSelectedFields = printableChildFields
                  .filter(col => col.in_list_view === true)
                  .map(col => col.field);
                
                const selectedFieldNames = defaultSelectedFields.length > 0 
                  ? defaultSelectedFields 
                  : printableChildFields.map(col => col.field);
                
                const selectedColumns = printableChildFields
                  .filter(col => selectedFieldNames.includes(col.field))
                  .map((col, idx) => ({ field: col.field, label: col.label, order: idx }));
                
                const tableElementId = `element_${baseTimestamp}_${elementCounter++}_${fieldName}`;
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
                  hideNoValue: true,
                  fields: selectedFieldNames,
                  group: rowGroupId,
                  transform: {
                    x: 0,
                    y: 0,
                    width: pageWidthPx,
                    height: 60,
                  },
                  tableConfig: {
                    showHeader: true,
                    showBorder: true,
                    rowHeight: 20,
                    columns: selectedColumns,
                    hideNoValue: false,
                  },
                  idx: childIdx++,
                };
                
                rowFields.push(tableElement);
              } else {
                // Regular field
                const fieldElementId = `element_${baseTimestamp}_${elementCounter++}_${fieldName}`;
                const fieldCode = generateCode();
                
                const fieldElement: PrintTemplateElement = {
                  id: fieldElementId,
                  code: fieldCode,
                  type: "field",
                  value: fieldName,
                  align: (fieldItem.align as any) || "left",
                  verticalAlign: "middle",
                  label: fieldConfig.label || fieldName,
                  labelPosition: "top",
                  hideNoValue: true,
                  group: rowGroupId,
                  transform: {
                    x: 0,
                    y: 0,
                    width: 200,
                    height: fieldHeight,
                  },
                  idx: childIdx++,
                };
                
                rowFields.push(fieldElement);
              }
            }
          }
        }
        
        // Create the group element
        const rowGroupElement: PrintTemplateElement = {
          id: rowGroupId,
          code: rowGroupCode,
          type: "anchor",
          value: "",
          align: "left",
          verticalAlign: "top",
          transform: {
            x: 0,
            y: 0,
            width: pageWidthPx,
            height: fieldHeight,
          },
          columns: columns,
          idx: currentIdx++,
        };
        
        // Add group first
        newElements.push(rowGroupElement);
        
        // Add all fields to the group
        for (const field of rowFields) {
          newElements.push(field);
        }
      } else if (item.type === "field" && item.value) {
        const fieldName = item.value;
        const fieldConfig = fields.find(f => f.name === fieldName);
        
        if (fieldConfig && (fieldConfig.no_print === true || fieldConfig.no_print === 1)) {
          return;
        }
        
        if (fieldConfig) {
          if (fieldConfig.type === "Reference Table" && fieldConfig.reference) {
            const childFields = await fetchChildFields(fieldConfig.reference, options.doctype);
            
            const printableChildFields = childFields.filter(
              col => {
                if (col.no_print === 1 || col.no_print === true) {
                  return false;
                }
                return true;
              }
            );
            
            const defaultSelectedFields = printableChildFields
              .filter(col => col.in_list_view === true)
              .map(col => col.field);
            const selectedFieldNames = defaultSelectedFields.length > 0 
              ? defaultSelectedFields 
              : printableChildFields.map(col => col.field);
            const selectedColumns = printableChildFields
              .filter(col => selectedFieldNames.includes(col.field))
              .map((col, idx) => ({ field: col.field, label: col.label, order: idx }));
            const tableElementId = `element_${baseTimestamp}_${elementCounter++}_${fieldName}`;
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
              hideNoValue: true,
              fields: selectedFieldNames,
              transform: {
                x: 0,
                y: 0,
                width: pageWidthPx,
                height: 60,
              },
              tableConfig: {
                showHeader: true,
                showBorder: true,
                rowHeight: 20,
                columns: selectedColumns,
                hideNoValue: false,
              },
              idx: currentIdx++,
            };
            
            newElements.push(tableElement);
          } else {
            // Regular standalone field
            const fieldElementId = `element_${baseTimestamp}_${elementCounter++}_${fieldName}`;
            const fieldCode = generateCode();
            
            newElements.push({
              id: fieldElementId,
              code: fieldCode,
              type: "field",
              value: fieldName,
              align: (item.align as any) || "left",
              verticalAlign: "middle",
              label: fieldConfig.label || fieldName,
              labelPosition: "top",
              hideNoValue: true,
              transform: {
                x: 0,
                y: 0,
                width: pageWidthPx,
                height: fieldHeight,
              },
              idx: currentIdx++,
            });
          }
        }
      }
    };
    
    // Process all layout items
    for (const item of tab.layout) {
      await processLayoutItem(item);
    }
  }
  
  return newElements;
}


