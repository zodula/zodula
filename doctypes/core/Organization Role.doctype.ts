export default $doctype<"zodula__Organization Role">({
    userId: {
        type: "Reference",
        label: "User",
        reference: "zodula__User",
        reference_type: "One to Many",
        reference_alias: "user_roles",
        reference_label: "Organization Role",
        below_field: "name",
        on_delete: "CASCADE",
        required: 1
    },
    organizationId: {
        type: "Reference",
        label: "Organization",
        reference: "zodula__Organization",
        reference_type: "One to Many",
        reference_alias: "organization_roles",
        reference_label: "Organization Role",
        below_field: "name",
        on_delete: "CASCADE",
        in_list_view: 1,
        required: 1,
    },
    roleId: {
        type: "Reference",
        label: "Role",
        reference: "zodula__Role",
        on_delete: "CASCADE",
        required: 1,
        filters: JSON.stringify([
            ["name", "NOT IN", ["Anonymous", "Authenticated", "System Admin", "OpenAPI User", "Desk User"]],
        ])
    },
}, {
    label: "Organization Role",
    is_global: 1,
})
.on("before_change", async ({ doc, input }) => {
    const prohibitedRoles = ["System Admin", "Anonymous", "Authenticated"];
    if (prohibitedRoles.includes(input?.roleId as string)) {
        throw new Error("(Anonymous, Authenticated, System Admin) Role is prohibited");
    }
});