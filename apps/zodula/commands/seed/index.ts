import { Command } from "nailgun";
import { startup } from "@/zodula/server/startup";
import { Database } from "@/zodula/server/database/database";
import { dbcontext } from "@/zodula/server/async-context";
import { applyFixtures } from "@/zodula/commands/migrate/apply-fixtures";
import { logger } from "@/zodula/server/logger";

export default new Command("seed")
  .description("Seed the database with fixtures")
  .action(async () => {
    await startup();
    const db = Database("main");

    // Apply fixtures in transaction
    await db.transaction(async (trx) => {
      dbcontext.enterWith({
        trx: trx,
      });
      await applyFixtures();
    });

    logger.success("Seeding completed");
    process.exit(0);
  });

