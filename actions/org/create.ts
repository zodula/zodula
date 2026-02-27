import { z } from "bxo";

export default $action(async (ctx) => {
    const { name, abbr } = ctx.body;

    if (!name?.trim()) {
        throw new Error("Name is required");
    }
    if (!abbr?.trim()) {
        throw new Error("Abbreviation is required");
    }

    const created = await $zodula
        .doctype("Organization")
        .insert({
            name: name.trim(),
            abbr: abbr.trim(),
            organization: "System Panel",
            tier_level: "0",
        })
        .bypass(true);

    return ctx.json(created);
}, {
    body: z.object({
        name: z.string().min(1, "Name is required"),
        abbr: z.string().min(1, "Abbreviation is required"),
    }),
    response: {
        200: z.object({
            id: z.string(),
            name: z.string(),
            abbr: z.string(),
        }).passthrough(),
    },
});
