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
    child_field_name: {
        type: "Virtual Reference",
        label: "Child Field Name",
        reference: "Field",
        required: 1
    },
}, {
    label: "Doctype Relative",
    is_global: 1,
})
