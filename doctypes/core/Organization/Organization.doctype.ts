export default $doctype<"Organization">({
    organization_name: {
        type: "Text",
        label: "Organization Name",
        required: 1,
    },
    unique_name: {
        type: "Text",
        label: "Unique Name",
        required: 1,
        only_once: 1,
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
    organization_app_tier_items: {
        type: "Reference Table",
        label: "App Tier Items",
        reference: "Organization App Tier Item",
        perm_level: "5",
    },
    organization_roles: {
        type: "Reference Table",
        label: "Organization Roles",
        reference: "Organization Role",
        perm_level: "1",
    },
}, {
    naming_series: "{{unique_name}}",
    label: "Organization",
    is_global: 1,
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Basic",
            layout: [
                { type: "section", value: "Basic Information", align: "left" },
                [
                    { type: "field", value: "organization_name", align: "left" },
                    { type: "field", value: "unique_name", align: "left" },
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
        {
            type: "Tab",
            label: "App Tier",
            layout: [
                { type: "section", value: "App Tier", align: "left" },
                [{ type: "field", value: "organization_app_tier_items", align: "left" }],
            ]
        },
        {
            type: "Tab",
            label: "Roles",
            layout: [
                { type: "section", value: "Organization Roles", align: "left" },
                [{ type: "field", value: "organization_roles", align: "left" }],
            ]
        }
    ])
})
    .on("before_insert", async ({ input }) => {
        input && (input.doc_organization = "System Panel");
        const user = await $zodula.session.user();
        const globalSetting = await $zodula.doctype("Global Setting").get("Global Setting").bypass(true);
        const maxFreeOrgPerUser = globalSetting?.max_free_org_per_user || 1;
        const userOrgs = await $zodula.doctype("Organization").select().where("owner", "=", user.id).bypass(true).fields(["id"]);
        const userOrgIds = (userOrgs.docs || []).map((d: { id: string }) => d.id);
        if (userOrgIds.length === 0) return;
        const allItems = await $zodula.doctype("Organization App Tier Item").select().where("parentype", "=", "Organization").where("parentfield", "=", "organization_app_tier_items").bypass(true);
        const now = new Date();
        const paidOrgIds = new Set(
            (allItems.docs || []).filter(
                (item: any) =>
                    userOrgIds.includes(item.parentid) &&
                    item.tier_level !== "0" &&
                    (!item.expires_at || ($zodula.utils.parseDate(item.expires_at) ?? now) >= now)
            ).map((item: any) => item.parentid)
        );
        const freeCount = userOrgIds.length - paidOrgIds.size;
        if (freeCount >= maxFreeOrgPerUser) {
            throw new Error("You have reached the maximum number of free organizations");
        }
    })
    .on("before_delete", async ({ doc, old, input }) => {
        if (doc.owner !== (await $zodula.session.user()).id && !(await $zodula.session.roles()).includes("System Admin")) {
            throw new Error("You are not allowed to delete this organization");
        }
    });