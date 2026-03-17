export default $doctype<"Organization App Tier Item">({
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        required: 1
    },
    tier_level: {
        type: "Select",
        label: "Tier Level",
        options: "0\n1\n2\n3\n4\n5",
        required: 1,
        default: "0"
    },
    expires_at: {
        type: "Date",
        label: "Expires At"
    }
}, {
    label: "Organization App Tier Item",
    search_fields: "app",
    display_field: "app",
    is_child_doctype: 1,
})
