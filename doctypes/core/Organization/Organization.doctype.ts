export default $doctype<"Organization">({
    organization_name: {
        type: "Text",
        label: "Organization Name",
        required: 1,
    },
    abbr: {
        type: "Text",
        label: "Abbreviation",
        required: 1,
        unique: 1,
        only_once: 1,
    },
    tax_id: {
        type: "Text",
        label: "Tax ID"
    },
    address: {
        type: "Text",
        label: "Address"
    },
    phone: {
        type: "Text",
        label: "Phone"
    },
    email: {
        type: "Email",
        label: "Email"
    },
    website: {
        type: "Text",
        label: "Website"
    },
    bio: {
        type: "Long Text",
        label: "Bio",
        description: "Short description for name card and public profile.",
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
    currency: {
        type: "Text",
        label: "Currency",
        default: "฿"
    },
    logo: {
        type: "File",
        accept: "image/*",
        label: "Logo"
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
}, {
    label: "Organization",
    is_single: 1,
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Basic",
            layout: [
                { type: "section", value: "Basic Information", align: "left" },
                [
                    { type: "field", value: "organization_name", align: "left" },
                    { type: "field", value: "abbr", align: "left" },
                ],
                [{ type: "field", value: "tax_id", align: "left" }],
                { type: "section", value: "Contact Information", align: "left" },
                [
                    { type: "field", value: "address", align: "left" },
                    { type: "field", value: "phone", align: "left" },
                    { type: "field", value: "email", align: "left" },
                ],
                [{ type: "field", value: "website", align: "left" }],
                { type: "section", value: "Bio", align: "left" },
                [{ type: "field", value: "bio", align: "left" }],
                { type: "section", value: "Social Media", align: "left" },
                [
                    { type: "field", value: "facebook_url", align: "left" },
                    { type: "field", value: "twitter_url", align: "left" },
                    { type: "field", value: "linkedin_url", align: "left" },
                    { type: "field", value: "instagram_url", align: "left" },
                    { type: "field", value: "youtube_url", align: "left" },
                ],
            ]
        },
        {
            type: "Tab",
            label: "Branding & Print",
            layout: [
                { type: "section", value: "Currency & Branding", align: "left" },
                [
                    { type: "field", value: "currency", align: "left" },
                    { type: "field", value: "default_lang", align: "left" },
                    { type: "field", value: "logo", align: "left" },
                ],
                { type: "section", value: "Print", align: "left" },
                [{ type: "field", value: "doc_status_watermark", align: "left" }],
            ]
        },
    ])
});