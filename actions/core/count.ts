import { z } from "@/zodula/client"

export default $action(async (ctx) => {
    const { docFilters } = ctx.body
    const results = [] as { key: string, doctype: string, count: number }[]

    for (const docFilter of docFilters) {
        const filters = docFilter.filters
        const doctype = docFilter.doctype
        let q = $zodula.doctype(doctype as any).select().bypass(true)
        for (const filter of filters) {
            q = q.where(filter[0], filter[1] as any, filter[2])
        }
        const count = (await q).count
        results.push({ key: `${doctype}.${filters.join(".")}`, doctype: doctype, count: count })
    }
    return ctx.json({
        results: results,
        success: true
    })
}, {
    body: z.object({
        docFilters: z.array(z.object({
            doctype: z.string(),
            filters: z.array(z.tuple([z.string(), z.string(), z.any()]))
        }))
    })
})