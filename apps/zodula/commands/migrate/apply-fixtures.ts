import { Database } from "@/zodula/server/database"
import { loader } from "@/zodula/server/loader"
import { logger } from "@/zodula/server/logger"
import path from "path"
import { globalContext } from "@/zodula/server/async-context"

export const applyFixtures = async () => {
    try {
        const db = Database("main")
        globalContext.enterWith({
            global: {
                bypass: true
            }
        })
        const fixtures = loader.from("fixture").list()
        const count = fixtures.length
        for (const fixture of fixtures) {
            const fixtureData = (await import(path.resolve(fixture.file)))?.default as Zodula.InsertDoctype<Zodula.DoctypeName>[]
            // if not array then throw error
            if (!Array.isArray(fixtureData)) {
                throw "Fixture data is not an array"
            }
            for (const data of fixtureData) {
                if (!data.id) {
                    throw new Error("ID is required")
                }
                const existing = await db.all(`SELECT id FROM "${fixture.name}" WHERE id = ?`, [data.id])
                if (existing.length > 0) {
                    await db.update(fixture.name as Zodula.DoctypeName).set(data).where("id", "=", data.id)
                } else {
                    await db.insert(fixture.name as Zodula.DoctypeName).values(data).execute()
                }
            }
        }
        logger.info(`Applied ${count} fixtures`)
    } catch (error: any) {
        logger.error(`Error applying fixtures: ${error?.message || error}`)
        throw error?.message || error
    } finally {
        globalContext.exit(() => { })
    }
}