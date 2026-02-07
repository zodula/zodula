import { z } from "@/zodula/client"

export default $action(async (ctx) => {
    const { doctype, id } = ctx.body
    const connections = await $zodula.utils.getDoctypeConnections(doctype as any, id)
    return ctx.json({
        connections: connections
    })
}, {
    body: z.object({
        doctype: z.string(),
        id: z.string()
    })
})