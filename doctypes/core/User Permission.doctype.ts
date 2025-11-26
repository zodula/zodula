export default $doctype<"zodula__User Permission">({
    user: {
        type: "Reference",
        label: "User",
        reference: "zodula__User",
        required: 1,
        reference_type: "One to Many",
        reference_alias: "user_permissions",
        reference_label: "User Permission",
        on_delete: "CASCADE",
    },
    allow: {
        type: "Virtual Reference",
        label: "Allow",
        reference: "zodula__Doctype",
        on_delete: "CASCADE",
        required: 1,
        in_list_view: 1
    },
    value: {
        type: "Virtual Reference",
        label: "Value",
        reference: "{{allow}}",
        on_delete: "CASCADE",
        required: 1,
        in_list_view: 1
    },
    apply_to_all: $f.Check({
        label: "Apply To All Doctypes",
        in_list_view: 1,
        default: "0"
    }),
    apply_to_only: {
        type: "Virtual Reference",
        label: "Apply To Only Doctype",
        reference: "zodula__Doctype",
        on_delete: "CASCADE",
        in_list_view: 1,
        description: "The user will be allowed to access the doctype for the given value."
    },
}, {
    label: "User Permission"
})