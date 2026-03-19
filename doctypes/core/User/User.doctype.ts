export default $doctype<"User">({
    name: {
        type: "Text",
        in_list_view: 1
    },
    email: {
        type: "Email",
        required: 1,
        unique: 1,
        in_list_view: 1,
        perm_level: "1",
    },
    password: {
        type: "Password",
        required: 1,
        no_copy: 1,
        perm_level: "1",
    },
    is_confirmed_email: {
        type: "Check",
        default: "0",
        label: "Email Confirmed",
        no_copy: 1,
        perm_level: "1",
    },
    confirmed_code: {
        type: "Text",
        label: "Confirmation Code",
        no_copy: 1,
        hidden: 1,
    },
    is_active: {
        type: "Check",
        default: "1",
        in_list_view: 1,
        perm_level: "1",
    },
    roles: {
        type: "Reference Table",
        label: "Roles",
        reference: "User Role",
        required: 0,
        perm_level: "1",
    },
    signature: {
        type: "Signature",
        label: "Signature",
        required: 0,
        in_list_view: 0,
    },
}, {
    label: "User",
    search_fields: "email\nname\nid",
    naming_series: "{{email}}",
})
    .on("before_change", async ({ doc, old, input }) => {
        if (input?.password && input.password !== old?.password) {
            doc.password = await Bun.password.hash(input.password as string);
        }
    })