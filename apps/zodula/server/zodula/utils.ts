import { FieldHelper } from "../field"
import { loader } from "../loader"
import { ZodulaDoctypeHelper } from "./doc/helper"
import { doctypeZods } from "../../../../.zodula/doctype-zod"
import { logger } from "../logger"
import { z } from "bxo"
import { translate as translateTranslation } from "../serve/extend/translation"
import { Database } from "../database"


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
    const session = await db.select("*").from("zodula__Session" as Zodula.DoctypeName).where("id", "=", sid)
        .where("expires_at", ">", new Date().toISOString())
        .first() as Zodula.SelectDoctype<"zodula__Session">
    if (!session) {
        return null
    }
    const user = await db.select("*").from("zodula__User" as Zodula.DoctypeName).where("id", "=", session.user).first() as Zodula.SelectDoctype<"zodula__User">
    return user
}

export const translate = (key: string, language: string = process.env.ZODULA_PUBLIC_DEFAULT_LANGUAGE || "en") => {
    return translateTranslation(key, language)
}