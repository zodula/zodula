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
    currency: {
        type: "Text",
        label: "Currency",
        default: "฿",
    },
    default_lang: {
        type: "Reference",
        label: "Default Language",
        reference: "Language",
    },
    doc_status_watermark: {
        type: "Check",
        label: "Doc Status Watermark",
        default: "1",
        description: "When printing submittable docs, show Draft/Cancelled watermark if not submitted. Uncheck to hide.",
    },
    is_setup: {
        type: "Check",
        label: "Is Setup",
        default: "0",
        hidden: 1,
        description: "Internal flag to indicate organization setup is completed.",
    },
    facebook_url: {
        type: "Text",
        label: "Facebook URL",
    },
    twitter_url: {
        type: "Text",
        label: "Twitter / X URL",
    },
    linkedin_url: {
        type: "Text",
        label: "LinkedIn URL",
    },
    instagram_url: {
        type: "Text",
        label: "Instagram URL",
    },
    youtube_url: {
        type: "Text",
        label: "YouTube URL",
    },
}, {
    label: "Global Setting",
    is_single: 1,
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
                    { type: "field", value: "currency", align: "left" },
                    { type: "field", value: "default_lang", align: "left" },
                ],
                { type: "section", value: "Social Media", align: "left" },
                [
                    { type: "field", value: "facebook_url", align: "left" },
                    { type: "field", value: "twitter_url", align: "left" },
                    { type: "field", value: "linkedin_url", align: "left" },
                    { type: "field", value: "instagram_url", align: "left" },
                    { type: "field", value: "youtube_url", align: "left" },
                ],
                { type: "section", value: "Print", align: "left" },
                [
                    { type: "field", value: "doc_status_watermark", align: "left" },
                    { type: "field", value: "is_setup", align: "left" },
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