import { z } from "bxo"

export default $action(async (ctx) => {
    const { doctype, id } = ctx.body
    const result = await $zodula.doctype(doctype as any).submit(id)
    return ctx.json(result)
}, {
    body: z.object({
        doctype: z.string(),
        id: z.string()
    })
})
