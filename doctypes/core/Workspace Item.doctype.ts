export default $doctype({
    type: $f.Select({
        label: "Type",
        options: "Link - Doctype\nLink - URL\nText\nHTML\nHeader",
        in_list_view: 1
    }),
    label: $f.Text({
        label: "Label",
        in_list_view: 1
    }),
    value: $f.Text({
        label: "Value",
        in_list_view: 1
    }),
    options: $f.Text({
        label: "Options",
        in_list_view: 1
    }),
    workspaceId: {
        type: "Reference",
        label: "Workspace",
        reference: "zodula__Workspace",
        reference_type: "One to Many",
        reference_label: "Workspace Items",
        reference_alias: "workspace_items",
        below_field: "name",
        on_delete: "CASCADE",   
        required: 1,
        in_list_view: 1,
    },
}, {
    label: "Workspace Item"
});