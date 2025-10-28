import BXO from "bxo";
import { zodula } from "@/zodula/server";
import path from "path";
import { ctxContext } from "../../async-context";
import fs from "fs/promises";
import { ZodulaDoctypeHelper } from "../../zodula/doc/helper";
import sharp from "sharp";
import { logger } from "../../logger";
import { loader } from "../../loader";

export function extendFile() {
    const bxo = new BXO()
    bxo.get("/files/*", async (ctx) => {
        try {
            ctxContext.enterWith({
                ctx: ctx as any
            })
            const rest = ctx.params.wildcard
            const [doctype, docId, fieldName, _filename] = rest.split("/")
            let filename = _filename
            if (!_filename) {
                const files = await fs.readdir(path.join(process.cwd(), ".zodula_data", "files", rest))
                filename = files[0]
            }
            const url = `/${doctype}/${docId}/${fieldName}/${filename}`
            const user = await zodula.session.user(true).catch(() => null)
            const roles = await zodula.session.roles()
            const doc = await zodula.doctype(doctype as Zodula.DoctypeName).get(docId!)
            const doctypeConfig = loader.from("doctype").get(doctype as Zodula.DoctypeName)
            const { can, userPermissionCan } = await ZodulaDoctypeHelper.checkPermission(
                doctype as Zodula.DoctypeName,
                "can_get",
                doc,
                {
                    bypass: false,
                    doctype: doctypeConfig,
                    user: user || { id: null },
                    roles
                }
            )
            
            if (!can || !userPermissionCan) {
                return ctx.json("You are not authorized to access this file", 403)
            }
            const filePath = path.join(process.cwd(), ".zodula_data", "files", url)

            // Check if width and height parameters are provided
            const width = ctx.query.w ? parseInt(ctx.query.w as string) : undefined
            const height = ctx.query.h ? parseInt(ctx.query.h as string) : undefined

            // If no resize parameters, return original file
            if (!width && !height) {
                return Bun.file(filePath) as any
            }

            // Check if file is an image
            const ext = path.extname(filename || '').toLowerCase()
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.svg', '.ico']

            if (!imageExtensions.includes(ext)) {
                return Bun.file(filePath) as any
            }

            try {
                // Resize image using sharp
                const resizedBuffer = await sharp(filePath)
                    .resize(width, height, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 90 })
                    .toBuffer()

                // Return resized image with proper headers
                return new Response(new Uint8Array(resizedBuffer), {
                    headers: {
                        'Content-Type': 'image/jpeg',
                        'Content-Length': resizedBuffer.length.toString(),
                        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                        'Content-Disposition': 'inline' // Ensure inline display, not download
                    }
                })
            } catch (resizeError) {
                // If resize fails, fall back to original file
                logger.error('Image resize failed, serving original:', resizeError)
                return Bun.file(filePath) as any
            }
        } catch (error) {
            return ctx.json(error instanceof Error ? error.message : "Internal server error", 500)
        }
    })
    return bxo
}