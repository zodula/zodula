export default $doctype<"zodula__Letter Head Item">({
    letter_head: {
        type: "Reference",
        label: "Letter Head",
        reference: "zodula__Letter Head",
        reference_alias: "items",
        reference_label: "Items",
        reference_type: "One to Many",
        required: 1
    },
    type: {
        type: "Select",
        label: "Type",
        options: "field\ntext\nimage\nline\nreference\ncustom_html",
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
    idx: {
        type: "Integer",
        label: "Index",
        default: "0",
        in_list_view: 1
    }
}, {
    label: "Letter Head Item",
    search_fields: "type\nvalue",
    display_field: "type"
})
