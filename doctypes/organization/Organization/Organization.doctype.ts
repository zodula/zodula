export default $doctype<"Organization">({
    organization_name: {
        type: "Text",
        label: "Organization Name",
    },
    abbr: {
        type: "Text",
        label: "Abbreviation",
    },
    logo: {
        type: "File",
        label: "Logo",
        accept: "image/*",
        description: "Organization logo for letterhead and print. If empty, Global Setting logo is used where applicable.",
        is_public: 1,
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
    tagline: {
        type: "Text",
        label: "Tagline",
        description: "Short headline shown in the website hero section.",
    },
    industry: {
        type: "Text",
        label: "Industry",
    },
    founding_year: {
        type: "Text",
        label: "Founding Year",
    },
    support_hours: {
        type: "Text",
        label: "Support Hours",
    },
    about_story: {
        type: "Long Text",
        label: "About Story",
        description: "Longer story for the About Us page.",
    },
    mission: {
        type: "Long Text",
        label: "Mission",
    },
    vision: {
        type: "Long Text",
        label: "Vision",
    },
    value_1: {
        type: "Text",
        label: "Core Value 1",
    },
    value_2: {
        type: "Text",
        label: "Core Value 2",
    },
    value_3: {
        type: "Text",
        label: "Core Value 3",
    },
    additional_menu: {
        type: "Reference Table",
        label: "Additional Menu",
        reference: "Organization Additional Menu",
        required: 0,
        description: "Extra links in the public site navbar (e.g. Track delivery → /org/track).",
    },
}, {
    label: "Organization",
    is_single: 1,
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Company",
            layout: [
                { type: "section", value: "Identity", align: "left" },
                [
                    { type: "field", value: "organization_name", align: "left" },
                    { type: "field", value: "abbr", align: "left" },
                ],
                [{ type: "field", value: "logo", align: "left" }],
                [{ type: "field", value: "tax_id", align: "left" }],
            ],
        },
        {
            type: "Tab",
            label: "Contact",
            layout: [
                { type: "section", value: "Contact", align: "left" },
                [{ type: "field", value: "address", align: "left" }],
                [
                    { type: "field", value: "phone", align: "left" },
                    { type: "field", value: "email", align: "left" },
                ],
                [{ type: "field", value: "website", align: "left" }],
            ],
        },
        {
            type: "Tab",
            label: "Website",
            layout: [
                { type: "section", value: "Profile", align: "left" },
                [{ type: "field", value: "bio", align: "left" }],
                [{ type: "field", value: "tagline", align: "left" }],
                [
                    { type: "field", value: "industry", align: "left" },
                    { type: "field", value: "founding_year", align: "left" },
                ],
                [{ type: "field", value: "support_hours", align: "left" }],
            ],
        },
        {
            type: "Tab",
            label: "About",
            layout: [
                { type: "section", value: "Story & values", align: "left" },
                [{ type: "field", value: "about_story", align: "left" }],
                [
                    { type: "field", value: "mission", align: "left" },
                    { type: "field", value: "vision", align: "left" },
                ],
                [
                    { type: "field", value: "value_1", align: "left" },
                    { type: "field", value: "value_2", align: "left" },
                    { type: "field", value: "value_3", align: "left" },
                ],
            ],
        },
        {
            type: "Tab",
            label: "Public site",
            layout: [
                { type: "section", value: "Navigation", align: "left" },
                [{ type: "field", value: "additional_menu", align: "left" }],
            ],
        },
    ]),
});