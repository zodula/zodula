export default $doctype({
    host: {
        type: "Text",
        label: "SMTP Host",
        required: 1,
        in_list_view: 1,
    },
    port: {
        type: "Integer",
        label: "SMTP Port",
        required: 1,
        default: "587",
        in_list_view: 1,
    },
    secure: {
        type: "Check",
        label: "Use TLS/SSL",
        default: "0",
        description: "Enable for port 465 (SMTPS).",
    },
    user: {
        type: "Text",
        label: "SMTP User",
        description: "Username for SMTP authentication.",
    },
    password: {
        type: "Password",
        label: "SMTP Password",
        no_copy: 1,
        description: "Password for SMTP authentication.",
    },
    from_email: {
        type: "Email",
        label: "Default From Address",
        description: "Default 'From' address for outgoing emails. Falls back to SMTP User if not set.",
    },
}, {
    label: "Email",
    is_global: 1,
    naming_series: "{{user}}",
    search_fields: "user\nhost",
})