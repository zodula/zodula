import { z } from "bxo"

export default $action(async ctx => {
    const { email, password } = ctx.body
    const ipAddress = ctx.headers["x-forwarded-for"] ||
        ctx.headers["x-real-ip"] ||
        ctx.headers["x-client-ip"] ||
        "unknown";
    const userAgent = ctx.headers["user-agent"]
    if (!email || !password) {
        throw new Error("Email and password are required")
    }
    const { docs: users } = await $zodula.doctype("zodula__User").select().where("email", "=", email).where("is_active", "=", 1).unsafe(true).bypass(true)
    if (!users[0]) {
        throw new Error("User not found")
    }
    const user = users[0]
    const isPasswordValid = await Bun.password.verify(password, user.password as string)
    if (!isPasswordValid) {
        throw new Error("Invalid password")
    }
    const { docs: [existingSession] } = await $zodula.doctype("zodula__Session").select().where("user", "=", user.id)
        .where("user_agent", "=", userAgent)
        .where("ip_address", "=", ipAddress)
        .sort("expires_at", "desc").bypass(true)
    // validate if session is already exists and not expired
    if (!existingSession || new Date(existingSession.expires_at) < new Date()) {
        // create new session
        const createdSession = await $zodula.doctype("zodula__Session").insert({
            user: user.id,
            // 7 days
            expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
            updated_by: user.id,
            created_by: user.id,
            owner: user.id,
            user_agent: userAgent,
            ip_address: ipAddress
        }).bypass(true)
        // session id cookie
        ctx.set.cookie("zodula_sid", createdSession.id, {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        // user id cookie
        ctx.set.cookie("zodula_user_id", user.id, {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        // email cookie
        ctx.set.cookie("zodula_email", user.email, {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        // roles cookie
        ctx.set.cookie("zodula_roles", user.roles?.map((role: any) => role.role).join(",") || "", {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        return ctx.json({
            session: createdSession,
            user: $zodula.utils.safe("zodula__User", user)
        })
    } else {
        const updatedSession = await $zodula.doctype("zodula__Session").update(existingSession.id, {
            expires_at: $zodula.utils.format(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), "datetime"),
            updated_by: user.id,
            created_by: user.id,
            owner: user.id,
            user_agent: userAgent,
            ip_address: ipAddress
        }).bypass(true)
        ctx.set.cookie("zodula_sid", updatedSession.id, {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        ctx.set.cookie("zodula_user_id", user.id, {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        // email cookie
        ctx.set.cookie("zodula_email", user.email, {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        // roles cookie
        ctx.set.cookie("zodula_roles", user.roles?.map((role: any) => role.role).join(",") || "", {
            path: "/",
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        return ctx.json({
            session: updatedSession,
            user: $zodula.utils.safe("zodula__User", user)
        })
    }
}, {
    body: z.object({
        email: z.string().email(),
        password: z.string()
    }),
    response: {
        200: z.object({
            session: $zodula.utils.zod("zodula__Session"),
            user: $zodula.utils.zod("zodula__User")
        })
    }
})