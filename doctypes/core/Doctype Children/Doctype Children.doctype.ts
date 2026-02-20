export default $doctype({
    parent_doctype: $f.VirtualReference({
        label: "Parent Doctype",
        reference: "Doctype",
        required: 1
    }),
    child_doctype: $f.VirtualReference({
        label: "Child Doctype",
        reference: "Doctype",
        required: 1
    }),
    parent_field_name: $f.VirtualReference({
        label: "Parent Field Name",
        reference: "Field",
        required: 1
    }),
    type: $f.Select({
        label: "Type",
        options: "Reference Table\nExtend",
        required: 1
    }),
}, {
    label: "Doctype Children",
    is_global: 1,
})

