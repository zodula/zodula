export default $doctype<"Organization">({
    organization_name: {
        type: "Text",
        label: "Organization Name",
    },
    abbr: {
        type: "Text",
        label: "Abbreviation",
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
                { type: "section", value: "Public name card", align: "left" },
                [{ type: "field", value: "additional_menu", align: "left" }],
            ]
        },
    ])
});