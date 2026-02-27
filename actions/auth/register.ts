import { z } from "bxo";

export default $action(async (ctx) => {
    const { email, password, name } = ctx.body;

    if (!email || !password) {
        throw new Error("Email and password are required");
    }

    const globalSetting = await $zodula
        .doctype("Global Setting")
        .get("Global Setting")
        .bypass(true)
        .catch(() => null);

    const enableRegister = globalSetting?.enable_register !== 0 && globalSetting?.enable_register !== "0";
    if (!enableRegister) {
        throw new Error("Registration is disabled");
    }

    const autoConfirmEmail = globalSetting?.auto_confirm_email === 1;

    const { docs: existingUsers } = await $zodula
        .doctype("User")
        .select()
        .where("email", "=", email.trim())
        .bypass(true);

    if (existingUsers[0]) {
        throw new Error("A user with this email already exists");
    }

    const confirmedCode = autoConfirmEmail ? null : Bun.randomUUIDv7().replace(/-/g, "").slice(0, 16);
    const createdUser = await $zodula
        .doctype("User")
        .insert({
            email: email.trim(),
            password,
            name: (name || email.trim().split("@")[0]) as string,
            is_active: 1,
            is_confirmed_email: autoConfirmEmail ? 1 : 0,
            confirmed_code: autoConfirmEmail ? "" : confirmedCode,
            organization: "System Panel",
        })
        .bypass(true);

    const user = createdUser;
    if (!user?.id) {
        throw new Error("Failed to create user");
    }

    let emailSent = false;
    if (!autoConfirmEmail && (await $zodula.email.isConfigured())) {
        const requestUrl = (ctx as { request?: { url?: string } }).request?.url;
        const baseUrl =
            process.env.ZODULA_PUBLIC_APP_URL ||
            (requestUrl ? new URL(requestUrl).origin : "") ||
            "";
        const confirmUrl = `${baseUrl}/confirm-email?code=${confirmedCode}&email=${encodeURIComponent(email.trim())}`;
        try {
            await $zodula.email.send({
                to: email.trim(),
                subject: "Confirm your email address",
                html: `
                    <p>Hello,</p>
                    <p>Please confirm your email address by clicking the link below:</p>
                    <p><a href="${confirmUrl}">Confirm Email</a></p>
                    <p>Or copy and paste this URL into your browser:</p>
                    <p>${confirmUrl}</p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you did not create an account, you can safely ignore this email.</p>
                `,
                text: `Please confirm your email by visiting: ${confirmUrl}`,
            });
            emailSent = true;
        } catch (err) {
            console.error("Failed to send confirmation email:", err);
        }
    }

    const message = autoConfirmEmail
        ? "Registration successful. You can now sign in."
        : "Registration successful. Please check your email to confirm your account.";

    return ctx.json({
        message,
        user: $zodula.utils.safe("User", user),
        email_sent: emailSent,
    });
}, {
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
    }),
    response: {
        200: z.object({
            message: z.string(),
            user: $zodula.utils.zod("User"),
            email_sent: z.boolean(),
        }),
    },
});
