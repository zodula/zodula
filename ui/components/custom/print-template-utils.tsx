import type { PrintTemplateElement } from "./print-template-builder";

// Convert PrintTemplateElement to Print Template Item payload
export function elementToItemPayload(
  element: PrintTemplateElement,
  printTemplateId: string,
  idx: number
): Zodula.InsertDoctype<"Print Template Item"> {
  const payload: Zodula.InsertDoctype<"Print Template Item"> = {
    // Note: print_template field removed - parentid, parenttype, parentfield will be auto-populated
    type: element.type,
    value: typeof element.value === "string" ? element.value : "",
    align: element.align || "left",
    vertical_align: element.verticalAlign || "middle",
    transform_x: element.transform?.x || 0,
    transform_y: element.transform?.y || 0,
    transform_width: element.transform?.width || 200,
    transform_height: element.transform?.height || 30,
    idx: element.idx !== undefined ? element.idx : idx, // Use element.idx if present, otherwise use passed idx
  };
  
  // Style fields (font size/weight/style/decoration)
  if (element.style?.fontSize !== undefined) {
    (payload as any).style_font_size = element.style.fontSize;
  }
  if (element.style?.fontWeight !== undefined) {
    (payload as any).style_font_weight = element.style.fontWeight;
  }
  if (element.style?.fontStyle !== undefined) {
    (payload as any).style_font_style = element.style.fontStyle;
  }
  if (element.style?.textDecoration !== undefined) {
    (payload as any).style_text_decoration = element.style.textDecoration;
  }
  
  // Set field-specific values
  if (element.type === "field") {
    payload.field_name = typeof element.value === "string" ? element.value : "";
    if (element.fields && Array.isArray(element.fields)) {
      payload.fields = JSON.stringify(element.fields);
    }
    // Add table configuration for Reference Table fields
    if (element.tableConfig) {
      payload.table_config = JSON.stringify(element.tableConfig);
    }
  } else if (element.type === "image") {
    // For image type, pass File object directly - the save process will handle upload
    payload.image = element.value as any; // File or string
  } else if (element.type === "reference") {
    payload.reference_doctype = element.referenceDoctype || "";
    payload.reference_id_filter = element.referenceIdFilter || "";
    payload.reference_field = element.referenceField || "";
  }
  
  // Add label and label position for field and reference elements
  if (element.type === "field" || element.type === "reference") {
    payload.label = element.label || "";
    payload.label_position = element.labelPosition || "left";
  }
  
  // Add anchor configuration - always save if anchorTo is explicitly set (including null)
  if (element.anchorTo !== undefined || element.anchorPosition !== undefined || element.anchorOffset !== undefined) {
    (payload as any).anchor_config = JSON.stringify({
      anchorTo: element.anchorTo ?? null,
      anchorPosition: element.anchorPosition ?? null,
      anchorOffset: element.anchorOffset ?? null
    });
  }
  
  // Add code field if present
  if (element.code) {
    (payload as any).code = element.code;
  }
  
  // Add group field if present (for group children)
  if (element.group) {
    (payload as any).group = element.group;
  }
  
  // Add columns for fixed position mode (group elements)
  if (element.columns !== undefined) {
    (payload as any).columns = element.columns;
  }
  
  // Add hide_no_value field
  if (element.hideNoValue !== undefined) {
    (payload as any).hide_no_value = element.hideNoValue === true ? 1 : 0;
  }
  
  return payload;
}

// Convert Letter Head Item payload (same structure as Print Template Item)
export function elementToLetterHeadItemPayload(
  element: PrintTemplateElement,
  letterHeadId: string,
  idx: number
): Zodula.InsertDoctype<"Letter Head Item"> {
  const payload: Zodula.InsertDoctype<"Letter Head Item"> = {
    letter_head: letterHeadId,
    type: element.type as any,
    value: typeof element.value === "string" ? element.value : "",
    align: element.align || "left",
    vertical_align: element.verticalAlign || "middle",
    transform_x: element.transform?.x || 0,
    transform_y: element.transform?.y || 0,
    transform_width: element.transform?.width || 200,
    transform_height: element.transform?.height || 30,
    idx: idx,
  };
  
  // Style fields (font size/weight/style/decoration)
  if (element.style?.fontSize !== undefined) {
    (payload as any).style_font_size = element.style.fontSize;
  }
  if (element.style?.fontWeight !== undefined) {
    (payload as any).style_font_weight = element.style.fontWeight;
  }
  if (element.style?.fontStyle !== undefined) {
    (payload as any).style_font_style = element.style.fontStyle;
  }
  if (element.style?.textDecoration !== undefined) {
    (payload as any).style_text_decoration = element.style.textDecoration;
  }
  
  // Set field-specific values
  if (element.type === "field") {
    payload.field_name = typeof element.value === "string" ? element.value : "";
    if (element.fields && Array.isArray(element.fields)) {
      payload.fields = JSON.stringify(element.fields);
    }
    // Add table configuration for Reference Table fields
    if (element.tableConfig) {
      payload.table_config = JSON.stringify(element.tableConfig);
    }
  } else if (element.type === "image") {
    // For image type, pass File object directly - the save process will handle upload
    payload.image = element.value as any; // File or string
  } else if (element.type === "reference") {
    payload.reference_doctype = element.referenceDoctype || "";
    payload.reference_id_filter = element.referenceIdFilter || "";
    payload.reference_field = element.referenceField || "";
  }
  
  // Add label and label position for field and reference elements
  if (element.type === "field" || element.type === "reference") {
    payload.label = element.label || "";
    payload.label_position = element.labelPosition || "left";
  }
  
  // Add anchor configuration - always save if anchorTo is explicitly set (including null)
  if (element.anchorTo !== undefined || element.anchorPosition !== undefined || element.anchorOffset !== undefined) {
    (payload as any).anchor_config = JSON.stringify({
      anchorTo: element.anchorTo ?? null,
      anchorPosition: element.anchorPosition ?? null,
      anchorOffset: element.anchorOffset ?? null
    });
  }
  
  // Add code field if present
  if (element.code) {
    (payload as any).code = element.code;
  }
  
  // Add group field if present (for group children)
  if (element.group) {
    (payload as any).group = element.group;
  }
  
  // Add columns for fixed position mode (group elements)
  if (element.columns !== undefined) {
    (payload as any).columns = element.columns;
  }
  
  // Add hide_no_value field
  if (element.hideNoValue !== undefined) {
    (payload as any).hide_no_value = element.hideNoValue === true ? 1 : 0;
  }
  
  return payload;
}

