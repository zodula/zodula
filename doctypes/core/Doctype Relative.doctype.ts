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
    alias: $f.Text({
        label: "Alias",
        description: "The alias of the reference field. This is used to set the alias of the reference field in the query."
    }),
    type: $f.Select({
        label: "Type",
        options: "Reference\nOne to One\nOne to Many",
        required: 1
    }),
    reference_label: $f.Text({
        label: "Reference Label",
        description: "The label of the reference field. This is used to set the label of the reference field in the query."
    }),
    below_field: $f.Text({
        label: "Below Field",
        description: "The field to place the reference field after."
    })
}, {
    label: "Doctype Relative"
})