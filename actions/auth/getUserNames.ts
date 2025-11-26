import { z } from "bxo"

export default $action(async ctx => {
    const { ids } = ctx.body
    const { docs: users } = await $zodula.doctype("zodula__User").select().where("id", "IN", ids).unsafe(true).bypass(true)
    return ctx.json({
        users: users.map((user: any) => ({
            id: user.id,
            name: user.name
        }))
    })
}, {
    body: z.object({
        ids: z.array(z.string())
    })
})