// Convert Print Template Item to PrintTemplateElement
export function itemToElement(
  item: Zodula.SelectDoctype<"Print Template Item">
): PrintTemplateElement {
  // For image type, use image field; for field type, use field_name; otherwise use value
  let value: string | File = item.value || "";
  if (item.type === "image" && item.image) {
    value = item.image as any; // Can be File or string
  } else if (item.type === "field" && item.field_name) {
    value = item.field_name;
  }
  
  const element: PrintTemplateElement = {
    id: item.id,
    type: item.type as any,
    value: value as string | File,
    align: (item.align as any) || "left",
    verticalAlign: (item.vertical_align as any) || "middle",
    transform: {
      x: item.transform_x || 0,
      y: item.transform_y || 0,
      width: item.transform_width || 200,
      height: (() => {
        const h = item.transform_height || 30;
        return h;
      })(),
    },
    style: {},
  };
  
  // Populate style from stored fields (support both snake_case and camelCase from API)
  const styleFontSize = (item as any).style_font_size ?? (item as any).styleFontSize;
  if (styleFontSize !== undefined && styleFontSize !== null) {
    element.style = { ...(element.style || {}), fontSize: Number(styleFontSize) || styleFontSize };
  }
  const styleFontWeight = (item as any).style_font_weight ?? (item as any).styleFontWeight;
  if (styleFontWeight !== undefined) {
    element.style = { ...(element.style || {}), fontWeight: styleFontWeight };
  }
  const styleFontStyle = (item as any).style_font_style ?? (item as any).styleFontStyle;
  if (styleFontStyle !== undefined) {
    element.style = { ...(element.style || {}), fontStyle: styleFontStyle };
  }
  const styleTextDecoration = (item as any).style_text_decoration ?? (item as any).styleTextDecoration;
  if (styleTextDecoration !== undefined) {
    element.style = { ...(element.style || {}), textDecoration: styleTextDecoration };
  }
  if (element.style && Object.keys(element.style).length === 0) {
    delete (element as any).style;
  }

  // Parse fields for Reference Table/Extend types
  if (item.fields && typeof item.fields === "string") {
    try {
      element.fields = JSON.parse(item.fields);
    } catch (e) {
      element.fields = [];
    }
  } else if (Array.isArray(item.fields)) {
    element.fields = item.fields;
  }

  // Parse table config for Reference Table fields (support both snake_case and camelCase)
  const rawTableConfig = (item as any).table_config ?? (item as any).tableConfig;
  if (rawTableConfig !== undefined && rawTableConfig !== null) {
    if (typeof rawTableConfig === "string") {
      try {
        element.tableConfig = JSON.parse(rawTableConfig);
      } catch (e) {
        // Ignore parse errors
      }
    } else if (typeof rawTableConfig === "object") {
      element.tableConfig = rawTableConfig as any;
    }
  }
  
  // Add reference element properties
  if (item.type === "reference") {
    element.referenceDoctype = item.reference_doctype || "";
    element.referenceIdFilter = item.reference_id_filter || "";
    element.referenceField = item.reference_field || "";
  }
  
  // Add label and label position for field and reference elements
  if (item.type === "field" || item.type === "reference") {
    element.label = item.label || "";
    element.labelPosition = (item.label_position as any) || "left";
  }
  
  // Parse anchor config
  const anchorConfig = (item as any).anchor_config;
  if (anchorConfig) {
    if (typeof anchorConfig === "string") {
      try {
        const parsed = JSON.parse(anchorConfig);
        element.anchorTo = parsed.anchorTo;
        element.anchorPosition = parsed.anchorPosition;
        element.anchorOffset = parsed.anchorOffset;
      } catch (e) {
        // Ignore parse errors
      }
    } else if (typeof anchorConfig === "object") {
      element.anchorTo = anchorConfig.anchorTo;
      element.anchorPosition = anchorConfig.anchorPosition;
      element.anchorOffset = anchorConfig.anchorOffset;
    }
  }
  
  // Add code field if present
  if ((item as any).code) {
    element.code = (item as any).code;
  }
  
  // Add group field if present (for group children)
  if ((item as any).group) {
    element.group = (item as any).group;
  }
  
  // Add idx and columns for fixed position mode
  if ((item as any).idx !== undefined) {
    element.idx = (item as any).idx;
  }
  if ((item as any).columns !== undefined) {
    element.columns = (item as any).columns;
  }
  
  // Add hide_no_value field
  if ((item as any).hide_no_value !== undefined) {
    element.hideNoValue = (item as any).hide_no_value === 1 || (item as any).hide_no_value === true;
  }
  
  return element;
}

