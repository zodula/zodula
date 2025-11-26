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
}, {
    label: "User",
    search_fields: "email\nname\nid"
})
    .on("before_change", async ({ doc, old, input }) => {
        if (input?.password) {
            doc.password = await Bun.password.hash(input.password as string);
        }
    })