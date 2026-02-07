export default $doctype<"zodula__User">({
    name: {
        type: "Text",
        in_list_view: 1
    },
    email: {
        type: "Email",
        required: 1,
        unique: 1,
        in_list_view: 1
    },
    password: {
        type: "Password",
        required: 1,
        no_copy: 1
    },
    is_active: {
        type: "Check",
        default: "1",
        in_list_view: 1
    },
    organization_roles: {
        type: "Reference Table",
        label: "Organization Roles",
        reference: "zodula__Organization Role",
        reference_field: "user",
    },
    roles: {
        type: "Reference Table",
        label: "Roles",
        reference: "zodula__User Role",
        reference_field: "user",
        required: 0
    }
}, {
    label: "User",
    search_fields: "email\nname\nid",
    is_global: 1,
    naming_series: "{{email}}",
})
    .on("before_insert", async ({ doc }) => {
        if (doc?.password) {
            doc.password = await Bun.password.hash(doc.password as string);
        }
    })
    .on("before_change", async ({ doc, old, input }) => {
        if (input?.password) {
            doc.password = await Bun.password.hash(input.password as string);
        }
    })