// Convert Letter Head Item to PrintTemplateElement (same structure as Print Template Item)
export function letterHeadItemToElement(
  item: Zodula.SelectDoctype<"Letter Head Item">
): PrintTemplateElement {
  // For image type, use image field; for field type, use field_name; otherwise use value
  let value: string | File = item.value || "";
  if (item.type === "image" && item.image) {
    value = item.image as any; // Can be File or string
  } else if (item.type === "field" && item.field_name) {
    value = item.field_name;
  }
  
  const element: PrintTemplateElement = {
    id: item.id,
    type: item.type as any,
    value: value as string | File,
    align: (item.align as any) || "left",
    verticalAlign: (item.vertical_align as any) || "middle",
    transform: {
      x: item.transform_x || 0,
      y: item.transform_y || 0,
      width: item.transform_width || 200,
      height: (() => {
        const h = item.transform_height || 30;
        return h;
      })(),
    },
    style: {},
  };
  
  // Populate style from stored fields
  if ((item as any).style_font_size !== undefined) {
    element.style = { ...(element.style || {}), fontSize: (item as any).style_font_size as any };
  }
  if ((item as any).style_font_weight !== undefined) {
    element.style = { ...(element.style || {}), fontWeight: (item as any).style_font_weight };
  }
  if ((item as any).style_font_style !== undefined) {
    element.style = { ...(element.style || {}), fontStyle: (item as any).style_font_style };
  }
  if ((item as any).style_text_decoration !== undefined) {
    element.style = { ...(element.style || {}), textDecoration: (item as any).style_text_decoration };
  }
  if (element.style && Object.keys(element.style).length === 0) {
    delete (element as any).style;
  }
  
  // Parse fields for Reference Table/Extend types
  if (item.fields && typeof item.fields === "string") {
    try {
      element.fields = JSON.parse(item.fields);
    } catch (e) {
      element.fields = [];
    }
  } else if (Array.isArray(item.fields)) {
    element.fields = item.fields;
  }
  
  // Parse table config for Reference Table fields
  if ((item as any).table_config) {
    const tableConfig = (item as any).table_config;
    if (typeof tableConfig === "string") {
      try {
        element.tableConfig = JSON.parse(tableConfig);
      } catch (e) {
        // Ignore parse errors
      }
    } else if (typeof tableConfig === "object") {
      element.tableConfig = tableConfig as any;
    }
  }
  
  // Add reference element properties
  if (item.type === "reference") {
    element.referenceDoctype = item.reference_doctype || "";
    element.referenceIdFilter = item.reference_id_filter || "";
    element.referenceField = item.reference_field || "";
  }
  
  // Add label and label position for field and reference elements
  if (item.type === "field" || item.type === "reference") {
    element.label = item.label || "";
    element.labelPosition = (item.label_position as any) || "left";
  }
  
  // Parse anchor config
  const anchorConfig = (item as any).anchor_config;
  if (anchorConfig) {
    if (typeof anchorConfig === "string") {
      try {
        const parsed = JSON.parse(anchorConfig);
        element.anchorTo = parsed.anchorTo;
        element.anchorPosition = parsed.anchorPosition;
        element.anchorOffset = parsed.anchorOffset;
      } catch (e) {
        // Ignore parse errors
      }
    } else if (typeof anchorConfig === "object") {
      element.anchorTo = anchorConfig.anchorTo;
      element.anchorPosition = anchorConfig.anchorPosition;
      element.anchorOffset = anchorConfig.anchorOffset;
    }
  }
  
  // Add code field if present
  if ((item as any).code) {
    element.code = (item as any).code;
  }
  
  // Add group field if present (for group children)
  if ((item as any).group) {
    element.group = (item as any).group;
  }
  
  // Add hide_no_value field
  if ((item as any).hide_no_value !== undefined) {
    element.hideNoValue = (item as any).hide_no_value === 1 || (item as any).hide_no_value === true;
  }
  
  return element;
}

