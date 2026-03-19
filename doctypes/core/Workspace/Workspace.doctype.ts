export default $doctype<"Workspace">({
    name: {
        type: "Data",
        label: "Name",
        required: 1
    },
    workspace_parent: {
        type: "Reference",
        label: "Workspace Parent",
        reference: "Workspace"
    },
    icon: {
        type: "Text",
        label: "Icon"
    },
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        required: 1
    },
    is_system: {
        type: "Check",
        label: "Is System",
        default: "0"
    },
    workspace_items: {
        type: "Reference Table",
        label: "Workspace Items",
        reference: "Workspace Item",
        required: 0
    }
}, {
    label: "Workspace",
    display_field: "name",
    search_fields: "name",
})
