import { z } from "bxo"
import path from "path"

export default $action(async (ctx) => {
    const hasRoles = await $zodula.session.hasRoles(["System Admin"])
    if (!hasRoles) {
        return ctx.json({
            data: []
        }, 403)
    }
    const { doctype, ids, fields, app, app_field } = ctx.body
    const _fields = [...fields]
    if (_fields?.indexOf("id") < 0) {
        _fields.unshift("id")
    }
    
    // If app_field is provided, include it in the fields to fetch
    if (app_field && _fields.indexOf(app_field) < 0) {
        _fields.push(app_field)
    }
    
    const doctypeDoc = await $zodula.doctype(doctype as any).select().where("id", "IN", ids).bypass(true).fields(_fields)
    console.log("doctypeDoc", doctypeDoc);
    
    if (app_field) {
        // Group documents by app_field value and export to respective app fixtures
        const docsByApp = new Map<string, any[]>()
        
        for (const doc of doctypeDoc.docs) {
            const docApp = doc[app_field]
            if (!docApp) {
                // Skip documents without app field value
                continue
            }
            
            if (!docsByApp.has(docApp)) {
                docsByApp.set(docApp, [])
            }
            docsByApp.get(docApp)!.push(doc)
        }
        
        // Export each group to its respective app fixture file
        const exportedFiles: string[] = []
        for (const [appValue, docs] of docsByApp.entries()) {
            const fixturePath = path.join(process.cwd(), "apps", appValue, "fixtures", `${doctype}.fixture.json`)
            await Bun.write(fixturePath, JSON.stringify(docs, null, 2))
            exportedFiles.push(fixturePath)
        }
        
        return ctx.json({
            data: doctypeDoc.docs,
            exportedFiles: exportedFiles
        })
    } else {
        // Original behavior: export all to single app
        if (!app) {
            return ctx.json({
                error: "Either 'app' or 'app_field' must be provided"
            }, 400)
        }
        
        const fixturePath = path.join(process.cwd(), "apps", app, "fixtures", `${doctype}.fixture.json`)
        await Bun.write(fixturePath, JSON.stringify(doctypeDoc.docs, null, 2))
        
        return ctx.json({
            data: doctypeDoc.docs,
            exportedFiles: [fixturePath]
        })
    }
}, {
    body: z.object({
        doctype: z.string(),
        ids: z.array(z.string()),
        fields: z.array(z.string()),
        app: z.string().optional(),
        app_field: z.string().optional(),
    }).refine(
        (data) => data.app || data.app_field,
        {
            message: "Either 'app' or 'app_field' must be provided",
        }
    )
})