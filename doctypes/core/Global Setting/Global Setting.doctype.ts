export default $doctype({
    website_name: {
        type: "Text",
        label: "Website Name"
    },
    enable_register: {
        type: "Check",
        label: "Enable Registration",
        default: "1"
    },
    auto_confirm_email: {
        type: "Check",
        label: "Auto Confirm Email",
        default: "0"
    },
    default_outgoing_email: {
        type: "Reference",
        label: "Default Outgoing Email",
        reference: "Email",
        description: "Email account to use for sending outgoing emails (registration, notifications, etc.).",
    },
    homepage: {
        type: "Text",
        label: "Homepage"
    },
    logo: {
        type: "File",
        label: "Logo",
        accept: "image/*"
    },
    favicon: {
        type: "File",
        label: "Favicon",
        accept: "image/*"
    },
    description: {
        type: "Text",
        label: "Description"
    },
    currency_symbol: {
        type: "Text",
        label: "Currency Symbol"
    }
}, {
    label: "Global Setting",
    is_single: 1,
    is_global: 1,
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "General",
            layout: [
                { type: "section", value: "Website", align: "left" },
                [
                    { type: "field", value: "website_name", align: "left" },
                    { type: "field", value: "homepage", align: "left" },
                    { type: "field", value: "description", align: "left" },
                ],
                { type: "section", value: "Branding", align: "left" },
                [
                    { type: "field", value: "logo", align: "left" },
                    { type: "field", value: "favicon", align: "left" },
                    { type: "field", value: "currency_symbol", align: "left" },
                ],
            ],
        },
        {
            type: "Tab",
            label: "Registration & Email",
            layout: [
                { type: "section", value: "Registration", align: "left" },
                [
                    { type: "field", value: "enable_register", align: "left" },
                    { type: "field", value: "auto_confirm_email", align: "left" },
                ],
                { type: "section", value: "Email", align: "left" },
                [
                    { type: "field", value: "default_outgoing_email", align: "left" },
                ],
            ],
        },
    ]),
})