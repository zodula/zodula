import { z } from "bxo";

export default $action(async (ctx) => {
    const user = await $zodula.session.user();
    const org = await $zodula.session.organization(true);
    if (!org || !user) {
        return ctx.json({ checklist: [] });
    }

    const orgDoc = await $zodula.doctype("Organization").get(org).bypass(true);
    const isOwner = orgDoc?.owner === user.id;
    const roles = await $zodula.session.roles(org);
    const roleIds = roles.filter(
        (r) =>
            r !== "Organization Owner" &&
            r !== "Authenticated" &&
            r !== "Anonymous"
    );
    const roleNames: string[] = [];
    for (const id of roleIds) {
        try {
            const roleDoc = await $zodula.doctype("Role").get(id).bypass(true);
            if (roleDoc?.name) roleNames.push(roleDoc.name);
        } catch {
            roleNames.push(id);
        }
    }
    if (isOwner) roleNames.push("Organization Owner");

    const onboardingsResult = await $zodula.doctype("Onboarding").select().bypass(true);
    const completionsResult = await $zodula.doctype("Onboarding Step Completion")
        .select()
        .where("user", "=", user.id)
        .where("organization", "=", org)
        .bypass(true);
    const completedStepIds = new Set(
        (completionsResult.docs || []).map((d: any) => d.onboarding_step_id)
    );

    const checklist: Array<{
        onboarding: { id: string; name: string; mode: string };
        steps: Array<{
            id: string;
            title: string;
            description: string | null;
            route: string | null;
            target_selector: string | null;
            completion_mode: string | null;
            completion_value: string | null;
            done: boolean;
            idx: number;
        }>;
    }> = [];

    for (const ob of onboardingsResult.docs || []) {
        const mode = (ob as any).mode || "Organization Owner";
        if (mode === "Organization Owner" && !isOwner) continue;
        if (mode === "Organization User" && isOwner) continue;

        let steps = ((ob as any).onboarding_steps || []) as Array<{
            id: string;
            title: string;
            description?: string | null;
            route?: string | null;
            target_selector?: string | null;
            roles?: string | null;
            completion_mode?: string | null;
            completion_value?: string | null;
            idx?: number;
        }>;
        if (mode === "Organization User" && roleNames.length >= 0) {
            steps = steps.filter((s) => {
                const stepRoles = (s.roles || "").trim();
                if (!stepRoles) return true;
                const allowed = stepRoles.split(",").map((r) => r.trim()).filter(Boolean);
                return allowed.some((r) => roleNames.includes(r));
            });
        }
        steps.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

        checklist.push({
            onboarding: {
                id: (ob as any).id,
                name: (ob as any).name ?? "",
                mode,
            },
            steps: steps.map((s) => ({
                id: s.id,
                title: s.title ?? "",
                description: s.description ?? null,
                route: s.route ?? null,
                target_selector: s.target_selector ?? null,
                completion_mode: s.completion_mode ?? null,
                completion_value: s.completion_value ?? null,
                done: completedStepIds.has(s.id),
                idx: s.idx ?? 0,
            })),
        });
    }

    return ctx.json({ checklist });
}, {
    response: {
        200: z.object({
            checklist: z.array(
                z.object({
                    onboarding: z.object({
                        id: z.string(),
                        name: z.string(),
                        mode: z.string(),
                    }),
                    steps: z.array(
                        z.object({
                            id: z.string(),
                            title: z.string(),
                            description: z.string().nullable(),
                            route: z.string().nullable(),
                            target_selector: z.string().nullable(),
                            completion_mode: z.string().nullable(),
                            completion_value: z.string().nullable(),
                            done: z.boolean(),
                            idx: z.number(),
                        })
                    ),
                })
            ),
        }),
    },
});
