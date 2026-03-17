export default $doctype({
    role: {
        type: "Reference",
        label: "Role",
        reference: "Role",
        on_delete: "CASCADE",
        required: 1,
        unique: 1,
        group: "user-role",
        in_list_view: 1
    },
}, {
    label: "User Role",
    is_global: 1,
    is_child_doctype: 1,
});