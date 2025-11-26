import { startup } from "./startup"
import { logger } from "./logger";
import BXO from "bxo";
import { openapi } from "bxo/plugins";
import { extendDoctype } from "./serve/extend/doctype";
import { loader } from "./loader"

import { extendAction } from "./serve/extend/action";
import { extendFile } from "./serve/extend/file";
import { on } from "./loader/plugins/extend";
import { extendPublic } from "./serve/extend/public";
import extendRealtime from "./serve/extend/realtime";
import { doMigrate } from "../commands/migrate";
import { extendPage } from "./serve/extend/page";
import { extendTranslation } from "./serve/extend/translation";


async function startServer() {
    await startup()
    await doMigrate("main")
    const server = new BXO()
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
            on: on
        })
    }

    server.start()

    logger.success(`Server started on ${server.server?.url}`)
    logger.success(`Realtime server started on ${server.server?.url?.toString()?.replace("http", "ws")}realtime`)
    if (process.env.NODE_ENV === "development") {
        logger.debug(`Bun environment is development`)
    }
}

startServer()