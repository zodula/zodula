export default $doctype<"Role Profile Role">({
    role: {
        type: "Reference",
        label: "Role",
        reference: "Role",
        required: 1,
        unique: 1,
        group: "role-profile-role",
        in_list_view: 1,
    },
}, {
    label: "Role Profile Role",
    is_child_doctype: 1,
});
