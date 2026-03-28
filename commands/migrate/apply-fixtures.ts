import { Database } from "@/zodula/server/database";
import { loader } from "@/zodula/server/loader";
import { logger } from "@/zodula/server/logger";
import path from "path";
import { globalContext } from "@/zodula/server/async-context";

type ChildRef = {
  parentFieldName: string;
  childDoctype: string;
};

const getChildRefs = (doctype: string): ChildRef[] => {
  try {
    const meta = loader.from("doctype").get(doctype as Zodula.DoctypeName) as {
      children?: Array<{
        parentDoctype?: string;
        parentFieldName?: string;
        childDoctype?: string;
      }>;
    };
    return (meta.children || [])
      .filter(
        (c) =>
          c.parentDoctype === doctype &&
          !!c.parentFieldName &&
          !!c.childDoctype
      )
      .map((c) => ({
        parentFieldName: c.parentFieldName as string,
        childDoctype: c.childDoctype as string,
      }));
  } catch {
    return [];
  }
};

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
      const childRefs = getChildRefs(fixture.name);
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
        const parentData = { ...(data as Record<string, any>) };
        const childRowsByField: Record<string, Record<string, any>[]> = {};
        for (const childRef of childRefs) {
          const rows = parentData[childRef.parentFieldName];
          if (Array.isArray(rows)) {
            childRowsByField[childRef.parentFieldName] = rows;
            delete parentData[childRef.parentFieldName];
          }
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
              ...parentData,
              id: data?.id,
              doc_status: data?.doc_status || "Draft",
            })
            .where("id", "=", data.id)
            .execute();
        } else {
          await db
            .insert(fixture.name as Zodula.DoctypeName)
            .values({
              ...parentData,
              doc_status: data?.doc_status || "Draft",
            })
            .execute();
        }

        // Sync inline child tables from parent fixture data.
        for (const childRef of childRefs) {
          if (
            !Object.prototype.hasOwnProperty.call(
              childRowsByField,
              childRef.parentFieldName
            )
          ) {
            continue;
          }
          const childRows = childRowsByField[childRef.parentFieldName] || [];
          await db
            .delete(childRef.childDoctype as Zodula.DoctypeName)
            .where("parentid", "=", data.id)
            .where("parentype", "=", fixture.name)
            .where("parentfield", "=", childRef.parentFieldName)
            .execute();

          if (childRows.length > 0) {
            await db
              .insert(childRef.childDoctype as Zodula.DoctypeName)
              .values(
                childRows.map((row, index) => ({
                  ...row,
                  id: row?.id || `${data.id}-${childRef.parentFieldName}-${index + 1}`,
                  idx: row?.idx ?? index,
                  doc_status: row?.doc_status || "Draft",
                  parentid: data.id,
                  parentype: fixture.name,
                  parentfield: childRef.parentFieldName,
                }))
              )
              .execute();
          }
        }
      }
      
      // Check if doctype has only_fixtures = 1
      const doctypeDoc = await db
        .select()
        .from("Doctype")
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
