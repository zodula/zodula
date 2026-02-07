import { z } from "bxo"

export default $action(async (ctx) => {
    const { doctype, id, input } = ctx.body
    const result = await $zodula.doctype(doctype as any).cancel(id, input)
    return ctx.json(result)
}, {
    body: z.object({
        doctype: z.string(),
        id: z.string(),
        input: z.object({
            updated_at: z.string().optional()
        }).optional()
    })
})
