export default $doctype<"zodula__Print Template Item">({
    type: {
        type: "Select",
        label: "Type",
        options: "field\ntext\nimage\nline\nreference\ncustom_html\nanchor",
        required: 1,
        in_list_view: 1
    },
    value: {
        type: "Text",
        label: "Value",
        description: "Field name for field type, text content for text type, image path for image type, binba template code for custom_html type"
    },
    fields: {
        type: "JSON",
        label: "Child Fields",
        description: "For Reference Table and Extend field types: array of child field names to display"
    },
    reference_doctype: {
        type: "Text",
        label: "Reference Doctype",
        description: "For reference element type: the doctype to fetch from",
        depends_on: "doc.type === 'reference'"
    },
    reference_id_filter: {
        type: "Text",
        label: "Reference ID Filter",
        description: "For reference element type: ID filter expression (e.g., {{session.organization}})",
        depends_on: "doc.type === 'reference'"
    },
    reference_field: {
        type: "Text",
        label: "Reference Field",
        description: "For reference element type: the field to fetch from the referenced doctype",
        depends_on: "doc.type === 'reference'"
    },
    label: {
        type: "Text",
        label: "Label",
        description: "Optional label text for field and reference elements"
    },
    label_position: {
        type: "Select",
        label: "Label Position",
        options: "left\nright\ntop\nbottom",
        default: "left",
        description: "Position of label relative to value for field and reference elements"
    },
    align: {
        type: "Select",
        label: "Horizontal Alignment",
        options: "left\ncenter\nright",
        default: "left"
    },
    vertical_align: {
        type: "Select",
        label: "Vertical Alignment",
        options: "top\nmiddle\nbottom",
        default: "middle"
    },
    style_font_size: {
        type: "Float",
        label: "Font Size (px)",
        description: "Font size in pixels for text/field/reference elements"
    },
    style_font_weight: {
        type: "Text",
        label: "Font Weight",
        description: "CSS font-weight value (e.g., normal, bold, 600)"
    },
    style_font_style: {
        type: "Text",
        label: "Font Style",
        description: "CSS font-style value (e.g., normal, italic)"
    },
    style_text_decoration: {
        type: "Text",
        label: "Text Decoration",
        description: "CSS text-decoration value (e.g., underline, line-through)"
    },
    field_name: {
        type: "Text",
        label: "Field Name",
        description: "For field type: the name of the field to display"
    },
    image: {
        type: "File",
        label: "Image",
        description: "For image type: the image file to display",
        depends_on: "doc.type === 'image'"
    },
    transform_x: {
        type: "Float",
        label: "X Position",
        default: "0"
    },
    transform_y: {
        type: "Float",
        label: "Y Position",
        default: "0"
    },
    transform_width: {
        type: "Float",
        label: "Width",
        default: "200"
    },
    transform_height: {
        type: "Float",
        label: "Height",
        default: "30"
    },
    code: {
        type: "Text",
        label: "Code",
        description: "Stable identifier for anchoring (not auto-generated id)",
        required: 0
    },
    group: {
        type: "Text",
        label: "Group",
        description: "Group ID that this element belongs to (for grouping elements together)",
        required: 0
    },
    table_config: {
        type: "JSON",
        label: "Table Configuration",
        description: "For Reference Table fields: column widths, order, row height, show header, show border"
    },
    anchor_config: {
        type: "JSON",
        label: "Anchor Configuration",
        description: "For anchored elements: anchorTo (element ID), anchorPosition (top-left only), anchorOffset (pixels)"
    },
    columns: {
        type: "Integer",
        label: "Columns",
        description: "Number of columns for group elements (only in fixed position mode)",
        default: "1"
    },
    hide_no_value: {
        type: "Check",
        label: "Hide if No Value",
        description: "Hide element if it has no value (for field, reference, text, and image elements)",
        default: "0"
    }
}, {
    label: "Print Template Item",
    search_fields: "type\nvalue",
    display_field: "type",
    naming_series: "{{code}}",
    is_child_doctype: 1
})
