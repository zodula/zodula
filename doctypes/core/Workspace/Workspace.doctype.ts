export default $doctype<"zodula__Workspace">({
    name: $f.Data({
        label: "Name",
        required: 1
    }),
    idx: {
        type: "Integer",
        label: "Idx",
        default: "0"
    },
    workspace_parent: {
        type: "Virtual Reference",
        label: "Workspace Parent",
        reference: "zodula__Workspace"
    },
    icon: {
        type: "Text",
        label: "Icon"
    },
    app: {
        type: "Reference",
        label: "App",
        reference: "zodula__App",
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
        reference: "zodula__Workspace Item",
        required: 0
    }
}, {
    label: "Workspace",
    is_global: 1,
})

