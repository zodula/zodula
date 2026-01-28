import { z } from "bxo"

export default $action(async ctx => {
    const roles = await $zodula.session.roles()
    console.log(roles)

    return ctx.json({
        roles
    })
}, {
    response: {
        200: z.object({
            roles: z.array(z.string())
        })
    }
})