import { z } from "bxo";

export default $action(async (ctx) => {
    const {
        organization_name,
        unique_name,
        abbr,
        tax_id,
        address,
        phone,
        email,
        website,
        currency,
    } = ctx.body;

    if (!organization_name?.trim()) {
        throw new Error("Organization Name is required");
    }
    if (!unique_name?.trim()) {
        throw new Error("Unique Name is required");
    }
    if (!abbr?.trim()) {
        throw new Error("Abbreviation is required");
    }

    const payload: Zodula.InsertDoctype<"Organization"> = {
        organization_name: organization_name.trim(),
        unique_name: unique_name.trim(),
        abbr: abbr.trim(),
        doc_organization: "System Panel",
        ...(tax_id != null && tax_id !== "" ? { tax_id: String(tax_id).trim() } : {}),
        ...(address != null && address !== "" ? { address: String(address).trim() } : {}),
        ...(phone != null && phone !== "" ? { phone: String(phone).trim() } : {}),
        ...(email != null && email !== "" ? { email: String(email).trim() } : {}),
        ...(website != null && website !== "" ? { website: String(website).trim() } : {}),
        ...(currency != null && currency !== "" ? { currency: String(currency).trim() } : {}),
    };

    const created = await $zodula
        .doctype("Organization")
        .insert(payload)
        .bypass(true);

    return ctx.json(created);
}, {
    body: z.object({
        organization_name: z.string().min(1, "Organization Name is required"),
        unique_name: z.string().min(1, "Unique Name is required"),
        abbr: z.string().min(1, "Abbreviation is required"),
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
            unique_name: z.string(),
            abbr: z.string(),
        }).passthrough(),
    },
});
