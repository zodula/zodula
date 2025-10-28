import { z } from "bxo"
import path from "path"

export default $action(async (ctx) => {
    const hasRoles = await $zodula.session.hasRoles(["System Admin"])
    if (!hasRoles) {
        return ctx.json({
            data: []
        }, 403)
    }
    const { doctype, ids, fields, app } = ctx.body
    const _fields = [...fields]
    if (_fields?.indexOf("id") < 0) {
        _fields.unshift("id")
    }
    const doctypeDoc = await $zodula.doctype(doctype as any).select().where("id", "IN", ids).bypass(true).fields(_fields)
    // write to file
    Bun.write(path.join(process.cwd(), "apps", app, "fixtures", `${doctype}.fixture.json`), JSON.stringify(doctypeDoc.docs, null, 2))
    return ctx.json({
        data: doctypeDoc.docs
    })
}, {
    body: z.object({
        app: z.string(),
        doctype: z.string(),
        ids: z.array(z.string()),
        fields: z.array(z.string()),
    })
})