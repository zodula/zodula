export default $doctype({
    parent_doctype: {
        type: "Virtual Reference",
        label: "Parent Doctype",
        reference: "Doctype",
        required: 1
    },
    child_doctype: {
        type: "Virtual Reference",
        label: "Child Doctype",
        reference: "Doctype",
        required: 1
    },
    parent_field_name: {
        type: "Virtual Reference",
        label: "Parent Field Name",
        reference: "Field",
        required: 1
    },
    type: {
        type: "Select",
        label: "Type",
        options: "Reference Table\nExtend",
        required: 1
    },
}, {
    label: "Doctype Children",
    is_global: 1,
})
