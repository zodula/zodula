export default $doctype({
    user: {
        type: "Reference",
        label: "User",
        reference: "zodula__User",
        required: 1,
        on_delete: "CASCADE"
    },
    expires_at: $f.Datetime({
        label: "Expires At",
        required: 1,
        default: "NOW()"
    }),
    user_agent: {
        type: "Text",
        label: "User Agent"
    },
    ip_address: {
        type: "Text",
        label: "IP Address"
    }
}, {
    label: "Session"
})