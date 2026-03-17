import { z } from "bxo"
export default $action(async ctx => {
    const user = await $zodula.session.user().catch(() => null)
    if (!user) {
        return ctx.json({
            user: null
        })
    }
    return ctx.json({
        user: $zodula.utils.safe("User", user)
    })
}, {
    response: {
        200: z.object({
            user: $zodula.utils.zod("User")
        }).or(z.object({
            user: z.null()
        }))
    }
})