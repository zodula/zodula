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
    child_field_name: $f.VirtualReference({
        label: "Child Field Name",
        reference: "Field",
        required: 1
    }),
}, {
    label: "Doctype Relative",
    is_global: 1,
})