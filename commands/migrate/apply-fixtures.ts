import { Database } from "@/zodula/server/database";
import { loader } from "@/zodula/server/loader";
import { logger } from "@/zodula/server/logger";
import path from "path";
import { globalContext } from "@/zodula/server/async-context";

export const applyFixtures = async () => {
  try {
    const db = Database("main");
    globalContext.enterWith({
      global: {
        bypass: true,
      },
    });
    const fixtures = loader.from("fixture").list();
    const count = fixtures.length;
    for (const fixture of fixtures) {
      const fixtureData = (await import(path.resolve(fixture.file)))
        ?.default as Zodula.InsertDoctype<Zodula.DoctypeName>[];
      // if not array then throw error
      if (!Array.isArray(fixtureData)) {
        throw "Fixture data is not an array";
      }
      
      // Collect all fixture IDs for this doctype
      const fixtureIds: string[] = [];
      
      for (const data of fixtureData) {
        if (!data.id) {
          throw new Error("ID is required");
        }
        fixtureIds.push(data.id);
        const existing = await db.all(
          `SELECT id FROM "${fixture.name}" WHERE id = ?`,
          [data.id]
        );
        if (existing.length > 0) {
          await db
            .update(fixture.name as Zodula.DoctypeName)
            .set({
              ...data,
              id: data?.id,
            })
            .where("id", "=", data.id)
            .execute();
        } else {
          await db
            .insert(fixture.name as Zodula.DoctypeName)
            .values(data)
            .execute();
        }
      }
      
      // Check if doctype has only_fixtures = 1
      const doctypeDoc = await db
        .select()
        .from("zodula__Doctype")
        .where("id", "=", fixture.name)
        .first();
      
      if (doctypeDoc && doctypeDoc.only_fixtures === 1) {
        // Remove any records that are not in fixtures
        if (fixtureIds.length > 0) {
          await db
            .delete(fixture.name as Zodula.DoctypeName)
            .where("id", "NOT IN", fixtureIds)
            .execute();
          logger.info(
            `Cleaned up records not in fixtures for doctype: ${fixture.name}`
          );
        } else {
          // If no fixtures, delete all records
          await db.delete(fixture.name as Zodula.DoctypeName).execute();
          logger.info(
            `Removed all records for doctype with only_fixtures: ${fixture.name} (no fixtures)`
          );
        }
      }
    }
    logger.info(`Applied ${count} fixtures`);
  } catch (error: any) {
    logger.error(`Error applying fixtures: ${error?.message || error}`);
    throw error?.message || error;
  } finally {
    globalContext.exit(() => {});
  }
};
