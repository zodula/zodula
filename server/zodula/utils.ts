import { FieldHelper } from "../field"
import { loader } from "../loader"
import { ZodulaDoctypeHelper } from "./doc/helper"
import { doctypeZods } from "../../../../.zodula/doctype-zod"
import { logger } from "../logger"
import { z } from "bxo"
import { translate as translateTranslation } from "../serve/extend/translation"
import { Database } from "../database"
import path from "path"
import fs from "fs/promises"
import sharp from "sharp"

export const genRanHex = (size: number) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

export const safe = (doctype: Zodula.DoctypeName, data?: Zodula.SelectDoctype<Zodula.DoctypeName>) => {
    if (!data) {
        return null
    }
    return ZodulaDoctypeHelper.formatDocResult(data, loader.from("doctype").get(doctype).schema)
}

export const zod = <DN extends Zodula.DoctypeName>(doctype: DN) => {
    try {
        return FieldHelper.doctypeToZod(loader.from("doctype").get(doctype).schema) as typeof doctypeZods[DN]
    } catch (e) {
        logger.error(`[Error] Doctype ${doctype} not found`)
        return z.object({}) as typeof doctypeZods[DN]
    }
}

export const getUserFromSid = async (sid: string) => {
    const db = Database("main")
    const session = await db.select("*").from("Session" as Zodula.DoctypeName).where("id", "=", sid)
        .where("expires_at", ">", new Date().toISOString())
        .first() as Zodula.SelectDoctype<"Session">
    if (!session) {
        return null
    }
    const user = await db.select("*").from("User" as Zodula.DoctypeName).where("id", "=", session.user).first() as Zodula.SelectDoctype<"User">
    return user
}

export const translate = (key: string, language: string = process.env.ZODULA_PUBLIC_DEFAULT_LANGUAGE || "en") => {
    return translateTranslation(key, language)
}

export async function getDoctypeConnections(doctype: Zodula.DoctypeName, id: string) {
    const doctypeMeta = loader.from("doctype").get(doctype)
    const doctypeRelatives = doctypeMeta.relatives
    let additionalConnections = JSON.parse(doctypeMeta.config.additional_connections?.replaceAll("{{id}}", `${id}`) || "[]") as { doctype: string, filters: any[][], field: string }[] 
    let connections = [] as { doctype: string, filters: any[][], field: string }[]
    
    // Get all children to check for child table relationships
    const allChildren = loader.from("doctype").getAllChildren()
    
    // Find connections from child tables:
    // For each child, check if the child doctype has a field that references the target doctype
    for (const child of allChildren) {
        try {
            const childDoctypeMeta = loader.from("doctype").get(child.childDoctype)
            
            // Check if child doctype is a child table (is_child_doctype = 1)
            if (childDoctypeMeta.config.is_child_doctype !== 1) {
                continue
            }
            
            // Check if the child doctype has any field that references the target doctype
            for (const [fieldName, fieldConfig] of Object.entries(childDoctypeMeta.schema.fields)) {
                if (fieldConfig.reference === doctype) {
                    // Create connection using parent doctype and field path
                    const fieldPath = `${child.parentFieldName}.${fieldName}`
                    connections.push({
                        doctype: child.parentDoctype,
                        filters: [[fieldPath, "=", id]],
                        field: fieldPath
                    })
                }
            }
        } catch (error) {
            // Child doctype not found, skip
            continue
        }
    }
    
    // Add connections from relatives (one-way: child references parent)
    // Filter out relatives that are child tables (they're handled by children above)
    for (const relative of doctypeRelatives) {
        // Check if this relative is a child table relationship by checking if the child doctype is a child table
        let isChildTable = false
        try {
            const childDoctypeMeta = loader.from("doctype").get(relative.childDoctype)
            isChildTable = childDoctypeMeta.config.is_child_doctype === 1
        } catch (error) {
            // Child doctype not found, skip
            continue
        }
        
        // Only add if it's not a child table (child tables are handled by children above)
        if (!isChildTable) {
            const childDoctype = loader.from("doctype").get(relative.childDoctype)
            if(childDoctype)
            connections.push({ doctype: relative.childDoctype, filters: [[relative.childFieldName, "=", id]], field: relative.childFieldName })
        }
    }
    
    for (const connection of additionalConnections) {
        connections.push({ doctype: connection.doctype, filters: connection.filters, field: connection.field || "" })
    }
    connections = connections.filter((connection) => connection.doctype !== doctype)
    return connections
}

export async function get_image_base64(options: {
    org: string
    doctype: Zodula.DoctypeName
    docId: string
    fieldName: string
    filename?: string
    bypass?: boolean
    width?: number
    height?: number
}): Promise<string | null> {
    const { org, doctype, docId, fieldName, filename, bypass, width, height } = options

    try {
        const dtMeta = loader.from("doctype").get(doctype)
        const field = dtMeta?.schema?.fields?.[fieldName as any]
        const isPublic = field?.is_public === 1

        if (!bypass && !isPublic) {
            throw new Error("You are not authorized to access this file")
        }

        const baseDir = path.join(process.cwd(), ".zodula_data", "files", org, doctype, docId, fieldName)
        let finalFilename = filename

        if (!finalFilename) {
            const files = await fs.readdir(baseDir)
            if (!files.length) return null
            finalFilename = files[0]
        }

        const filePath = path.join(baseDir, finalFilename!)
        const ext = path.extname(finalFilename || "").toLowerCase()

        const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"]
        const mimeByExt: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".tiff": "image/tiff",
        }

        let buffer: Buffer

        if (imageExts.includes(ext) && (width || height)) {
            try {
                buffer = await sharp(filePath)
                    .resize(width, height, {
                        fit: "inside",
                        withoutEnlargement: true,
                    })
                    .toBuffer()
            } catch (e) {
                logger.error("get_image_base64 resize failed, serving original:", e)
                buffer = await fs.readFile(filePath)
            }
        } else {
            buffer = await fs.readFile(filePath)
        }

        const mime = mimeByExt[ext] || "application/octet-stream"
        const base64 = buffer.toString("base64")
        return `data:${mime};base64,${base64}`
    } catch (error: any) {
        logger.error("get_image_base64 error:", error)
        return null
    }
}