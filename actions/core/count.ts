import { z } from "@/zodula/client"
import { Database } from "../../server/database/database"

export default $action(async (ctx) => {
    const { docFilters } = ctx.body
    const db = Database("main")
    const results = [] as { doctype: string, count: number }[]
    for (const docFilter of Object.keys(docFilters)) {
        const c = db.select().from(docFilter)
        const q = db.select().from(docFilter)
        for (const filter of docFilters[docFilter] || []) {
            q.where(filter[0], filter[1] as any, filter[2])
            c.where(filter[0], filter[1] as any, filter[2])
        }
        const count = await c.count()
        results.push({ doctype: docFilter, count: count })
    }
    
    return ctx.json({
        results: results,
        success: true
    })
}, {
    body: z.object({
        docFilters: z.record(z.string(), z.array(z.tuple([z.string(), z.string(), z.any()])))
    })
})