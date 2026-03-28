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
    url: {
        type: "Text",
        label: "URL"
    },
    is_system: {
        type: "Check",
        label: "Is System",
        default: "0"
    },
    workspace_roles: {
        type: "Reference Table",
        label: "Workspace Roles",
        reference: "Workspace Role",
        required: 0,
    }
}, {
    label: "Workspace",
    display_field: "name",
    search_fields: "name",
})
