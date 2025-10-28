import { z } from "bxo"
export default $action(async ctx => {
    const user = await $zodula.session.user()
    return ctx.json({
        user: $zodula.utils.safe("zodula__User", user)
    })
}, {
    response: {
        200: z.object({
            user: $zodula.utils.zod("zodula__User")
        })
    }
})