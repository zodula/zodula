import { z } from "bxo"

export default $action(async (ctx) => {
    const { doctype, ids, fields } = ctx.body
    const hasRoles = await $zodula.session.hasRoles(["System Admin", "Authenticated", "Desk User"])
    if (!hasRoles) {
        return ctx.json({
            data: []
        }, 403)
    }
    const _fields = [...fields]
    if (_fields?.indexOf("id") < 0) {
        _fields.unshift("id")
    }
    const doctypeDoc = await $zodula.doctype(doctype as any).select().where("id", "IN", ids).bypass(true).fields(_fields)
    const headers = _fields.map((field) => {
        return field
    })
    const data = doctypeDoc.docs.map((doc) => {
        return _fields.map((field) => {
            return doc[field]
        })
    })
    return new Response([headers.join(","), ...data.map((row) => row.join(","))].join("\n"), {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${doctype}.csv"`
        }
    })
}, {
    body: z.object({
        doctype: z.string(),
        ids: z.array(z.string()),
        fields: z.array(z.string())
    })
})