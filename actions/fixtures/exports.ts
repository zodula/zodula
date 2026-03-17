import { z } from "bxo"
import path from "path"
import { loader } from "@/zodula/server/loader"

/** Get child table/extend field names and their reference doctype for a doctype */
function getChildFieldRefs(doctype: string): { parentFieldName: string; childDoctype: string }[] {
    try {
        const meta = loader.from("doctype").get(doctype as Zodula.DoctypeName)
        return (meta.children || [])
            .filter((c: { parentDoctype: string }) => c.parentDoctype === doctype)
            .map((c: { parentFieldName: string; childDoctype: string }) => ({
                parentFieldName: c.parentFieldName,
                childDoctype: c.childDoctype,
            }))
    } catch {
        return []
    }
}

/** Return allowed keys for a child doctype fixture (schema fields + parent linkage) */
function getChildFixtureKeys(childDoctype: string): Set<string> {
    try {
        const meta = loader.from("doctype").get(childDoctype as Zodula.DoctypeName)
        const schemaFields = Object.keys(meta.schema?.fields || {})
        return new Set([...schemaFields, "id", "idx", "parentid", "parentype", "parentfield"])
    } catch {
        return new Set()
    }
}

/** Strip doc to only allowed keys; if allowedKeys is empty, return doc as-is */
function pickKeys(doc: Record<string, any>, allowedKeys: Set<string>): Record<string, any> {
    if (allowedKeys.size === 0) return doc
    const out: Record<string, any> = {}
    for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(doc, k)) {
            out[k] = doc[k]
        }
    }
    return out
}

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
    const childRefs = getChildFieldRefs(doctype)

    const getAppForDoc = (doc: Record<string, any>): string | null => {
        if (app_field) {
            const v = doc[app_field]
            return v != null && v !== "" ? String(v) : null
        }
        return app || null
    }

    const childItemsByAppAndDoctype = new Map<string, Map<string, any[]>>()
    const parentDocs = doctypeDoc.docs.map((doc: Record<string, any>) => {
        const copy = { ...doc }
        const appValue = getAppForDoc(doc)
        for (const { parentFieldName, childDoctype } of childRefs) {
            const arr = copy[parentFieldName]
            if (Array.isArray(arr) && arr.length > 0) {
                if (appValue) {
                    if (!childItemsByAppAndDoctype.has(appValue)) {
                        childItemsByAppAndDoctype.set(appValue, new Map())
                    }
                    const byDoctype = childItemsByAppAndDoctype.get(appValue)!
                    if (!byDoctype.has(childDoctype)) byDoctype.set(childDoctype, [])
                    const allowedKeys = getChildFixtureKeys(childDoctype)
                    for (const row of arr) {
                        byDoctype.get(childDoctype)!.push(pickKeys(row, allowedKeys))
                    }
                }
                delete copy[parentFieldName]
            }
        }
        return copy
    })

    const exportedFiles: string[] = []

    if (app_field) {
        const docsByApp = new Map<string, any[]>()
        for (const doc of parentDocs) {
            const docApp = doc[app_field]
            if (!docApp) continue
            if (!docsByApp.has(docApp)) docsByApp.set(docApp, [])
            docsByApp.get(docApp)!.push(doc)
        }
        for (const [appValue, docs] of docsByApp.entries()) {
            const fixturePath = path.join(process.cwd(), "apps", appValue, "fixtures", `${doctype}.fixture.json`)
            await Bun.write(fixturePath, JSON.stringify(docs, null, 2))
            exportedFiles.push(fixturePath)
        }
        for (const [appValue, byDoctype] of childItemsByAppAndDoctype.entries()) {
            for (const [childDoctype, items] of byDoctype.entries()) {
                const childPath = path.join(process.cwd(), "apps", appValue, "fixtures", `${childDoctype}.fixture.json`)
                await Bun.write(childPath, JSON.stringify(items, null, 2))
                exportedFiles.push(childPath)
            }
        }
        return ctx.json({
            data: doctypeDoc.docs,
            exportedFiles,
        })
    }

    if (!app) {
        return ctx.json({
            error: "Either 'app' or 'app_field' must be provided",
        }, 400)
    }

    const fixturePath = path.join(process.cwd(), "apps", app, "fixtures", `${doctype}.fixture.json`)
    await Bun.write(fixturePath, JSON.stringify(parentDocs, null, 2))
    exportedFiles.push(fixturePath)

    const byDoctype = childItemsByAppAndDoctype.get(app) ?? new Map()
    for (const [childDoctype, items] of byDoctype.entries()) {
        const childPath = path.join(process.cwd(), "apps", app, "fixtures", `${childDoctype}.fixture.json`)
        await Bun.write(childPath, JSON.stringify(items, null, 2))
        exportedFiles.push(childPath)
    }

    return ctx.json({
        data: doctypeDoc.docs,
        exportedFiles,
    })
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