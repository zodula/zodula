export default $doctype<"zodula__Organization">({
    name: {
        type: "Text",
        label: "Name",
        required: 1,
        only_once: 1
    },
    abbr: {
        type: "Text",
        label: "Abbreviation",
        required: 1,
        unique: 1,
        only_once: 1
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
    currency: {
        type: "Text",
        label: "Currency"
    },
    logo: {
        type: "File",
        accept: "image/*",
        label: "Logo"
    },
    tier_level: {
        type: "Select",
        label: "Tier Level",
        options: "0\n1\n2\n3\n4\n5",
        required: 1,
        perm_level: "5",
        default: "0"
    },
    tier_expires_at: {
        type: "Date",
        label: "Tier Expires At",
        perm_level: "5",
    },
    organization_roles: {
        type: "Reference Table",
        label: "Organization Roles",
        reference: "zodula__Organization Role",
        perm_level: "1",
    },
}, {
    naming_series: "{{name}}",
    label: "Organization",
    is_global: 1,
    tabs: JSON.stringify([
        {
            type: "Tab", 
            label: "Main", 
            layout: [
                { type: "section", value: "Basic Information", align: "left" },
                [
                    { type: "field", value: "name", align: "left" },
                    { type: "field", value: "abbr", align: "left" },
                    { type: "field", value: "address", align: "left" }
                ],
                { type: "section", value: "Contact Information", align: "left" },
                [
                    { type: "field", value: "phone", align: "left" },
                    { type: "field", value: "email", align: "left" },
                    { type: "field", value: "website", align: "left" }
                ],
                { type: "section", value: "Currency & Branding", align: "left" },
                [
                    { type: "field", value: "currency", align: "left" },
                    { type: "field", value: "logo", align: "left" }
                ],
                { type: "section", value: "Tier Information", align: "left" },
                [
                    { type: "field", value: "tier_level", align: "left" },
                    { type: "field", value: "tier_expires_at", align: "left" }
                ],
                { type: "section", value: "Roles", align: "left" },
                [
                    { type: "field", value: "organization_roles", align: "left" }
                ]
            ]
        }
    ])
})
.on("before_insert", async ({input}) => {
    input && (input.organization = "System Panel");
})
.on("before_delete", async ({doc, old, input}) => {
    if(doc.owner !== (await $zodula.session.user()).id && !(await $zodula.session.roles()).includes("System Admin")){
        throw new Error("You are not allowed to delete this organization");
    }
});