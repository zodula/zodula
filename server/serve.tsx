import { startup } from "./startup"
import { logger } from "./logger";
import BXO from "bxo";
import { installServerErrorHandling } from "./serve/error-handling";
import { openapi } from "bxo/plugins";
import { extendDoctype } from "./serve/extend/doctype";
import { loader } from "./loader"

import { extendAction } from "./serve/extend/action";
import { extendFile } from "./serve/extend/file";
import { on, property } from "./loader/plugins/extend";
import { extendPublic } from "./serve/extend/public";
import extendRealtime from "./serve/extend/realtime";
import { doMigrate } from "../commands/migrate";
import { extendPage } from "./serve/extend/page";
import { extendTranslation } from "./serve/extend/translation";


export async function startServer() {
    installServerErrorHandling()
    await startup()
    const server = new BXO({
        serve: {
            port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
        },
    })
        .beforeRequest((ctx) => {
            const time = new Date().toISOString().split("T")[1]?.split(".")[0]
            const pathname = ctx.url.split("/").slice(3).join("/")
            const pathnameWithoutQuery = pathname.split("?")[0] || ""
            logger.debug(`[${time}] ${`[${ctx.method}]`.padEnd(8)} /${decodeURIComponent(pathnameWithoutQuery)}`)
            return ctx
        })
        .onError((error) => {
            return new Response(JSON.stringify({
                error: error.message
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            })
        })

    server.use(openapi())

    server.use(extendAction())
    server.use(extendDoctype())
    server.use(extendFile())
    server.use(extendPublic())
    server.use(extendRealtime())
    server.use(await extendPage())

    await extendTranslation()
    const _extends = loader.from("extend").list()

    for (const _extend of _extends) {
        await _extend.handler({
            bxo: server,
            on: on,
            property: property
        })
    }

    await doMigrate("main")

    server.start()

    logger.success(`Server started on ${server.server?.url}`)
    logger.success(`Realtime server started on ${server.server?.url?.toString()?.replace("http", "ws")}realtime`)
    if (process.env.NODE_ENV === "development") {
        logger.debug(`Bun environment is development`)
    }
}

// Allow this file to be executed directly (e.g. `bun run serve.tsx` for prod/start)
if (import.meta.main) {
    startServer()
}