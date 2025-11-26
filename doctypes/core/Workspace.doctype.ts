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
    workspace_parent: $f.VirtualReference({
        label: "Workspace Parent",
        reference: "zodula__Workspace"
    }),
    icon: $f.Text({
        label: "Icon"
    }),
    app: {
        type: "Reference",
        label: "App",
        reference: "zodula__App",
        required: 1,
        on_delete: "CASCADE"
    },
}, {
    label: "Workspace"
})

