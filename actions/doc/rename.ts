import { z } from "bxo"

export default $action(async (ctx) => {
    const { doctype, oldId, newId } = ctx.body
    const result = await $zodula.doctype(doctype as any).rename(oldId, newId)
    return ctx.json(result)
}, {
    body: z.object({
        doctype: z.string(),
        oldId: z.string(),
        newId: z.string()
    })
})