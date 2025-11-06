import { Command } from "nailgun";
import { applyMigrations } from "@/zodula/commands/migrate/apply-migration";
import { applyPredefine } from "@/zodula/commands/migrate/apply-predefine";
import { applyTranslation } from "@/zodula/commands/migrate/apply-translation";
import { startup } from "@/zodula/server/startup";
import { SyncMigrator } from "@/zodula/server/migrator/migrator.sync";
import {
  Database,
  DatabaseHelper,
  type DatabaseSchemaName,
} from "@/zodula/server/database/database";
import { dbcontext } from "@/zodula/server/async-context";
import { logger } from "@/zodula/server/logger";
import path from "path";

export const doMigrate = async (
  schema: DatabaseSchemaName,
  applyDestructive: boolean = false
) => {
  const db = Database(schema);

  // Check for orphaned elements before migration
  logger.info("Checking for orphaned database elements...");
  const migrator = new SyncMigrator();
  const orphanedElements = await migrator.detectOrphanedElements(schema);
  migrator.logOrphanedWarnings(orphanedElements);

  // Apply migrations, predefine, and translations in transaction
  await db.transaction(async (trx) => {
    dbcontext.enterWith({
      trx: trx,
    });
    await applyMigrations(schema);
    await applyPredefine();
    await applyTranslation();
  });

  // Sync database schema - outside transaction
  if (applyDestructive) {
    logger.info("Syncing database schema (including destructive operations)");
  } else {
    logger.info("Syncing database schema (additions and modifications only)");
  }
  const diff = await migrator.compare(schema, applyDestructive);
  logger.info(
    `Applying schema sync (${applyDestructive ? "including destructive operations" : "additions and modifications only"})`
  );
  await migrator.apply(schema, diff, applyDestructive);
  logger.success("Applied schema sync");

  // DatabaseHelper.delete("__temp__apply_migration")
};

export default new Command("migrate")
  .description("Migrate the project")
  .option(
    "--apply-destructive",
    "Apply destructive operations like dropping tables and columns"
  )
  .action(async (options) => {
    await startup();
    await doMigrate("main", options["applyDestructive"] || false);
    // Trigger server restart by touching the watch trigger file
    const watchTriggerPath = path.join(
      process.cwd(),
      ".zodula",
      ".watch_trigger"
    );
    try {
      await Bun.write(watchTriggerPath, Date.now().toString());
      logger.info("Migration completed - server restart triggered");
    } catch (error) {
      logger.warn(
        "Could not trigger server restart - watch trigger file not accessible"
      );
    }
    process.exit(0);
  });
