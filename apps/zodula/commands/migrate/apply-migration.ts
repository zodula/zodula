import { Database, type DatabaseSchemaName } from "@/zodula/server/database/database";
import { loader } from "@/zodula/server/loader";
import type { AppMetadata } from "@/zodula/server/loader/plugins/app";
import { logger } from "@/zodula/server/logger";
import { Glob } from "bun";
import path from "path";

const MIGRATION_TABLE = "_zodula_migrations"

async function ensureMigrationTable(schema: DatabaseSchemaName) {
    const db = Database(schema)
    await db.schema.hasTable(MIGRATION_TABLE).then(async (exists) => {
        if (!exists) {
            await db.schema.createTable(MIGRATION_TABLE)
                .addColumn({
                    name: "id",
                    type: "TEXT",
                    notNull: true,
                    primaryKey: true
                }).addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true,
                }).addColumn({
                    name: "timestamp",
                    type: "TEXT",
                    notNull: true,
                }).addColumn({
                    name: "status",
                    type: "TEXT",
                    notNull: true,
                }).execute()

        } else {

        }
    })
}

export async function applyMigrations(schema: DatabaseSchemaName, apps: (string | "*")[] = ["*"],) {
    const db = Database(schema)
    try {
        await ensureMigrationTable(schema)
        let appMetadatas: AppMetadata[] = [];
        if (apps.includes("*")) {
            appMetadatas = loader.from("app").list();
        } else {
            appMetadatas = loader.from("app").list().filter(app => apps.includes(app.packageName));
        }
        for (const appMetadata of appMetadatas) {
            const migrationsGlob = new Glob(`apps/${appMetadata.folder}/migrations/*.ts`);
            let sortedMigrations = []
            for await (const migration of migrationsGlob.scan(".")) {
                sortedMigrations.push(migration)
            }
            sortedMigrations.sort((a, b) => {
                const aName = path.basename(a, ".ts")
                const bName = path.basename(b, ".ts")
                return aName.localeCompare(bName)
            })
            for (const migration of sortedMigrations) {
                const migrationName = path.basename(migration, ".ts")
                const migrationFile = await import(path.resolve(migration));

                const isApplied = await db.select().from(MIGRATION_TABLE).where("name", "=", migrationName).where("status", "=", "applied").first()
                if (isApplied) {
                    logger.info(`Migration ${migrationName} already applied.`)
                    continue
                }
                await migrationFile.default?.({
                    db: db
                })
                await db.insert(MIGRATION_TABLE).values({
                    id: Bun.randomUUIDv7(),
                    name: migrationName,
                    timestamp: new Date().toISOString(),
                    status: "applied"
                }).execute()

            }
        }

    } catch (error) {
        throw error
    }
}