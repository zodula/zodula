export default $doctype<"Organization Role">({
    userId: {
        type: "Reference",
        label: "User",
        reference: "User",
        required: 1
    },
    organizationId: {
        type: "Reference",
        label: "Organization",
        reference: "Organization",
        in_list_view: 1,
        required: 1,
    },
    roleId: {
        type: "Reference",
        label: "Role",
        reference: "Role",
        required: 1,
        filters: JSON.stringify([
            ["is_system", "=", "0"],
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