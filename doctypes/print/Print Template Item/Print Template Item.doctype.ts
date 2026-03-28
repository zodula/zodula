export default $doctype<"Print Template Item">({
  type: {
    type: "Select",
    label: "Type",
    options: "text\nfield\nimage\nline\nreference\ncustom_html\nanchor\nempty",
    required: 1,
    in_list_view: 1,
  },
  value: {
    type: "Text",
    label: "Value",
  },
  code: {
    type: "Text",
    label: "Code",
    description: "Stable code for anchoring.",
  },
  group: {
    type: "Text",
    label: "Group",
    description: "Group ID this element belongs to.",
  },
  field_name: {
    type: "Text",
    label: "Field Name",
  },
  label: {
    type: "Text",
    label: "Label",
  },
  label_position: {
    type: "Select",
    label: "Label Position",
    options: "left\nright\ntop\nbottom",
    default: "left",
  },
  hide_no_value: {
    type: "Check",
    label: "Hide When Empty",
    default: "1",
  },
  align: {
    type: "Select",
    label: "Text align",
    options: "left\ncenter\nright",
    default: "left",
  },
  vertical_align: {
    type: "Select",
    label: "Vertical align",
    options: "top\nmiddle\nbottom",
    default: "middle",
  },
  fields: {
    type: "Text",
    label: "Fields (JSON)",
    description: "Child fields for reference table.",
  },
  columns: {
    type: "Text",
    label: "Columns (JSON)",
    description: "Column field names for reference table. When set, used for table header and cells.",
  },
  nested_field: {
    type: "Text",
    label: "Nested Field",
    description: "Reference field on child rows (e.g. delivery_note). When set, nested rows are rendered below each main row.",
  },
  nested_table_field: {
    type: "Text",
    label: "Nested Table Field",
    description: "Field name on the nested doctype that holds the child table (e.g. items). When empty, auto-detected from schema.",
  },
  nested_table_field_doctype: {
    type: "Text",
    label: "Nested Table Field Doctype",
    description: "Doctype of the nested table (e.g. Delivery Note Item). Use when schema cannot be loaded, to override auto-detection.",
  },
  nested_columns: {
    type: "Text",
    label: "Nested Columns (JSON)",
    description: "Column field names from the nested doctype's child table (e.g. delivery_note_items). Rendered to the right of main columns.",
  },
  height: {
    type: "Integer",
    label: "Min height (px)",
    description: "Minimum height in pixels for this reference table in PDF/print.",
  },
  table_config: {
    type: "Text",
    label: "Table Config (JSON)",
  },
  anchor_config: {
    type: "Text",
    label: "Anchor Config (JSON)",
  },
  transform_x: {
    type: "Float",
    label: "X",
    default: "0",
  },
  transform_y: {
    type: "Float",
    label: "Y",
    default: "0",
  },
  transform_width: {
    type: "Float",
    label: "Width",
    default: "200",
  },
  transform_height: {
    type: "Float",
    label: "Height",
    default: "30",
  },
  style_font_size: {
    type: "Integer",
    label: "Font Size",
  },
  style_font_weight: {
    type: "Text",
    label: "Font Weight",
  },
  style_font_style: {
    type: "Text",
    label: "Font Style",
  },
  style_text_decoration: {
    type: "Text",
    label: "Text Decoration",
  },
  style_color: {
    type: "Text",
    label: "Color",
  },
  style_background_color: {
    type: "Text",
    label: "Background Color",
  },
  style_border: {
    type: "Text",
    label: "Border",
  },
  style_padding: {
    type: "Text",
    label: "Padding",
  },
  style_margin: {
    type: "Text",
    label: "Margin",
  },
  image: {
    type: "Text",
    label: "Image",
  },
  reference_doctype: {
    type: "Text",
    label: "Reference Doctype",
  },
  reference_id_filter: {
    type: "Text",
    label: "Reference ID Filter",
  },
  reference_field: {
    type: "Text",
    label: "Reference Field",
  },
}, {
  label: "Print Template Item",
  is_child_doctype: 1,
  is_quick_entry: 1,
  search_fields: "parentid\ntype\nfield_name",
  tabs: JSON.stringify([
    {
      type: "Tab",
      label: "Main",
      layout: [
        { type: "section", value: "Link", align: "left" },
        [
          { type: "field", value: "parentid", align: "left" },
          { type: "field", value: "idx", align: "left" },
          { type: "field", value: "type", align: "left" },
          { type: "field", value: "value", align: "left" },
        ],
        { type: "section", value: "Layout", align: "left" },
        [
          { type: "field", value: "transform_x", align: "left" },
          { type: "field", value: "transform_y", align: "left" },
          { type: "field", value: "transform_width", align: "left" },
          { type: "field", value: "transform_height", align: "left" },
          { type: "field", value: "code", align: "left" },
          { type: "field", value: "group", align: "left" },
        ],
        { type: "section", value: "Field / Reference", align: "left" },
        [
          { type: "field", value: "field_name", align: "left" },
          { type: "field", value: "label", align: "left" },
          { type: "field", value: "label_position", align: "left" },
          { type: "field", value: "hide_no_value", align: "left" },
          { type: "field", value: "columns", align: "left" },
          { type: "field", value: "nested_field", align: "left" },
          { type: "field", value: "nested_table_field", align: "left" },
          { type: "field", value: "nested_table_field_doctype", align: "left" },
          { type: "field", value: "nested_columns", align: "left" },
          { type: "field", value: "height", align: "left" },
          { type: "field", value: "reference_doctype", align: "left" },
          { type: "field", value: "reference_id_filter", align: "left" },
          { type: "field", value: "reference_field", align: "left" },
        ],
      ],
    },
  ]),
})
