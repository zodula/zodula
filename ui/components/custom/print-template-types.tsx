import { Hash, Type, Image, Minus, Grid3x3, LayoutGrid } from "lucide-react";

export interface PrintTemplateElement {
  id: string;
  type: "field" | "text" | "image" | "line" | "reference" | "custom_html" | "container";
  value?: string | File;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fields?: string[]; // For Reference Table and Extend: child fields to display
  // For reference element type
  referenceDoctype?: string; // Doctype to fetch from (e.g., "zodula__Organization")
  referenceIdFilter?: string; // ID filter expression (e.g., "{{session.organization}}")
  referenceField?: string; // Field to fetch (e.g., "name")
  // Label support for field and reference
  label?: string; // Label text to display
  labelPosition?: "left" | "right" | "top" | "bottom"; // Position of label relative to value
  // Anchor support - element can be anchored to another element
  anchorTo?: string; // ID of element to anchor to
  anchorPosition?: "top" | "bottom" | "left" | "right" | "inside"; // Position relative to anchored element
  anchorOffset?: number | { x: number; y: number }; // Offset in pixels from anchor position (number for top/bottom/left/right, {x, y} for inside)
  // Table configuration for Reference Table fields
  tableConfig?: {
    columns?: Array<{
      field: string;
      width?: number; // Column width in pixels or percentage
      order?: number; // Display order
    }>;
    rowHeight?: number; // Row height in pixels
    showHeader?: boolean; // Show/hide table header
    showBorder?: boolean; // Show/hide table borders
  };
  style?: {
    fontSize?: number;
    fontWeight?: string;
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

export interface PrintTemplateBuilderProps {
  layout: PrintTemplateElement[];
  onChange: (layout: PrintTemplateElement[]) => void;
  doctype?: string;
  fields?: Zodula.Field[];
  readonly?: boolean;
  onPreview?: () => void;
  format?: "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid" | "Custom";
  customWidth?: number; // in mm
  customHeight?: number; // in mm
}

export const TOOLS = [
  { type: "field", icon: Hash, label: "Field" },
  { type: "text", icon: Type, label: "Text" },
  { type: "image", icon: Image, label: "Image" },
  { type: "line", icon: Minus, label: "Line" },
  { type: "reference", icon: Hash, label: "Reference" },
  { type: "custom_html", icon: LayoutGrid, label: "Custom HTML" },
  { type: "container", icon: Grid3x3, label: "Container" },
] as const;

// Page format dimensions in mm
export const PAGE_FORMATS: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
};

