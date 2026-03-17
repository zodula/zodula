import { z } from "bxo";

export default $action(async (ctx) => {
    const { onboarding_step_id } = ctx.body as { onboarding_step_id: string };
    if (!onboarding_step_id?.trim()) {
        throw new Error("onboarding_step_id is required");
    }

    const user = await $zodula.session.user();
    const org = await $zodula.session.organization(true);
    if (!org || !user) {
        throw new Error("Unauthorized");
    }

    const existing = await $zodula.doctype("Onboarding Step Completion")
        .select()
        .where("user", "=", user.id)
        .where("organization", "=", org)
        .where("onboarding_step_id", "=", onboarding_step_id.trim())
        .bypass(true);

    if (existing.docs?.length) {
        return ctx.json({ ok: true, already_done: true });
    }

    await $zodula.doctype("Onboarding Step Completion").insert({
        user: user.id,
        organization: org,
        onboarding_step_id: onboarding_step_id.trim(),
    }).bypass(true);

    return ctx.json({ ok: true });
}, {
    body: z.object({
        onboarding_step_id: z.string().min(1),
    }),
    response: {
        200: z.object({
            ok: z.boolean(),
            already_done: z.boolean().optional(),
        }),
    },
});
