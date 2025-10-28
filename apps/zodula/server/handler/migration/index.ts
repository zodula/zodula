import type { Bunely } from "bunely"

interface MigrationContext {
    db: Bunely
}

type MigrationHandler = (ctx: MigrationContext) => Promise<void>

export const migrationHandler = (handler: MigrationHandler) => {
    return handler
}