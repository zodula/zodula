import { z } from "bxo";

export default $action(async (ctx) => {
    const {
        organization_name,
        abbr,
        tax_id,
        address,
        phone,
        email,
        website,
        currency,
    } = ctx.body;

    const payloadOrg: Zodula.UpdateDoctype<"Organization"> = {};
    const payloadGlobal: Zodula.UpdateDoctype<"Global Setting"> = {};

    if (organization_name != null && organization_name !== "") {
        payloadOrg.organization_name = String(organization_name).trim();
    }
    if (abbr != null && abbr !== "") {
        payloadOrg.abbr = String(abbr).trim();
    }
    if (tax_id != null && tax_id !== "") {
        payloadOrg.tax_id = String(tax_id).trim();
    }
    if (address != null && address !== "") {
        payloadOrg.address = String(address).trim();
    }
    if (phone != null && phone !== "") {
        payloadOrg.phone = String(phone).trim();
    }
    if (email != null && email !== "") {
        payloadOrg.email = String(email).trim();
    }
    if (website != null && website !== "") {
        payloadOrg.website = String(website).trim();
    }
    if (currency != null && currency !== "") {
        payloadGlobal.currency = String(currency).trim();
    }

    const updatedOrg = await $zodula
        .doctype("Organization")
        .update("Organization", payloadOrg)
        .bypass(true);

    if (payloadGlobal && Object.keys(payloadGlobal).length > 0) {
        await $zodula
            .doctype("Global Setting")
            .update("Global Setting", payloadGlobal)
            .bypass(true);
    }

    return ctx.json(updatedOrg);
}, {
    body: z.object({
        organization_name: z.string().optional(),
        abbr: z.string().optional(),
        tax_id: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        website: z.string().optional(),
        currency: z.string().optional(),
    }),
    response: {
        200: z.object({
            id: z.string(),
            organization_name: z.string(),
            abbr: z.string(),
        }).passthrough(),
    },
});
