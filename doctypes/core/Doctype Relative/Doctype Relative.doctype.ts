export default $doctype({
    parent_doctype: $f.VirtualReference({
        label: "Parent Doctype",
        reference: "zodula__Doctype",
        required: 1
    }),
    child_doctype: $f.VirtualReference({
        label: "Child Doctype",
        reference: "zodula__Doctype",
        required: 1
    }),
    child_field_name: $f.VirtualReference({
        label: "Child Field Name",
        reference: "zodula__Field",
        required: 1
    }),
    parent_field_name: $f.VirtualReference({
        label: "Parent Field Name",
        reference: "zodula__Field",
    }),
}, {
    label: "Doctype Relative",
    is_global: 1,
})