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
    role_profile: {
        type: "Reference",
        label: "Role Profile",
        reference: "Role Profile",
        perm_level: "1",
    },
    branch: {
        type: "Reference",
        label: "Branch",
        reference: "Branch",
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
        const payload = input as any;
        if (input?.password && input.password !== old?.password) {
            doc.password = await Bun.password.hash(input.password as string);
        }
        if (typeof payload?.role_profile !== "undefined" && payload.role_profile) {
            const roleProfile = await $zodula
                .doctype("Role Profile" as any)
                .get(payload.role_profile as string)
                .bypass(true);
            const profileRoles = (roleProfile?.roles || [])
                .filter((row: any) => row?.role)
                .map((row: any, idx: number) => ({
                    role: row.role,
                    idx,
                }));
            doc.roles = profileRoles as any;
        }
    })
    .on("before_delete", async ({ doc }) => {
        // if user is System Admin throw
        if (doc.roles?.some((role: any) => role.role === "System Admin")) {
            throw new Error("System Admin user cannot be deleted");
        }
    });