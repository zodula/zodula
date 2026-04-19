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

    const roles = await $zodula.session.roles();
    const isSystemAdmin = roles.includes("System Admin");
    const currentUser = await $zodula.session.user(true);
    const userBranch = String((currentUser as any)?.branch ?? "").trim();
    const withBranchIfRequired = async (doctypeName: Zodula.DoctypeName, payload: Record<string, any>) => {
        if (isSystemAdmin || !userBranch) return payload;
        const doctypeDoc = await $zodula
            .doctype("Doctype")
            .get(doctypeName as any)
            .fields(["is_branch_doctype"] as any)
            .bypass(true);
        if (Number((doctypeDoc as any)?.is_branch_doctype ?? 0) !== 1) return payload;
        return { ...payload, _branch: userBranch };
    };

    const orgPayloadWithBranch = await withBranchIfRequired("Organization", payloadOrg as any);
    const globalPayloadWithBranch = await withBranchIfRequired("Global Setting", payloadGlobal as any);

    const updatedOrg = await $zodula
        .doctype("Organization")
        .update("Organization", orgPayloadWithBranch as any)
        .bypass(true);

    if (globalPayloadWithBranch && Object.keys(globalPayloadWithBranch).length > 0) {
        await $zodula
            .doctype("Global Setting")
            .update("Global Setting", globalPayloadWithBranch as any)
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
