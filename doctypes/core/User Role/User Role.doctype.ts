export default $doctype({
    user: {
        type: "Reference",
        label: "User",
        reference: "zodula__User",
        on_delete: "CASCADE",
        required: 1,
        unique: 1,
        group: "user-role",
    },
    role: {
        type: "Reference",
        label: "Role",
        reference: "zodula__Role",
        on_delete: "CASCADE",
        required: 1,
        unique: 1,
        group: "user-role",
        in_list_view: 1
    },
}, {
    label: "User Role",
    is_global: 1,
});