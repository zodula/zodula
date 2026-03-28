/** One item on the canvas (matches backend Print Template Item shape) */
export interface PrintTemplateBuilderItem {
  id: string;
  idx: number;
  type: "text" | "field" | "image" | "line" | "reference" | "custom_html" | "anchor" | "empty";
  value?: string | null;
  code?: string | null;
  group?: string | null;
  field_name?: string | null;
  label?: string | null;
  label_position?: string | null;
  align?: string | null;
  vertical_align?: string | null;
  hide_no_value?: number | boolean | null;
  fields?: string | null; // JSON string for table columns (legacy)
  columns?: string | null; // JSON array of column field names for reference table
  nested_field?: string | null; // Reference field on child rows (e.g. delivery_note)
  nested_table_field?: string | null; // Field on nested doctype holding the child table (e.g. items)
  nested_table_field_doctype?: string | null; // Doctype of nested table (override when schema cannot be loaded)
  nested_columns?: string | null; // JSON array of nested table column field names
  height?: number | null; // Min height (px) for reference table in print
  table_config?: string | null; // JSON
  anchor_config?: string | null; // JSON
  transform_x?: number | null;
  transform_y?: number | null;
  transform_width?: number | null;
  transform_height?: number | null;
  style_font_size?: number | null;
  style_font_weight?: string | null;
  style_font_style?: string | null;
  style_text_decoration?: string | null;
  image?: string | null;
  reference_doctype?: string | null;
  reference_id_filter?: string | null;
  reference_field?: string | null;
}

/** Palette entry: draggable from sidebar */
export interface PaletteEntry {
  type: "field" | "anchor" | "text" | "custom_html" | "empty";
  field_name?: string;
  label: string;
  isTable?: boolean;
  reference?: string; // child doctype for tables
}
