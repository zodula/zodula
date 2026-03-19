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

    const payload: Zodula.UpdateDoctype<"Organization"> = {};

    if (organization_name != null && organization_name !== "") {
        payload.organization_name = String(organization_name).trim();
    }
    if (abbr != null && abbr !== "") {
        payload.abbr = String(abbr).trim();
    }
    if (tax_id != null && tax_id !== "") {
        payload.tax_id = String(tax_id).trim();
    }
    if (address != null && address !== "") {
        payload.address = String(address).trim();
    }
    if (phone != null && phone !== "") {
        payload.phone = String(phone).trim();
    }
    if (email != null && email !== "") {
        payload.email = String(email).trim();
    }
    if (website != null && website !== "") {
        payload.website = String(website).trim();
    }
    if (currency != null && currency !== "") {
        payload.currency = String(currency).trim();
    }

    const updated = await $zodula
        .doctype("Organization")
        .update("Organization", payload)
        .bypass(true);

    return ctx.json(updated);
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
