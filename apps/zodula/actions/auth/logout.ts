import { z } from "bxo"
export default $action(async ctx => {
    ctx.set.cookie("zodula_sid", "", {
        path: "/",
        maxAge: 0
    })
    ctx.set.cookie("zodula_user_id", "", {
        path: "/",
        maxAge: 0
    })
    ctx.set.cookie("zodula_email", "", {
        path: "/",
        maxAge: 0
    })
    ctx.set.cookie("zodula_roles", "", {
        path: "/",
        maxAge: 0
    })
    return ctx.json({
        message: "Logged out successfully"
    })
}, {
    response: {
        200: z.object({
            message: z.string()
        })
    }
})
