import { z } from "bxo";

export default $action(async (ctx) => {
    const { code, email } = ctx.body;

    if (!code || !email) {
        throw new Error("Code and email are required");
    }

    const { docs: users } = await $zodula
        .doctype("User")
        .select()
        .where("email", "=", email.trim())
        .bypass(true);

    const user = users[0];
    if (!user) {
        throw new Error("User not found");
    }

    if (user.is_confirmed_email === 1) {
        return ctx.json({
            message: "Email is already confirmed. You can sign in.",
            user: $zodula.utils.safe("User", user),
        });
    }

    if (user.confirmed_code !== code) {
        throw new Error("Invalid or expired confirmation code");
    }

    await $zodula
        .doctype("User")
        .update(user.id, {
            is_confirmed_email: 1,
            confirmed_code: "",
        })
        .bypass(true);

    return ctx.json({
        message: "Email confirmed successfully. You can now sign in.",
        user: $zodula.utils.safe("User", user),
    });
}, {
    body: z.object({
        code: z.string().min(1),
        email: z.string().email(),
    }),
    response: {
        200: z.object({
            message: z.string(),
            user: $zodula.utils.zod("User"),
        }),
    },
});
